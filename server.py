import os

# Load .env file if it exists
if os.path.exists(".env"):
    with open(".env", "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                parts = line.split("=", 1)
                if len(parts) == 2:
                    os.environ[parts[0].strip()] = parts[1].strip().strip('"').strip("'")

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

# PostgreSQL / TiDB support
DATABASE_URL = os.environ.get("DATABASE_URL")
IS_TIDB = (os.environ.get("TIDB_HOST") is not None) or (DATABASE_URL is not None and ("mysql" in DATABASE_URL or "tidb" in DATABASE_URL))
IS_POSTGRES = (DATABASE_URL is not None) and not IS_TIDB

if IS_POSTGRES:
    import psycopg2
    from psycopg2.extras import RealDictCursor

if IS_TIDB:
    import pymysql

class DatabaseManager:
    def __init__(self):
        self.is_postgres = IS_POSTGRES
        self.is_tidb = IS_TIDB
        self.db_url = DATABASE_URL
        if self.is_postgres and self.db_url and self.db_url.startswith("postgres://"):
            self.db_url = self.db_url.replace("postgres://", "postgresql://", 1)

    def get_conn(self):
        if self.is_tidb:
            if self.db_url and ("mysql" in self.db_url or "tidb" in self.db_url):
                import urllib.parse as urlparse
                url = urlparse.urlparse(self.db_url)
                host = url.hostname
                port = url.port or 4000
                user = urlparse.unquote(url.username) if url.username else None
                password = urlparse.unquote(url.password) if url.password else None
                dbname = urlparse.unquote(url.path.lstrip('/')) if url.path else "dreams"
            else:
                host = os.environ.get("TIDB_HOST")
                port = int(os.environ.get("TIDB_PORT", "4000"))
                user = os.environ.get("TIDB_USER")
                password = os.environ.get("TIDB_PASSWORD")
                dbname = os.environ.get("TIDB_DB_NAME", "dreams")
            
            import ssl
            # Create a default secure SSL Context (trusts system root CAs, works out-of-the-box on Render)
            ssl_ctx = ssl.create_default_context()
            
            # Fallback to custom CA path if provided and exists
            ca_path = os.environ.get("TIDB_CA_PATH")
            if ca_path and os.path.exists(ca_path):
                ssl_ctx.load_verify_locations(cafile=ca_path)
            
            # Support disabling SSL hostname/certificate validation if TIDB_SSL_VERIFY is "false"
            if os.environ.get("TIDB_SSL_VERIFY") == "false":
                ssl_ctx.check_hostname = False
                ssl_ctx.verify_mode = ssl.CERT_NONE

            return pymysql.connect(
                host=host,
                port=port,
                user=user,
                password=password,
                database=dbname,
                ssl=ssl_ctx,
                autocommit=True
            )
        elif self.is_postgres:
            return psycopg2.connect(self.db_url)
        else:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            return conn

    def get_db_host(self) -> str:
        if self.is_tidb:
            if self.db_url and ("mysql" in self.db_url or "tidb" in self.db_url):
                import urllib.parse as urlparse
                try:
                    url = urlparse.urlparse(self.db_url)
                    return url.hostname or "TiDB Cloud"
                except Exception:
                    return "TiDB Cloud"
            return os.environ.get("TIDB_HOST") or "TiDB Cloud"
        elif self.is_postgres:
            if self.db_url:
                import urllib.parse as urlparse
                try:
                    url = urlparse.urlparse(self.db_url)
                    return url.hostname or "PostgreSQL"
                except Exception:
                    return "PostgreSQL"
            return "PostgreSQL"
        else:
            return "SQLite (dreams.db)"

    def init_db(self):
        conn = self.get_conn()
        cursor = conn.cursor()
        if self.is_tidb:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    student_name TEXT,
                    message TEXT NOT NULL,
                    sentiment TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    `key` VARCHAR(255) PRIMARY KEY,
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
                cursor.execute(
                    'INSERT IGNORE INTO settings (`key`, value) VALUES (%s, %s)',
                    (key, val)
                )
        elif self.is_postgres:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id SERIAL PRIMARY KEY,
                    student_name TEXT,
                    message TEXT NOT NULL,
                    sentiment TEXT NOT NULL,
                    status TEXT NOT NULL,
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
                cursor.execute(
                    'INSERT INTO settings (key, value) VALUES (%s, %s) ON CONFLICT (key) DO NOTHING',
                    (key, val)
                )
        else:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student_name TEXT,
                    message TEXT NOT NULL,
                    sentiment TEXT NOT NULL,
                    status TEXT NOT NULL,
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

    def get_setting(self, key: str, default: str = "") -> str:
        conn = self.get_conn()
        cursor = conn.cursor()
        if self.is_tidb:
            cursor.execute('SELECT value FROM settings WHERE `key` = %s', (key,))
            row = cursor.fetchone()
            val = row[0] if row else None
        elif self.is_postgres:
            cursor.execute('SELECT value FROM settings WHERE key = %s', (key,))
            row = cursor.fetchone()
            val = row[0] if row else None
        else:
            cursor.execute('SELECT value FROM settings WHERE key = ?', (key,))
            row = cursor.fetchone()
            val = row['value'] if row else None
        conn.close()
        return val if val is not None else default

    def set_setting(self, key: str, value: str):
        conn = self.get_conn()
        cursor = conn.cursor()
        if self.is_tidb:
            cursor.execute(
                'REPLACE INTO settings (`key`, value) VALUES (%s, %s)',
                (key, str(value))
            )
        elif self.is_postgres:
            cursor.execute(
                'INSERT INTO settings (key, value) VALUES (%s, %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
                (key, str(value))
            )
        else:
            cursor.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (key, str(value)))
        conn.commit()
        conn.close()

    def increment_blocked_count(self):
        conn = self.get_conn()
        cursor = conn.cursor()
        if self.is_tidb:
            cursor.execute("UPDATE settings SET value = CAST(CAST(value AS SIGNED) + 1 AS CHAR) WHERE `key` = 'blocked_count'")
        elif self.is_postgres:
            cursor.execute("UPDATE settings SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'blocked_count'")
        else:
            cursor.execute("UPDATE settings SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'blocked_count'")
        conn.commit()
        conn.close()

    def insert_message(self, student_name: str, message: str, sentiment: str, status: str) -> int:
        conn = self.get_conn()
        cursor = conn.cursor()
        if self.is_tidb:
            cursor.execute(
                'INSERT INTO messages (student_name, message, sentiment, status) VALUES (%s, %s, %s, %s)',
                (student_name, message, sentiment, status)
            )
            msg_id = cursor.lastrowid
        elif self.is_postgres:
            cursor.execute(
                'INSERT INTO messages (student_name, message, sentiment, status) VALUES (%s, %s, %s, %s) RETURNING id',
                (student_name, message, sentiment, status)
            )
            msg_id = cursor.fetchone()[0]
        else:
            cursor.execute(
                'INSERT INTO messages (student_name, message, sentiment, status) VALUES (?, ?, ?, ?)',
                (student_name, message, sentiment, status)
            )
            msg_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return msg_id

    def get_all_messages(self) -> list:
        conn = self.get_conn()
        if self.is_tidb:
            from pymysql.cursors import DictCursor
            cursor = conn.cursor(DictCursor)
        elif self.is_postgres:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
        else:
            cursor = conn.cursor()
        cursor.execute('SELECT * FROM messages ORDER BY id DESC')
        rows = cursor.fetchall()
        conn.close()
        
        messages = []
        for r in rows:
            created_at = r['created_at']
            if not isinstance(created_at, str) and created_at is not None:
                created_at = created_at.isoformat()
            messages.append({
                'id': r['id'],
                'student_name': r['student_name'],
                'message': r['message'],
                'sentiment': r['sentiment'],
                'status': r['status'],
                'created_at': created_at
            })
        return messages

    def approve_message(self, msg_id: int) -> dict:
        conn = self.get_conn()
        if self.is_tidb:
            from pymysql.cursors import DictCursor
            cursor = conn.cursor(DictCursor)
            cursor.execute('SELECT * FROM messages WHERE id = %s', (msg_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                return None
            cursor.execute("UPDATE messages SET status = 'approved' WHERE id = %s", (msg_id,))
        elif self.is_postgres:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute('SELECT * FROM messages WHERE id = %s', (msg_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                return None
            cursor.execute("UPDATE messages SET status = 'approved' WHERE id = %s", (msg_id,))
        else:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM messages WHERE id = ?', (msg_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                return None
            cursor.execute("UPDATE messages SET status = 'approved' WHERE id = ?", (msg_id,))
        conn.commit()
        conn.close()
        return dict(row)

    def reject_message(self, msg_id: int) -> bool:
        conn = self.get_conn()
        cursor = conn.cursor()
        if self.is_tidb:
            cursor.execute('SELECT id FROM messages WHERE id = %s', (msg_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                return False
            cursor.execute('DELETE FROM messages WHERE id = %s', (msg_id,))
        elif self.is_postgres:
            cursor.execute('SELECT id FROM messages WHERE id = %s', (msg_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                return False
            cursor.execute('DELETE FROM messages WHERE id = %s', (msg_id,))
        else:
            cursor.execute('SELECT id FROM messages WHERE id = ?', (msg_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                return False
            cursor.execute('DELETE FROM messages WHERE id = ?', (msg_id,))
        conn.commit()
        conn.close()
        return True

    def get_approved_messages(self) -> list:
        conn = self.get_conn()
        if self.is_tidb:
            from pymysql.cursors import DictCursor
            cursor = conn.cursor(DictCursor)
            cursor.execute("SELECT id, student_name, message, sentiment FROM messages WHERE status = 'approved' ORDER BY id ASC")
        elif self.is_postgres:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT id, student_name, message, sentiment FROM messages WHERE status = 'approved' ORDER BY id ASC")
        else:
            cursor = conn.cursor()
            cursor.execute("SELECT id, student_name, message, sentiment FROM messages WHERE status = 'approved' ORDER BY id ASC")
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_stats(self) -> dict:
        conn = self.get_conn()
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

    def clear_tree(self):
        conn = self.get_conn()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM messages')
        conn.commit()
        conn.close()
        self.set_setting('blocked_count', '0')

db = DatabaseManager()
db.init_db()

# Expose global helpers to avoid changing all calls to db.get_setting
def get_setting(key: str, default: str = "") -> str:
    return db.get_setting(key, default)

def set_setting(key: str, value: str):
    db.set_setting(key, value)

def increment_blocked_count():
    db.increment_blocked_count()

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
        
        db.insert_message(student_name, msg_text, f"negative|{harm_info}", 'blocked')
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
        
    msg_id = db.insert_message(student_name, msg_text, analysis['sentiment'], status)
    
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
        
    return db.get_all_messages()

@app.post("/api/admin/approve/{msg_id}")
async def approve_message(msg_id: int, token: str = None):
    if token != 'sfs_secret_session_token':
        raise HTTPException(status_code=403, detail='Unauthorized access.')
        
    row = db.approve_message(msg_id)
    if not row:
        raise HTTPException(status_code=404, detail='Message not found.')
        
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
        
    success = db.reject_message(msg_id)
    if not success:
        raise HTTPException(status_code=404, detail='Message not found.')
        
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

@app.get("/api/db-info")
async def get_db_info():
    return {
        'host': db.get_db_host(),
        'is_tidb': db.is_tidb,
        'is_postgres': db.is_postgres
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
    return db.get_approved_messages()

@app.get("/api/admin/stats")
async def get_admin_stats(token: str = None):
    if token != 'sfs_secret_session_token':
        raise HTTPException(status_code=403, detail='Unauthorized access.')
        
    return db.get_stats()

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
        db.clear_tree()
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
    with open(os.path.join(STATIC_DIR, 'display.html'), 'r', encoding='utf-8') as f:
        return HTMLResponse(content=f.read())

@app.get("/display-only", response_class=HTMLResponse)
@app.get("/display_only", response_class=HTMLResponse)
async def get_display_only():
    with open(os.path.join(STATIC_DIR, 'display_only.html'), 'r', encoding='utf-8') as f:
        return HTMLResponse(content=f.read())

app.mount("/static", StaticFiles(directory=STATIC_DIR), name='static')

ip = get_local_ip()
print('============================================================')
print(' SFS COLLEGE DREAM TREE — DEEKSHARAMBHA 2K26')
print('============================================================')
print(f' * STUDENT PORTAL (Scan QR / Open link): http://localhost:8000/  or http://{ip}:8000/')
print(' * ADMIN DASHBOARD (Manage wishes):       http://localhost:8000/admin')
print(' * MAIN DISPLAY (The Dream Tree Visual):  http://localhost:8000/display')
print(' * DISPLAY ONLY (Non-Interactive):        http://localhost:8000/display-only')
print('============================================================')
