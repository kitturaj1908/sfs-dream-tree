import os
import json
import sqlite3
import asyncio
import socket
from typing import List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request, Depends
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sentiment_rules import analyze_sentiment, clean_text

app = FastAPI(title='SFS College Dream Tree API')

# DB_PATH setup
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dreams.db')
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')

os.makedirs(STATIC_DIR, exist_ok=True)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_name TEXT,
            message TEXT NOT NULL,
            sentiment TEXT NOT NULL,
            status TEXT NOT NULL, -- 'approved', 'pending', 'blocked'
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    
    defaults = [
        ('is_activated', 'false'),
        ('activation_key', 'Space'),
        ('blocked_count', '0'),
        ('admin_password', 'sfsadmin123'),
        ('auto_approve_positive', 'true')
    ]
    for key, val in defaults:
        cursor.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', (key, val))
    conn.commit()
    conn.close()

init_db()

def get_setting(key: str, default: str = "") -> str:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT value FROM settings WHERE key = ?', (key,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return row['value']
    return default

def set_setting(key: str, value: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (key, str(value)))
    conn.commit()
    conn.close()

def increment_blocked_count():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE settings SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'blocked_count'")
    conn.commit()
    conn.close()

def get_local_ip() -> str:
    """Gets the local IP address of the machine to print out the link for student phones."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.254.254.254', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

class Submission(BaseModel):
    name: str = ""
    message: str

class ActivationRequest(BaseModel):
    is_activated: bool

class PasswordVerify(BaseModel):
    password: str

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                if connection in self.active_connections:
                    self.active_connections.remove(connection)

manager = ConnectionManager()

@app.post("/api/submit")
async def submit_message(sub: Submission):
    msg_text = clean_text(sub.message)
    if not msg_text:
        raise HTTPException(status_code=400, detail='Message cannot be empty.')
        
    analysis = analyze_sentiment(msg_text)
    
    if analysis['decision'] == 'rejected':
        student_name = clean_text(sub.name)
        if not student_name:
            student_name = "Anonymous Student"
            
        harm_info = f"{analysis.get('harm_category', 'UNKNOWN')} [{analysis.get('harm_level', '?')}]"
        
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO messages (student_name, message, sentiment, status) VALUES (?, ?, ?, ?)',
            (student_name, msg_text, f"negative|{harm_info}", 'blocked')
        )
        conn.commit()
        conn.close()
        
        increment_blocked_count()
        
        return {
            'status': 'filtered',
            'message': 'Thank you for sharing your thoughts!',
            'details': 'Message was filtered due to community standards.'
        }
        
    auto_approve = get_setting('auto_approve_positive', 'true') == 'true'
    status = 'approved' if auto_approve else 'pending'
    
    student_name = clean_text(sub.name)
    if not student_name:
        student_name = "Anonymous Student"
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO messages (student_name, message, sentiment, status) VALUES (?, ?, ?, ?)',
        (student_name, msg_text, analysis['sentiment'], status)
    )
    msg_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    new_msg_data = {
        'id': msg_id,
        'student_name': student_name,
        'message': msg_text,
        'sentiment': analysis['sentiment'],
        'status': status,
        'created_at': 'Just now'
    }
    
    is_activated = get_setting('is_activated') == 'true'
    if is_activated and status == 'approved':
        await manager.broadcast({
            'type': 'new_message',
            'data': new_msg_data
        })
        
    return {
        'status': 'success',
        'message': 'Your dream has been registered successfully!',
        'auto_approved': status == 'approved'
    }

@app.post("/api/admin/verify")
async def verify_admin(req: PasswordVerify):
    stored_pw = get_setting('admin_password')
    if req.password == stored_pw:
        return {
            'status': 'authenticated',
            'token': 'sfs_secret_session_token'
        }
    else:
        raise HTTPException(status_code=401, detail='Invalid admin password.')

@app.get("/api/admin/messages")
async def get_admin_messages(token: str = None):
    if token != 'sfs_secret_session_token':
        raise HTTPException(status_code=403, detail='Unauthorized access.')
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM messages ORDER BY id DESC')
    rows = cursor.fetchall()
    conn.close()
    
    messages = []
    for r in rows:
        messages.append({
            'id': r['id'],
            'student_name': r['student_name'],
            'message': r['message'],
            'sentiment': r['sentiment'],
            'status': r['status'],
            'created_at': r['created_at']
        })
    return messages

@app.post("/api/admin/approve/{msg_id}")
async def approve_message(msg_id: int, token: str = None):
    if token != 'sfs_secret_session_token':
        raise HTTPException(status_code=403, detail='Unauthorized access.')
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM messages WHERE id = ?', (msg_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail='Message not found.')
        
    cursor.execute("UPDATE messages SET status = 'approved' WHERE id = ?", (msg_id,))
    conn.commit()
    conn.close()
    
    msg_data = {
        'id': row['id'],
        'student_name': row['student_name'],
        'message': row['message'],
        'sentiment': row['sentiment']
    }
    
    is_activated = get_setting('is_activated') == 'true'
    if is_activated:
        await manager.broadcast({
            'type': 'new_message',
            'data': msg_data
        })
        
    return {
        'status': 'success',
        'message': 'Message approved.'
    }

@app.delete("/api/admin/reject/{msg_id}")
async def reject_message(msg_id: int, token: str = None):
    if token != 'sfs_secret_session_token':
        raise HTTPException(status_code=403, detail='Unauthorized access.')
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM messages WHERE id = ?', (msg_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail='Message not found.')
        
    cursor.execute('DELETE FROM messages WHERE id = ?', (msg_id,))
    conn.commit()
    conn.close()
    
    await manager.broadcast({
        'type': 'delete_message',
        'data': {
            'id': msg_id
        }
    })
    
    return {
        'status': 'success',
        'message': 'Message deleted from database.'
    }

@app.get("/api/status")
async def get_tree_status():
    return {
        'is_activated': get_setting('is_activated') == 'true',
        'activation_key': get_setting('activation_key'),
        'auto_approve': get_setting('auto_approve_positive') == 'true'
    }

@app.post("/api/admin/toggle-activation")
async def toggle_activation(req: ActivationRequest, token: str = None):
    state_str = 'true' if req.is_activated else 'false'
    set_setting('is_activated', state_str)
    await manager.broadcast({
        'type': 'activation_state',
        'is_activated': req.is_activated
    })
    return {
        'status': 'success',
        'is_activated': req.is_activated
    }

@app.get("/api/messages")
async def get_approved_messages():
    """Gets approved messages for display initialization."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, student_name, message, sentiment FROM messages WHERE status = 'approved' ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()
    
    messages = []
    for r in rows:
        messages.append({
            'id': r['id'],
            'student_name': r['student_name'],
            'message': r['message'],
            'sentiment': r['sentiment']
        })
    return messages

@app.get("/api/admin/stats")
async def get_admin_stats(token: str = None):
    if token != 'sfs_secret_session_token':
        raise HTTPException(status_code=403, detail='Unauthorized access.')
        
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM messages WHERE status = 'approved'")
    approved = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM messages WHERE status = 'pending'")
    pending = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM messages WHERE status = 'blocked'")
    blocked = cursor.fetchone()[0]
    
    conn.close()
    
    return {
        'total_submitted': approved + pending + blocked,
        'total_approved': approved,
        'total_pending': pending,
        'total_blocked': blocked
    }

@app.post("/api/admin/config")
async def update_config(data: dict, token: str = None):
    if token != 'sfs_secret_session_token':
        raise HTTPException(status_code=403, detail='Unauthorized access.')
        
    if 'activation_key' in data:
        set_setting('activation_key', data['activation_key'])
        
    if 'auto_approve_positive' in data:
        val = 'true' if data['auto_approve_positive'] else 'false'
        set_setting('auto_approve_positive', val)
        
    if 'clear_tree' in data and data['clear_tree']:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM messages')
        conn.commit()
        conn.close()
        set_setting('blocked_count', '0')
        await manager.broadcast({
            'type': 'clear_tree'
        })
        
    return {
        'status': 'success',
        'message': 'Configuration updated.'
    }

@app.post("/api/admin/filter-test")
async def filter_test(data: dict, token: str = None):
    """
    Admin-only endpoint to test the Google-inspired safety filter live.
    POST body: { "message": "some text to test", "token": "sfs_secret_session_token" }
    Returns the full analysis dict including harm_category and harm_level.
    """
    if token != 'sfs_secret_session_token':
        raise HTTPException(status_code=403, detail='Unauthorized access.')
        
    from sentiment_rules import analyze_sentiment, clean_text
    msg = clean_text(data.get('message', ''))
    if not msg:
        raise HTTPException(status_code=400, detail='Message cannot be empty.')
        
    result = analyze_sentiment(msg)
    result['tested_message'] = msg
    return result

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                if payload.get('type') == 'keypress_activation':
                    set_setting('is_activated', 'true')
                    await manager.broadcast({
                        'type': 'activation_state',
                        'is_activated': True
                    })
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/", response_class=HTMLResponse)
async def get_index():
    with open(os.path.join(STATIC_DIR, 'index.html'), 'r', encoding='utf-8') as f:
        return HTMLResponse(content=f.read())

@app.get("/admin", response_class=HTMLResponse)
async def get_admin():
    with open(os.path.join(STATIC_DIR, 'admin.html'), 'r', encoding='utf-8') as f:
        return HTMLResponse(content=f.read())

@app.get("/display", response_class=HTMLResponse)
async def get_display():
    set_setting('is_activated', 'false')
    try:
        await manager.broadcast({
            'type': 'activation_state',
            'is_activated': False
        })
    except Exception:
        pass
    with open(os.path.join(STATIC_DIR, 'display.html'), 'r', encoding='utf-8') as f:
        return HTMLResponse(content=f.read())

app.mount("/static", StaticFiles(directory=STATIC_DIR), name='static')

ip = get_local_ip()
print('============================================================')
print(' SFS COLLEGE DREAM TREE — DEEKSHARAMBHA 2K26')
print('============================================================')
print(f' * STUDENT PORTAL (Scan QR / Open link): http://localhost:8000/  or http://{ip}:8000/')
print(' * ADMIN DASHBOARD (Manage wishes):       http://localhost:8000/admin')
print(' * MAIN DISPLAY (The Dream Tree Visual):  http://localhost:8000/display')
print('============================================================')
