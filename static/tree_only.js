// SFS College Dream Tree — Cinematic Banyan Animation (Display Only, Non-Interactive)
// Sequence: Logo (3s) → Seed → Seedling → [wait 1.5s] → Banyan Tree → Leaves + Messages + Color Cycling

// ─── Sound Synthesizer ────────────────────────────────────────────────────────
class SoundSynth {
    constructor() { this.ctx = null; }

    init() {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    playInaugurationBoom() {
        this.init();
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(100, now);
        osc1.frequency.exponentialRampToValueAtTime(30, now + 1.5);
        gain1.gain.setValueAtTime(0.8, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 1.8);
        osc1.connect(gain1); gain1.connect(this.ctx.destination);
        osc1.start(now); osc1.stop(now + 2.0);
        for (let i = 0; i < 8; i++) this.playChimeNode(450 + i * 200, now + i * 0.15, 0.18);
    }

    playChimeNode(freq, startTime, duration) {
        const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(startTime); osc.stop(startTime + duration);
    }

    playChime() {
        this.init();
        const now = this.ctx.currentTime;
        const notes = [523.25, 587.33, 659.25, 783.99, 880.00];
        this.playChimeNode(notes[Math.floor(Math.random() * notes.length)], now, 0.6);
    }

    playCardWhoosh() {
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.35);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(250, now);
        filter.frequency.exponentialRampToValueAtTime(1000, now + 0.35);
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
        osc.start(now); osc.stop(now + 0.4);
    }

    playGrowth() {
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 3.5);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.06, now + 0.4);
        gain.gain.linearRampToValueAtTime(0.08, now + 2.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 3.8);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(now); osc.stop(now + 4);
        // Cascade chimes at peak
        for (let i = 0; i < 12; i++) this.playChimeNode(300 + i * 120, now + 3.0 + i * 0.12, 0.5);
    }
}

const synth = new SoundSynth();

// ─── Cinematic Banyan Dream Tree ───────────────────────────────────────────────
class BorderDreamTree {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.isActivated   = false;
        this.activationKey = 'Space';
        this.activationProgress = 0;

        // Stages: blank → welcome → logo_active → seed → seedling → seedling_wait → growing → title → raining
        this.activationStage = 'blank';

        this.stars    = [];
        this.sparkles = [];
        this.canopyLeaves  = [];   // dense foliage pool for message plucking
        this.borderLeaves  = [];   // static canopy edge leaves

        // Seed / seedling / growth progress (0→1)
        this.seedProgress     = 0;
        this.seedlingProgress = 0;
        this.treeProgress     = 0;

        // Color cycling
        this.treeHue       = 100;   // start green
        this.hueTarget     = 100;
        this.hueCycleTimer = 0;

        // Message queue
        this.messageQueue = [];
        this.carouselIndex = 0;

        // Timer settings
        this.timerDuration = 75; // 1 min 15 sec
        this.elapsedSeconds = 0;
        this.timerActive = false;
        this.timerTimeout = null;
        this.endProgress = 0;

        this.resize();
        window.addEventListener('resize', () => { this.resize(); this.generateCanopyLeaves(); });

        this.createStars();
        this.generateCanopyLeaves();

        setTimeout(() => {
            if (this.activationStage === 'blank' && !this.isActivated) {
                this.activationStage = 'welcome';
                if (typeof showPrompt === 'function') showPrompt();
            }
        }, 1200);
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width  = window.innerWidth  * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.ctx.scale(dpr, dpr);
        this.width  = window.innerWidth;
        this.height = window.innerHeight;
    }

    createStars() {
        this.stars = [];
        for (let i = 0; i < 90; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size:  Math.random() * 1.5 + 0.5,
                alpha: Math.random() * 0.7 + 0.3,
                speed: Math.random() * 0.01 + 0.005
            });
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  Canopy leaf pool  (used for raining-stage message plucking)
    // ──────────────────────────────────────────────────────────────────────────
    generateCanopyLeaves() {
        this.canopyLeaves = [];
        const cx = this.width / 2;
        const cy = this.height * 0.38;
        const rx = Math.min(this.width * 0.34, 400);
        const ry = Math.min(this.height * 0.27, 155);

        // Increased to 350 leaves for highly lush line-art detail
        for (let i = 0; i < 350; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * 0.88;
            const lx = cx + rx * r * Math.cos(angle);
            const ly = cy + ry * r * Math.sin(angle);
            this.canopyLeaves.push({
                id: i, x: lx, y: ly,
                origX: lx, origY: ly,
                size: Math.random() * 5 + 9,
                color: ['rgba(0,242,254,0.5)', 'rgba(217,70,239,0.5)', 'rgba(16,185,129,0.5)'][i % 3],
                angle: angle + Math.PI / 2 + (Math.random() - 0.5),
                pulseSpeed: Math.random() * 0.02 + 0.01,
                offset: Math.random() * Math.PI,
                isPlucked: false, wish: null,
                currentX: lx, currentY: ly,
                vx: 0, vy: 0,
                swayAngle: Math.random() * Math.PI * 2,
                swaySpeed: 0.003 + Math.random() * 0.006,
                swayWidth: 4 + Math.random() * 8,
                opacity: 0, lifetime: 0,
                maxLifetime: 240, // default batch duration
                angleVelocity: (Math.random() - 0.5) * 0.012,
                palette: null, msgLines: null, nameStr: null,
                fontSize: 12, lineHeight: 13, leafW: 100, leafH: 50,
                delay: 0
            });
        }

        // Border accent leaves (drawn as outlines on the canopy boundary)
        this.borderLeaves = [];
        const numBorder = 80;
        const startA = 0.76 * Math.PI, span = 1.48 * Math.PI;
        for (let i = 0; i < numBorder; i++) {
            const a = startA + (i / numBorder) * span + (Math.random() - 0.5) * 0.05;
            const dx = Math.cos(a), dy = Math.sin(a);
            const bx = cx + rx * dx, by = cy + ry * dy;
            const len = Math.sqrt(dx * dx + dy * dy);
            const off = 55 + Math.sin(i * 1.5) * 10;
            this.borderLeaves.push({
                x: bx + (dx / len) * off,
                y: by + (dy / len) * off,
                size: Math.random() * 7 + 10,
                color: ['rgba(0,242,254,0.45)', 'rgba(217,70,239,0.45)', 'rgba(16,185,129,0.45)'][i % 3],
                angle: a + Math.PI / 2 + (Math.random() - 0.5) * 0.5,
                pulseSpeed: Math.random() * 0.02 + 0.01,
                offset: Math.random() * Math.PI
            });
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  Activation sequence
    // ──────────────────────────────────────────────────────────────────────────
    activate() {
        if (this.isActivated) return;
        this.isActivated = true;
        this.activationStage = 'logo_active';
    }

    startTimer(offsetSeconds = 0) {
        if (this.timerActive) return;
        this.timerActive = true;
        this.elapsedSeconds = Math.max(0, Math.floor(offsetSeconds));
        
        if (this.timerTimeout) clearTimeout(this.timerTimeout);

        const tick = () => {
            if (!this.timerActive) return;
            this.elapsedSeconds++;
            if (this.elapsedSeconds >= this.timerDuration) {
                this.endInauguration();
            } else {
                this.timerTimeout = setTimeout(tick, 1000);
            }
        };
        this.timerTimeout = setTimeout(tick, 1000);
    }

    endInauguration() {
        this.timerActive = false;
        this.activationStage = 'ended';
        this.endProgress = 0;

        // Hide HUD overlay, watermark, and sound buttons
        const hud = document.getElementById('hud-header');
        if (hud) hud.style.opacity = '0';

        const wm = document.getElementById('logo-watermark');
        if (wm) wm.classList.remove('visible');

        const soundBtn = document.getElementById('sound-btn');
        if (soundBtn) {
            soundBtn.style.opacity = '0';
            soundBtn.style.pointerEvents = 'none';
        }
    }

    drawGoldText(ctx, opacity) {
        const W = this.width, H = this.height;
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // High-end premium gold metallic gradient
        const grad = ctx.createLinearGradient(W/2 - 300, H/2, W/2 + 300, H/2);
        grad.addColorStop(0, '#FFE082');   // light gold
        grad.addColorStop(0.25, '#FFD54F'); // gold
        grad.addColorStop(0.5, '#FFC107');  // amber gold
        grad.addColorStop(0.75, '#FFA000'); // dark gold
        grad.addColorStop(1, '#FF8F00');    // deep gold

        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(255, 193, 7, 0.65)';
        ctx.shadowBlur = 35;

        // Responsive font size based on window width
        const fontSize = Math.min(72, Math.max(32, W * 0.06));
        ctx.font = '800 ' + fontSize + 'px "Playfair Display", serif';
        ctx.fillText('DEEKSHARAMBHA 2K26', W / 2, H / 2);

        ctx.restore();
    }

    /** Called after the 3-second logo countdown */
    startSeedSequence() {
        this.activationStage = 'seed';
        this.seedProgress = 0;
        synth.playInaugurationBoom();
        this._animateSeed();
    }

    _animateSeed() {
        const dur = 2000;
        const t0 = performance.now();
        const run = (now) => {
            this.seedProgress = Math.max(0, Math.min(1, (now - t0) / dur));
            // sprinkle sparkles around the seed
            if (this.seedProgress < 1 && Math.random() < 0.25) {
                const ang = Math.random() * Math.PI * 2;
                const r = 55 + Math.random() * 35;
                const cx = this.width / 2, cy = this.height * 0.52;
                this.createSparkle(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r,
                    `rgba(${220 + Math.floor(Math.random()*35)},${130 + Math.floor(Math.random()*60)},20,0.9)`, 1);
            }
            if (this.seedProgress < 1) requestAnimationFrame(run);
            else { this.activationStage = 'seedling'; this.seedlingProgress = 0; this._animateSeedling(); }
        };
        requestAnimationFrame(run);
    }

    _animateSeedling() {
        const dur = 6000;
        const t0 = performance.now();
        const run = (now) => {
            this.seedlingProgress = Math.max(0, Math.min(1, (now - t0) / dur));
            if (this.seedlingProgress < 1 && Math.random() < 0.14) {
                const cx = this.width / 2;
                const groundY = this.height * 0.72;
                const stemH = this.seedlingProgress * (groundY - this.height * 0.28);
                this.createSparkle(
                    cx + (Math.random() - 0.5) * 80,
                    groundY - stemH * Math.random(),
                    'rgba(60,220,80,0.9)', 1);
            }
            if (this.seedlingProgress < 1) requestAnimationFrame(run);
            else {
                this.activationStage = 'seedling_wait';
                // 2-second pause on the seedling
                setTimeout(() => {
                    this.activationStage = 'growing';
                    this.treeProgress = 0;
                    synth.playGrowth();
                    this._animateBanyanGrowth();
                }, 2000);
            }
        };
        requestAnimationFrame(run);
    }

    _animateBanyanGrowth() {
        const dur = 19000;
        const t0 = performance.now();
        const cx = this.width / 2, cy = this.height * 0.38;
        const rx = Math.min(this.width * 0.34, 400);
        const ry = Math.min(this.height * 0.27, 155);
        const run = (now) => {
            this.treeProgress = Math.max(0, Math.min(1, (now - t0) / dur));
            if (this.treeProgress < 1 && Math.random() < 0.7) {
                const a = Math.random() * Math.PI * 2;
                const r = 0.6 + Math.random() * 0.45;
                this.createSparkle(
                    cx + rx * r * Math.cos(a), cy + ry * r * Math.sin(a),
                    ['rgba(0,255,100,0.9)', 'rgba(100,255,50,0.9)', 'rgba(0,200,150,0.9)'][Math.floor(Math.random() * 3)], 2);
            }
            if (this.treeProgress < 1) requestAnimationFrame(run);
            else {
                this.activationStage = 'title';
                if (typeof activateTitle === 'function') activateTitle();
                setTimeout(() => {
                    this.activationStage = 'raining';
                    this.rainQueuedWishes();
                }, 1500);
            }
        };
        requestAnimationFrame(run);
    }

    createSparkle(x, y, color, count = 4) {
        for (let i = 0; i < count; i++) {
            this.sparkles.push({
                x, y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6 - 1,
                size: Math.random() * 3.5 + 1,
                alpha: 1.0,
                color: color || 'rgba(0,242,254,0.8)',
                decay: Math.random() * 0.03 + 0.015
            });
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  Bezier helpers
    // ──────────────────────────────────────────────────────────────────────────
    getBezierPoint(p0, p1, p2, p3, t) {
        const m = 1 - t;
        return {
            x: m*m*m*p0.x + 3*m*m*t*p1.x + 3*m*t*t*p2.x + t*t*t*p3.x,
            y: m*m*m*p0.y + 3*m*m*t*p1.y + 3*m*t*t*p2.y + t*t*t*p3.y
        };
    }

    getBezierSegment(p0, p1, p2, p3, t) {
        if (t <= 0) return { p0, p1: p0, p2: p0, p3: p0 };
        if (t >= 1) return { p0, p1, p2, p3 };
        const p01  = {x: p0.x+t*(p1.x-p0.x), y: p0.y+t*(p1.y-p0.y)};
        const p12  = {x: p1.x+t*(p2.x-p1.x), y: p1.y+t*(p2.y-p1.y)};
        const p23  = {x: p2.x+t*(p3.x-p2.x), y: p2.y+t*(p3.y-p2.y)};
        const p012 = {x: p01.x+t*(p12.x-p01.x), y: p01.y+t*(p12.y-p01.y)};
        const p0123= {x: p012.x+t*({x:p12.x+t*(p23.x-p12.x), y:p12.y+t*(p23.y-p12.y)}.x-p012.x), y: p012.y+t*({x:p12.x+t*(p23.x-p12.x), y:p12.y+t*(p23.y-p12.y)}.y-p012.y)};
        return { p0, p1: p01, p2: p012, p3: p0123 };
    }

    getQuadraticSegment(p0, p1, p2, t) {
        if (t <= 0) return { p0, p1: p0, p2: p0 };
        if (t >= 1) return { p0, p1, p2 };
        const p01  = {x: p0.x+t*(p1.x-p0.x), y: p0.y+t*(p1.y-p0.y)};
        const p12  = {x: p1.x+t*(p2.x-p1.x), y: p1.y+t*(p2.y-p1.y)};
        return { p0, p1: p01, p2: {x: p01.x+t*(p12.x-p01.x), y: p01.y+t*(p12.y-p01.y)} };
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  Message system
    // ──────────────────────────────────────────────────────────────────────────
    get9Positions() {
        const W = this.width, H = this.height;
        const positions = [];
        
        // 3x3 Grid: Row 1 Y=0.22, Row 2 Y=0.48, Row 3 Y=0.72
        // Columns: Left X=0.20, Center X=0.50, Right X=0.80
        const rows = [H * 0.22, H * 0.48, H * 0.72];
        const cols = [W * 0.20, W * 0.50, W * 0.80];
        
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                positions.push({
                    x: cols[c],
                    y: rows[r]
                });
            }
        }
        return positions;
    }

    addWish(wish) {
        if (!this.allWishes) this.allWishes = [];
        if (!this.allWishes.some(w => w.id === wish.id)) {
            this.allWishes.push(wish);
        }
        if (!this.messageQueue.some(w => w.id === wish.id) &&
            !this.canopyLeaves.some(l => l.isPlucked && l.wish && l.wish.id === wish.id)) {
            this.messageQueue.push(wish);
        }
    }

    pluckLeafWithMessage(wish, slotIndex, delay) {
        const available = this.canopyLeaves.filter(l => !l.isPlucked);
        if (available.length === 0) return null;

        synth.playChime();
        const leaf = available[Math.floor(Math.random() * available.length)];
        const pos = this.get9Positions()[slotIndex];

        const len = wish.message.length;
        let fontSize = 18.0, lineHeight = 20.0, wrapChars = 23, scale = 1.05;
        if (len <= 40)      { fontSize = 24.0; lineHeight = 26.0; wrapChars = 15; scale = 0.9; }
        else if (len <= 80) { fontSize = 21.0; lineHeight = 23.0; wrapChars = 19; scale = 1.0; }

        const nameStr = '';
        const nameH = 0;
        const gap = 0;
        const msgLines = this.wrapText(wish.message, wrapChars);
        const textHeight = nameH + gap + msgLines.length * lineHeight;

        // Fixed leaf dimensions for uniform sizing
        const finalLeafH = 140;
        const finalLeafW = 260;

        const h = this.treeHue;
        const palette = {
            fill: `hsla(${h},72%,14%,0.88)`,
            glow: `hsla(${h},95%,60%,0.92)`,
            vein: `rgba(220,255,200,0.5)`
        };

        leaf.isPlucked  = true;
        leaf.wish       = wish;
        leaf.palette    = palette;
        leaf.msgLines   = msgLines;
        leaf.nameStr    = nameStr;
        leaf.fontSize   = fontSize;
        leaf.lineHeight = lineHeight;
        leaf.leafW      = finalLeafW;
        leaf.leafH      = finalLeafH;
        leaf.nameH      = nameH;
        leaf.gap        = gap;
        
        // Save original position to return to canopy when recycled
        leaf.origX      = leaf.x;
        leaf.origY      = leaf.y;
        
        leaf.x          = pos.x;
        leaf.y          = pos.y;
        leaf.currentX   = pos.x;
        leaf.currentY   = pos.y;
        leaf.vx         = 0;
        leaf.vy         = 0;
        leaf.opacity    = 0;
        leaf.lifetime   = 0;
        leaf.delay      = delay;
        leaf.maxLifetime = 240; // 4.0s (0.5s fade-in, 3s visible, 0.5s fade-out)
        leaf.swayAngle  = 0;
        leaf.swaySpeed  = 0;
        leaf.swayWidth  = 0;
        leaf.angleVelocity = 0;
        leaf.angle = 0;

        return leaf;
    }

    wrapText(text, maxChars) {
        const words = text.split(' ');
        const lines = [];
        let cur = '';
        words.forEach(w => {
            if ((cur + ' ' + w).trim().length <= maxChars) { cur = (cur + ' ' + w).trim(); }
            else { lines.push(cur); cur = w; }
        });
        if (cur) lines.push(cur);
        return lines;
    }

    rainQueuedWishes() {
        this.currentBatchLeaves = [];

        const process = () => {
            if (this.activationStage !== 'raining') {
                setTimeout(process, 500);
                return;
            }

            // Check if current batch is still active
            const activeBatch = this.currentBatchLeaves.filter(l => l.isPlucked && l.wish);
            if (activeBatch.length > 0) {
                setTimeout(process, 100);
                return;
            }

            // Clear finished batch references
            if (this.currentBatchLeaves.length > 0) {
                this.currentBatchLeaves = [];
            }

            // Refill queue from cache if empty to run infinite loop
            if (this.messageQueue.length === 0 && this.allWishes && this.allWishes.length > 0) {
                this.messageQueue = [...this.allWishes];
            }

            // Spawn next batch immediately (0s gap)
            if (this.messageQueue.length > 0) {
                const batchSize = Math.min(9, this.messageQueue.length);
                this.currentBatchLeaves = [];
                for (let i = 0; i < batchSize; i++) {
                    const wish = this.messageQueue.shift();
                    const leaf = this.pluckLeafWithMessage(wish, i, i * 12); // stagger by 12 frames (0.2s)
                    if (leaf) {
                        this.currentBatchLeaves.push(leaf);
                    }
                }
            } else if (this.canopyLeaves.filter(l => l.isPlucked).length === 0) {
                // Try fetching again in case DB changed
                loadExistingMessages();
            }

            setTimeout(process, 200);
        };
        process();
    }

    deleteWish(id) {
        this.canopyLeaves.forEach(l => {
            if (l.isPlucked && l.wish && l.wish.id === id) { 
                l.isPlucked = false; 
                l.wish = null; 
                if (l.origX !== undefined) l.x = l.origX;
                if (l.origY !== undefined) l.y = l.origY;
            }
        });
        this.messageQueue = this.messageQueue.filter(w => w.id !== id);
        if (this.allWishes) this.allWishes = this.allWishes.filter(w => w.id !== id);
    }

    clearTree() {
        this.canopyLeaves.forEach(l => { 
            l.isPlucked = false; 
            l.wish = null; 
            if (l.origX !== undefined) l.x = l.origX;
            if (l.origY !== undefined) l.y = l.origY;
        });
        this.messageQueue = [];
        this.allWishes = [];
        messagesLoaded = false;
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  Drawing utilities
    // ──────────────────────────────────────────────────────────────────────────
    drawStars(ctx) {
        this.stars.forEach(s => {
            s.alpha += (Math.random() < 0.5 ? 1 : -1) * s.speed;
            s.alpha = Math.max(0.05, Math.min(0.95, s.alpha));
            ctx.fillStyle = `rgba(220,230,255,${s.alpha})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    drawSketchLeaf(ctx, x, y, size, color, angle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Faint semi-transparent dark center mask
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.bezierCurveTo(size * 0.6, -size * 0.4, size * 0.6, size * 0.4, 0, size);
        ctx.bezierCurveTo(-size * 0.6, size * 0.4, -size * 0.6, -size * 0.4, 0, -size);
        ctx.fillStyle = 'rgba(7, 8, 20, 0.72)';
        ctx.fill();

        // Outline stroke
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.3;
        ctx.stroke();

        // Central vein
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.85);
        ctx.lineTo(0, size * 0.85);
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        ctx.restore();
    }

    drawOutlineCurve(ctx, points, width, color, fillOpacity = 0.85) {
        if (points.length < 2) return;
        const leftPts = [];
        const rightPts = [];
        for (let i = 0; i < points.length; i++) {
            let dx, dy;
            if (i === 0) {
                dx = points[1].x - points[0].x;
                dy = points[1].y - points[0].y;
            } else if (i === points.length - 1) {
                dx = points[points.length - 1].x - points[points.length - 2].x;
                dy = points[points.length - 1].y - points[points.length - 2].y;
            } else {
                dx = points[i + 1].x - points[i - 1].x;
                dy = points[i - 1].y - points[i + 1].y; // wait, let's keep original math from tree.js
                // Let's use the exact original lines:
                // dy = points[i + 1].y - points[i - 1].y; (from line 587)
                dy = points[i + 1].y - points[i - 1].y;
            }
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            const w = (typeof width === 'function') ? width(i / (points.length - 1)) : width;
            leftPts.push({ x: points[i].x + nx * w/2, y: points[i].y + ny * w/2 });
            rightPts.push({ x: points[i].x - nx * w/2, y: points[i].y - ny * w/2 });
        }
        
        ctx.beginPath();
        ctx.moveTo(leftPts[0].x, leftPts[0].y);
        for (let i = 1; i < leftPts.length; i++) {
            ctx.lineTo(leftPts[i].x, leftPts[i].y);
        }
        for (let i = rightPts.length - 1; i >= 0; i--) {
            ctx.lineTo(rightPts[i].x, rightPts[i].y);
        }
        ctx.closePath();
        if (fillOpacity > 0) {
            ctx.fillStyle = `rgba(7, 8, 20, ${fillOpacity})`;
            ctx.fill();
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.3;
        ctx.stroke();
    }

    getGrowingPoints(points, pGrow) {
        if (pGrow <= 0) return [];
        if (pGrow >= 1) return points;
        const count = points.length;
        const indexFloat = pGrow * (count - 1);
        const idx = Math.floor(indexFloat);
        const result = points.slice(0, idx + 1);
        const remainder = indexFloat - idx;
        if (idx < count - 1 && remainder > 0) {
            const last = points[idx];
            const next = points[idx + 1];
            result.push({
                x: last.x + (next.x - last.x) * remainder,
                y: last.y + (next.y - last.y) * remainder
            });
        }
        return result;
    }

    drawCordateLeaf(ctx, bx, by, size, angle, color, pLeaf) {
        if (pLeaf <= 0) return;
        const s = size * pLeaf;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(angle);

        // 1. Faint masking fill behind leaf outline
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-s * 0.4, s * 0.15, -s * 0.75, -s * 0.2, -s * 0.65, -s * 0.55);
        ctx.bezierCurveTo(-s * 0.55, -s * 0.8, -s * 0.2, -s * 0.95, 0, -s);
        ctx.bezierCurveTo(s * 0.2, -s * 0.95, s * 0.55, -s * 0.8, s * 0.65, -s * 0.55);
        ctx.bezierCurveTo(s * 0.75, -s * 0.2, s * 0.4, s * 0.15, 0, 0);
        ctx.closePath();
        ctx.fillStyle = 'rgba(7, 8, 20, 0.85)';
        ctx.fill();

        // 2. Leaf Outline stroke
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 3. Central Vein
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -s * 0.95);
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.9;
        ctx.stroke();

        // 4. Lateral Veins
        ctx.lineWidth = 0.7;
        const numVeins = 3;
        for (let i = 1; i <= numVeins; i++) {
            const vFactor = i / (numVeins + 0.8);
            const vy = -s * vFactor;
            const vLen = s * 0.42 * (1 - vFactor * 0.5);
            const vAngle = 0.5;

            // Left lateral vein
            ctx.beginPath();
            ctx.moveTo(0, vy);
            ctx.quadraticCurveTo(-vLen * 0.5, vy - vLen * 0.15, -vLen * Math.cos(vAngle), vy - vLen * Math.sin(vAngle));
            ctx.stroke();

            // Right lateral vein
            ctx.beginPath();
            ctx.moveTo(0, vy);
            ctx.quadraticCurveTo(vLen * 0.5, vy - vLen * 0.15, vLen * Math.cos(vAngle), vy - vLen * Math.sin(vAngle));
            ctx.stroke();
        }

        ctx.restore();
    }

    drawLanceolateLeaf(ctx, bx, by, size, angle, color, pLeaf) {
        if (pLeaf <= 0) return;
        const s = size * pLeaf;
        const w = s * 0.35; // narrow leaf width
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(angle);

        // 1. Semi-transparent dark mask fill
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-w, -s * 0.3, -w, -s * 0.7, 0, -s);
        ctx.bezierCurveTo(w, -s * 0.7, w, -s * 0.3, 0, 0);
        ctx.closePath();
        ctx.fillStyle = 'rgba(7, 8, 20, 0.85)';
        ctx.fill();

        // 2. Outline stroke
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 3. Central Vein
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -s * 0.95);
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.9;
        ctx.stroke();

        // 4. Lateral Veins
        ctx.lineWidth = 0.7;
        const numVeins = 4;
        for (let i = 1; i <= numVeins; i++) {
            const vFactor = i / (numVeins + 0.8);
            const vy = -s * vFactor;
            const vLen = w * 0.85 * (1 - vFactor * 0.4);
            const vAngle = 0.45;

            // Left lateral vein
            ctx.beginPath();
            ctx.moveTo(0, vy);
            ctx.quadraticCurveTo(-vLen * 0.5, vy - vLen * 0.2, -vLen * Math.cos(vAngle), vy - vLen * Math.sin(vAngle));
            ctx.stroke();

            // Right lateral vein
            ctx.beginPath();
            ctx.moveTo(0, vy);
            ctx.quadraticCurveTo(vLen * 0.5, vy - vLen * 0.2, vLen * Math.cos(vAngle), vy - vLen * Math.sin(vAngle));
            ctx.stroke();
        }

        ctx.restore();
    }

    drawPebble(ctx, x, y, r, color) {
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.6, Math.PI * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(7, 8, 20, 0.85)';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.stroke();
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  STAGE: Seed
    // ──────────────────────────────────────────────────────────────────────────
    drawSeed(ctx) {
        const cx = this.width / 2;
        const cy = this.height * 0.88 - 14;
        const p  = this.seedProgress;

        // Warm halo
        const glowR = 55 + p * 75;
        const halo  = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
        halo.addColorStop(0, `rgba(210,150,25,${0.5 * Math.sin(p * Math.PI)})`);
        halo.addColorStop(1, 'rgba(210,150,25,0)');
        ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
        ctx.fillStyle = halo; ctx.fill();

        ctx.save(); ctx.translate(cx, cy);

        const appear = Math.min(1, p * 2.5);
        const seedW = 30 * appear, seedH = 48 * appear;

        // Seed body
        ctx.beginPath();
        ctx.ellipse(0, 0, seedW, seedH, 0, 0, Math.PI * 2);
        const gr = ctx.createRadialGradient(-8, -17, 2, 0, 5, seedH);
        gr.addColorStop(0,    '#f7e08a');
        gr.addColorStop(0.35, '#c8881a');
        gr.addColorStop(0.75, '#7A4511');
        gr.addColorStop(1,    '#4A2A0A');
        ctx.fillStyle = gr;
        ctx.shadowBlur = 22; ctx.shadowColor = 'rgba(200,130,20,0.7)';
        ctx.fill(); ctx.shadowBlur = 0;

        // Highlight
        ctx.beginPath();
        ctx.ellipse(-9, -17, 8 * appear, 13 * appear, -0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,250,200,${0.35 * appear})`; ctx.fill();

        // Root nub
        if (p > 0.45) {
            const rp = (p - 0.45) / 0.55;
            ctx.strokeStyle = `rgba(90,55,20,${rp})`;
            ctx.lineWidth = 2; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, seedH);
            ctx.bezierCurveTo(6, seedH + 9, -4, seedH + 16 * rp, 0, seedH + 24 * rp);
            ctx.stroke();
        }

        ctx.restore();
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  STAGE: Seedling
    // ──────────────────────────────────────────────────────────────────────────
    drawSeedling(ctx) {
        const cx      = this.width / 2;
        const groundY = this.height * 0.88;
        const p       = this.seedlingProgress;
        const color   = 'rgba(16, 185, 129, 0.95)'; // Glowing emerald green outline

        // Base coordinates
        const baseY = groundY - 14;

        // ────────────────────────────── 1. Pebble Mound
        const soilOpacity = Math.min(1, p * 3);
        ctx.save();
        ctx.globalAlpha = soilOpacity;

        const pebbleSeeds = [
            { dx: -55, dy: 3, r: 6 }, { dx: -45, dy: 1, r: 5 }, { dx: -35, dy: -2, r: 6 },
            { dx: -25, dy: -4, r: 5 }, { dx: -15, dy: -5, r: 6 }, { dx: -5, dy: -6, r: 6 },
            { dx: 5, dy: -6, r: 5 }, { dx: 15, dy: -5, r: 6 }, { dx: 25, dy: -4, r: 6 },
            { dx: 35, dy: -2, r: 5 }, { dx: 45, dy: 1, r: 6 }, { dx: 55, dy: 3, r: 5 },
            { dx: -60, dy: 6, r: 5 }, { dx: -50, dy: 5, r: 6 }, { dx: -40, dy: 3, r: 6 },
            { dx: -30, dy: 2, r: 7 }, { dx: -20, dy: 1, r: 6 }, { dx: -10, dy: 0, r: 7 },
            { dx: 0, dy: 0, r: 6 }, { dx: 10, dy: 0, r: 7 }, { dx: 20, dy: 1, r: 6 },
            { dx: 30, dy: 2, r: 6 }, { dx: 40, dy: 3, r: 7 }, { dx: 50, dy: 5, r: 6 },
            { dx: 60, dy: 6, r: 5 }
        ];

        pebbleSeeds.forEach(pb => {
            ctx.beginPath();
            ctx.arc(cx + pb.dx, groundY + pb.dy - 3, pb.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(7, 8, 20, 0.9)';
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.3;
            ctx.stroke();
        });

        ctx.restore();

        // ────────────────────────────── 2. Seed Fading Out
        const seedOp = Math.max(0, 1 - p * 3.5);
        if (seedOp > 0) {
            ctx.save();
            ctx.translate(cx, baseY - 6);
            ctx.globalAlpha = seedOp;
            ctx.beginPath();
            ctx.ellipse(0, 0, 14, 21, 0, 0, Math.PI * 2);
            const sg = ctx.createRadialGradient(-3, -6, 1, 0, 0, 16);
            sg.addColorStop(0, '#f7e08a');
            sg.addColorStop(1, '#7A4511');
            ctx.fillStyle = sg;
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'rgba(200,130,20,0.5)';
            ctx.fill();
            ctx.restore();
        }

        // ────────────────────────────── 3. Roots under the trunk base
        if (p > 0.05) {
            const pRoot = Math.min(1, (p - 0.05) / 0.35);
            const root1 = [
                { x: cx - 2, y: baseY },
                { x: cx - 8, y: baseY + 7 },
                { x: cx - 14, y: baseY + 13 }
            ];
            const root2 = [
                { x: cx - 1, y: baseY },
                { x: cx - 3, y: baseY + 9 },
                { x: cx - 5, y: baseY + 17 }
            ];
            const root3 = [
                { x: cx + 1, y: baseY },
                { x: cx + 3, y: baseY + 9 },
                { x: cx + 5, y: baseY + 17 }
            ];
            const root4 = [
                { x: cx + 2, y: baseY },
                { x: cx + 8, y: baseY + 7 },
                { x: cx + 14, y: baseY + 13 }
            ];

            [root1, root2, root3, root4].forEach(pts => {
                const grownPts = this.getGrowingPoints(pts, pRoot);
                this.drawOutlineCurve(ctx, grownPts, 3, color, 0.8);
            });
        }

        // ────────────────────────────── 4. Trunk / Stem
        const stemP = Math.min(1, p / 0.7);
        const maxH = 175;
        const currentH = stemP * maxH;

        let stemPoints = [];
        const steps = 25;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const yVal = baseY - t * currentH;
            const xVal = cx + Math.sin(t * Math.PI * 1.5) * 5;
            stemPoints.push({ x: xVal, y: yVal });
        }

        if (stemP > 0) {
            this.drawOutlineCurve(ctx, stemPoints, (t) => 7 - t * 3.5, color, 0.85);
        }

        // ────────────────────────────── 5. Leaf Growth
        const leafSpecs = [
            {
                name: 'lower-left',
                p0: { x: cx + 5, y: baseY - 65 },
                p1: { x: cx - 15, y: baseY - 70 },
                p2: { x: cx - 35, y: baseY - 68 },
                size: 38,
                angle: -Math.PI * 0.7,
                startP: 0.22, endP: 0.58
            },
            {
                name: 'middle-right',
                p0: { x: cx + 3, y: baseY - 95 },
                p1: { x: cx + 20, y: baseY - 90 },
                p2: { x: cx + 38, y: baseY - 92 },
                size: 40,
                angle: Math.PI * 0.65,
                startP: 0.35, endP: 0.7
            },
            {
                name: 'upper-left',
                p0: { x: cx - 1, y: baseY - 125 },
                p1: { x: cx - 15, y: baseY - 132 },
                p2: { x: cx - 32, y: baseY - 128 },
                size: 42,
                angle: -Math.PI * 0.65,
                startP: 0.46, endP: 0.8
            },
            {
                name: 'upper-right',
                p0: { x: cx - 3.5, y: baseY - 145 },
                p1: { x: cx + 15, y: baseY - 152 },
                p2: { x: cx + 32, y: baseY - 148 },
                size: 42,
                angle: Math.PI * 0.58,
                startP: 0.56, endP: 0.88
            },
            {
                name: 'top',
                p0: { x: cx - 5, y: baseY - 175 },
                p1: { x: cx - 5, y: baseY - 182 },
                p2: { x: cx - 4, y: baseY - 188 },
                size: 46,
                angle: Math.PI * 0.05,
                startP: 0.68, endP: 1.0
            }
        ];

        leafSpecs.forEach(spec => {
            if (p > spec.startP) {
                const lp = Math.min(1, (p - spec.startP) / (spec.endP - spec.startP));
                const seg = this.getQuadraticSegment(spec.p0, spec.p1, spec.p2, lp);
                ctx.beginPath();
                ctx.moveTo(seg.p0.x, seg.p0.y);
                ctx.quadraticCurveTo(seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.3;
                ctx.stroke();

                this.drawLanceolateLeaf(ctx, seg.p2.x, seg.p2.y, spec.size, spec.angle, color, lp);
            }
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  STAGE: Full Banyan Tree
    // ──────────────────────────────────────────────────────────────────────────
    drawBanyanTree(ctx, messageOpacity = 1.0) {
        const W = this.width, H = this.height;
        const cx = W / 2;
        const cy = H * 0.38;
        const rx = Math.min(W * 0.34, 400);
        const ry = Math.min(H * 0.27, 155);
        const groundY   = H * 0.88;
        const trunkBotW = Math.min(rx * 0.24, 88);
        const trunkTopY = cy + ry * 0.88;
        const trunkTopW = trunkBotW * 0.72;
        const waistW    = trunkBotW * 0.42;

        if (this.activationStage === 'raining') {
            this.hueCycleTimer++;
            this.treeHue = (this.treeHue + 0.9) % 360;
            if (this.hueCycleTimer > 300) {
                this.hueCycleTimer = 0;
                const jumps = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
                this.treeHue = jumps[Math.floor(Math.random() * jumps.length)];
            }
        }
        const h = this.treeHue;
        const p = this.treeProgress;

        // ────────────────────────────── 1. Ground roots
        const rp = Math.min(1, p / 0.18);
        if (rp > 0) {
            ctx.strokeStyle = `hsla(${h},50%,22%,${rp * 0.85})`;
            ctx.lineWidth = 3.5; ctx.lineCap = 'round';
            const spread = rx * 0.85;
            for (let i = 0; i < 8; i++) {
                const off = (i - 3.5) * spread / 7;
                ctx.beginPath();
                ctx.moveTo(cx + off * 0.25, groundY);
                ctx.bezierCurveTo(cx + off * 0.55, groundY + 7, cx + off * 0.85, groundY + 12, cx + off, groundY + (i % 2 === 0 ? 5 : 9));
                ctx.stroke();
            }
        }

        // ────────────────────────────── 2. Trunk
        const tMorph = Math.min(1, p / 0.45);
        const trunkH = groundY - trunkTopY;
        const curH = 175 + (trunkH - 175) * p;
        const curBaseY = groundY - 14 * (1 - tMorph);
        const curTrunkTopY = curBaseY - curH;

        const curBotW = 7 + (trunkBotW - 7) * tMorph;
        const curTopW = 3.5 + (trunkTopW - 3.5) * tMorph;
        const curWaistW = 5.25 + (waistW - 5.25) * tMorph;

        ctx.beginPath();
        ctx.moveTo(cx - curBotW, curBaseY);
        ctx.bezierCurveTo(cx - curWaistW, curBaseY - curH * 0.2, cx - curWaistW, curBaseY - curH * 0.55, cx - curTopW, curTrunkTopY);
        ctx.lineTo(cx + curTopW, curTrunkTopY);
        ctx.bezierCurveTo(cx + curWaistW, curBaseY - curH * 0.55, cx + curWaistW, curBaseY - curH * 0.2, cx + curBotW, curBaseY);
        ctx.closePath();
        ctx.fillStyle = 'rgba(7, 8, 20, 0.86)';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(cx - curBotW, curBaseY);
        ctx.bezierCurveTo(cx - curWaistW, curBaseY - curH * 0.2, cx - curWaistW, curBaseY - curH * 0.55, cx - curTopW, curTrunkTopY);
        ctx.strokeStyle = `hsla(${h},62%,42%,1.0)`;
        ctx.lineWidth = 3.8;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx + curBotW, curBaseY);
        ctx.bezierCurveTo(cx + curWaistW, curBaseY - curH * 0.2, cx + curWaistW, curBaseY - curH * 0.55, cx + curTopW, curTrunkTopY);
        ctx.strokeStyle = `hsla(${h},62%,42%,1.0)`;
        ctx.lineWidth = 3.8;
        ctx.stroke();

        const numStrands = 6;
        for (let i = 1; i < numStrands; i++) {
            const ratio = i / numStrands;
            const startX = cx - curBotW + ratio * (curBotW * 2);
            const endX = cx - curTopW + ratio * (curTopW * 2);
            const wX = cx - curWaistW + ratio * (curWaistW * 2);
            ctx.beginPath();
            ctx.moveTo(startX, curBaseY);
            ctx.bezierCurveTo(wX, curBaseY - curH * 0.2, wX, curBaseY - curH * 0.55, endX, curTrunkTopY);
            ctx.strokeStyle = `hsla(${h},55%,24%,0.65)`;
            ctx.lineWidth = 1.3;
            ctx.stroke();
        }

        // ────────────────────────────── 2b. Dissolving Seedling Leaves
        if (p < 0.45) {
            const leafSpecOpacity = 1 - tMorph;
            const leafColor = `rgba(16, 185, 129, ${leafSpecOpacity})`;
            const baseY_original = groundY - 14;

            const seedlingLeaves = [
                {
                    p0: { x: cx + 5, y: baseY_original - 65 },
                    p1: { x: cx - 15, y: baseY_original - 70 },
                    p2: { x: cx - 35, y: baseY_original - 68 },
                    size: 38,
                    angle: -Math.PI * 0.7
                },
                {
                    p0: { x: cx + 3, y: baseY_original - 95 },
                    p1: { x: cx + 20, y: baseY_original - 90 },
                    p2: { x: cx + 38, y: baseY_original - 92 },
                    size: 40,
                    angle: Math.PI * 0.65
                },
                {
                    p0: { x: cx - 1, y: baseY_original - 125 },
                    p1: { x: cx - 15, y: baseY_original - 132 },
                    p2: { x: cx - 32, y: baseY_original - 128 },
                    size: 42,
                    angle: -Math.PI * 0.65
                },
                {
                    p0: { x: cx - 3.5, y: baseY_original - 145 },
                    p1: { x: cx + 15, y: baseY_original - 152 },
                    p2: { x: cx + 32, y: baseY_original - 148 },
                    size: 42,
                    angle: Math.PI * 0.58
                },
                {
                    p0: { x: cx - 5, y: baseY_original - 175 },
                    p1: { x: cx - 5, y: baseY_original - 182 },
                    p2: { x: cx - 4, y: baseY_original - 188 },
                    size: 46,
                    angle: Math.PI * 0.05
                }
            ];

            seedlingLeaves.forEach(spec => {
                const py0 = groundY - 14 - (baseY_original - spec.p0.y);
                const py1 = groundY - 14 - (baseY_original - spec.p1.y) - tMorph * 80;
                const py2 = groundY - 14 - (baseY_original - spec.p2.y) - tMorph * 150;

                const seg = this.getQuadraticSegment(
                    { x: spec.p0.x, y: py0 },
                    { x: spec.p1.x, y: py1 },
                    { x: spec.p2.x, y: py2 },
                    1.0
                );

                ctx.beginPath();
                ctx.moveTo(seg.p0.x, seg.p0.y);
                ctx.quadraticCurveTo(seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
                ctx.strokeStyle = leafColor;
                ctx.lineWidth = 1.3 * (1 - tMorph);
                ctx.stroke();

                this.drawLanceolateLeaf(ctx, seg.p2.x, seg.p2.y, spec.size * (1 + tMorph * 0.3), spec.angle, leafColor, 1 - tMorph);

                if (Math.random() < 0.15) {
                    this.createSparkle(
                        seg.p2.x + (Math.random() - 0.5) * 25,
                        seg.p2.y - tMorph * 30,
                        `rgba(16, 185, 129, ${0.8 * (1 - tMorph)})`,
                        1
                    );
                }
            });
        }

        // ────────────────────────────── 3. Main Branches
        if (p > 0.3) {
            const bp = Math.min(1, (p - 0.3) / 0.7);
            ctx.strokeStyle = `hsla(${h},60%,32%,${bp})`;
            ctx.lineWidth = 3.2; ctx.lineCap = 'round';

            const branchEnds = [
                { x: cx - rx * 0.62, y: cy + ry * 0.32 },
                { x: cx - rx * 0.28, y: cy - ry * 0.12 },
                { x: cx + rx * 0.28, y: cy - ry * 0.12 },
                { x: cx + rx * 0.62, y: cy + ry * 0.32 }
            ];

            branchEnds.forEach((end, idx) => {
                const startX = cx + (idx - 1.5) * curTopW * 0.45;
                ctx.beginPath();
                ctx.moveTo(startX, curTrunkTopY);
                ctx.bezierCurveTo(
                    startX + (idx - 1.5) * 45, curTrunkTopY - 45,
                    end.x - (idx - 1.5) * 40, end.y + 40,
                    startX + (end.x - startX) * bp, curTrunkTopY + (end.y - curTrunkTopY) * bp
                );
                ctx.stroke();

                if (bp > 0.5) {
                    const sbp = (bp - 0.5) / 0.5;
                    ctx.strokeStyle = `hsla(${h},55%,26%,${sbp * 0.8})`;
                    ctx.lineWidth = 1.6;
                    const midX = startX + (end.x - startX) * 0.58;
                    const midY = trunkTopY + (end.y - trunkTopY) * 0.58;

                    ctx.beginPath();
                    ctx.moveTo(midX, midY);
                    ctx.bezierCurveTo(
                        midX + (idx % 2 === 0 ? -35 : 35), midY - 25,
                        end.x + (idx % 2 === 0 ? -30 : 30), end.y - 25,
                        midX + (end.x + (idx % 2 === 0 ? -55 : 55) - midX) * sbp, midY + (end.y - 25 - midY) * sbp
                    );
                    ctx.stroke();
                }
            });
        }

        // ────────────────────────────── 4. Canopy Back-glow
        if (p > 0.28) {
            const glowP = Math.min(1, (p - 0.28) / 0.72);
            const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx * 1.3);
            glow.addColorStop(0, `hsla(${h},85%,55%,${glowP * 0.12})`);
            glow.addColorStop(1, `hsla(${h},85%,55%,0)`);
            ctx.beginPath(); ctx.arc(cx, cy, rx * 1.3, 0, Math.PI * 2);
            ctx.fillStyle = glow; ctx.fill();
        }

        // ────────────────────────────── 5. Aerial Roots
        if (p > 0.6) {
            const aerP = Math.min(1, (p - 0.6) / 0.4);
            const roots = [
                { bx: cx - rx * 0.58, by: cy + ry * 0.62 },
                { bx: cx - rx * 0.28, by: cy + ry * 0.78 },
                { bx: cx + rx * 0.04, by: cy + ry * 0.72 },
                { bx: cx + rx * 0.32, by: cy + ry * 0.76 },
                { bx: cx + rx * 0.6,  by: cy + ry * 0.60 },
                { bx: cx - rx * 0.72, by: cy + ry * 0.42 },
            ];
            roots.forEach((r, i) => {
                const len = (groundY - r.by) * aerP;
                const dir = i % 2 === 0 ? 1 : -1;
                ctx.strokeStyle = `hsla(${h},45%,28%,${aerP * 0.76})`;
                ctx.lineWidth = 1.3 + (i % 3) * 0.5; ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(r.bx, r.by);
                ctx.bezierCurveTo(r.bx + dir * 4, r.by + len * 0.3, r.bx - dir * 4, r.by + len * 0.7, r.bx + (Math.random()-0.5)*4, r.by + len);
                ctx.stroke();

                if (aerP > 0.85 && r.by + len > groundY - 30) {
                    ctx.beginPath();
                    ctx.arc(r.bx, groundY - 2, 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = `hsla(${h},40%,22%,${aerP * 0.6})`; ctx.fill();
                }
            });
        }

        // ────────────────────────────── 6. Border Accent Leaves
        if (this.activationStage === 'raining' || this.activationStage === 'title' || this.activationStage === 'ended') {
            this.borderLeaves.forEach(l => {
                l.offset += l.pulseSpeed;
                const b = Math.sin(l.offset) * 2.2;
                this.drawSketchLeaf(ctx, l.x, l.y, l.size + b,
                    `hsla(${(h+20)%360},75%,55%,0.5)`, l.angle);
            });
        }

        // ── 7. Sparkles
        this.sparkles = this.sparkles.filter(s => s.alpha > 0);
        this.sparkles.forEach(s => {
            s.x += s.vx; s.y += s.vy; s.alpha -= s.decay;
            ctx.globalAlpha = Math.max(0, s.alpha);
            ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fillStyle = s.color; ctx.fill();
            ctx.globalAlpha = 1;
        });

        // ── 8. Plucked leaf messages (raining stage)
        if (this.activationStage === 'raining' || this.activationStage === 'title' || this.activationStage === 'ended') {
            this.canopyLeaves.forEach(l => {
                if (!l.isPlucked) {
                    l.offset += l.pulseSpeed;
                    const b = Math.sin(l.offset) * 1.5;
                    this.drawSketchLeaf(ctx, l.x, l.y, l.size + b,
                        `hsla(${h},65%,48%,0.5)`, l.angle);
                } else if (l.isPlucked && l.wish && l.delay > 0) {
                    l.delay--;
                    const ox = l.origX !== undefined ? l.origX : l.x;
                    const oy = l.origY !== undefined ? l.origY : l.y;
                    l.offset += l.pulseSpeed;
                    const b = Math.sin(l.offset) * 1.5;
                    this.drawSketchLeaf(ctx, ox, oy, l.size + b,
                        `hsla(${h},65%,48%,0.5)`, l.angle);
                }
            });

            this.canopyLeaves.forEach(l => {
                if (l.isPlucked && l.wish && l.delay <= 0) {
                    l.lifetime++;

                    let opacity = 1;
                    if (l.lifetime < 30) {
                        opacity = l.lifetime / 30;
                    } else if (l.lifetime > l.maxLifetime - 30) {
                        opacity = Math.max(0, (l.maxLifetime - l.lifetime) / 30);
                    }

                    if (l.lifetime >= l.maxLifetime) {
                        l.isPlucked = false;
                        l.wish = null;
                        if (l.origX !== undefined) l.x = l.origX;
                        if (l.origY !== undefined) l.y = l.origY;
                        return;
                    }

                    l.palette.fill = `hsla(${h},72%,12%,0.88)`;
                    l.palette.glow = `hsla(${h},95%,60%,0.92)`;

                    this._drawWishLeaf(ctx, l, l.currentX, opacity * messageOpacity);
                }
            });
        }
    }

    _drawWishLeaf(ctx, l, drawX, opacity) {
        const W = l.leafW, H = l.leafH;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(drawX, l.currentY); ctx.rotate(l.angle);

        const cW = W;
        const cH = H;

        ctx.beginPath();
        ctx.moveTo(-cW, 0);
        ctx.bezierCurveTo(-cW*0.72, -cH, cW*0.72, -cH, cW, 0);
        ctx.bezierCurveTo( cW*0.72,  cH,-cW*0.72,  cH,-cW, 0);
        ctx.closePath();

        ctx.fillStyle = l.palette.fill;
        ctx.shadowColor = l.palette.glow; ctx.shadowBlur = 18;
        ctx.fill(); ctx.shadowBlur = 0;

        ctx.strokeStyle = l.palette.vein; ctx.lineWidth = 1.3; ctx.stroke();

        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const nameH = l.nameH !== undefined ? l.nameH : (l.nameStr ? 14 : 0);
        const gap = l.gap !== undefined ? l.gap : (l.nameStr ? 4 : 0);
        const totalH = nameH + gap + l.msgLines.length * l.lineHeight;
        const sY = -totalH / 2;

        if (l.nameStr) {
            ctx.font = 'bold 13px Outfit';
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.fillText(l.nameStr, 0, sY + 6);
        }
        ctx.font = `500 ${l.fontSize}px Outfit`;
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        const mSY = sY + nameH + gap;
        l.msgLines.forEach((line, i) => ctx.fillText(line, 0, mSY + i*l.lineHeight + l.lineHeight/2));
        ctx.restore();
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  Main render dispatch
    // ──────────────────────────────────────────────────────────────────────────
    update() {
        const ctx = this.ctx;
        const stage = this.activationStage;

        ctx.fillStyle = (stage === 'raining' || stage === 'title' || stage === 'ended')
            ? 'rgba(7,8,20,0.18)' : 'rgba(7,8,20,0.28)';
        ctx.fillRect(0, 0, this.width, this.height);

        this.drawStars(ctx);

        if (stage === 'blank' || stage === 'welcome' || stage === 'logo_active') return;
        if (stage === 'seed') { this.drawSeed(ctx); return; }
        if (stage === 'seedling' || stage === 'seedling_wait') { this.drawSeedling(ctx); return; }

        if (stage === 'ended') {
            if (this.endProgress === undefined) this.endProgress = 0;
            if (this.endProgress < 3.0) {
                this.endProgress += 0.015; // smooth increment
                if (this.endProgress > 3.0) this.endProgress = 3.0;
            }
            
            // Phase 1 (0 to 1): Messages fade out.
            // Phase 2 (1 to 2): Tree/canopy/border leaves fade out.
            // Phase 3 (2 to 3): Gold text fades in.
            const messageOpacity = Math.max(0, Math.min(1, 1 - this.endProgress));
            const treeOpacity = Math.max(0, Math.min(1, 2 - this.endProgress));
            const textOpacity = Math.max(0, Math.min(1, this.endProgress - 2));

            // Draw tree/leaves with current tree opacity and message opacity modifiers
            if (treeOpacity > 0) {
                ctx.save();
                ctx.globalAlpha = treeOpacity;
                this.drawBanyanTree(ctx, messageOpacity);
                ctx.restore();
            }

            // Draw gold title fading in
            if (textOpacity > 0) {
                if (typeof window.triggerGoldTextAnimation === 'function') {
                    window.triggerGoldTextAnimation();
                }
            }
            return;
        }

        this.drawBanyanTree(ctx);
    }
}

// ─── Global bootstrap ─────────────────────────────────────────────────────────
let tree;
let ws;
let messagesLoaded = false;

function initDisplay() {
    tree = new BorderDreamTree('tree-canvas');
    window.tree = tree;

    function loop() { tree.update(); requestAnimationFrame(loop); }
    loop();

    checkActivationState();
    connectWebSocket();
}

async function checkActivationState() {
    try {
        const res = await fetch('/api/status');
        if (!res.ok) return;
        const data = await res.json();
        tree.activationKey = data.activation_key || 'Space';

        if (data.is_activated && !tree.isActivated) {
            // Already activated in DB — skip animation, go straight to raining or ended
            tree.isActivated = true;
            tree.treeProgress = 1.0;
            if (data.elapsed_seconds >= 75) {
                tree.activationStage = 'ended';
                tree.endProgress = 1.0;
                if (typeof hideSplash === 'function') hideSplash();
                tree.endInauguration();
                tree.endProgress = 1.0;
            } else {
                tree.activationStage = 'raining';
                if (typeof activateTitle === 'function') activateTitle();
                if (typeof hideSplash === 'function') hideSplash();
                loadExistingMessages();
                tree.startTimer(data.elapsed_seconds);
            }
        }
    } catch (e) { console.error(e); }
}

async function loadExistingMessages() {
    if (messagesLoaded) return;
    messagesLoaded = true;
    try {
        const res = await fetch('/api/messages');
        if (res.ok) { const wishes = await res.json(); wishes.forEach(w => tree.addWish(w)); }
    } catch (e) { console.error(e); messagesLoaded = false; }
}

function connectWebSocket() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${window.location.host}/api/ws`);

    ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === 'activation_state') {
            if (payload.is_activated) {
                if (!tree.isActivated) {
                    triggerActivation();
                    setTimeout(loadExistingMessages, 4500);
                }
            } else {
                // Reset client state back to welcome
                tree.isActivated = false;
                tree.activationStage = 'welcome';
                tree.timerActive = false;
                if (tree.timerTimeout) clearTimeout(tree.timerTimeout);
                tree.elapsedSeconds = 0;
                tree.endProgress = 0;
                tree.treeProgress = 0;
                tree.seedProgress = 0;
                tree.seedlingProgress = 0;
                
                if (typeof window.resetGoldTextAnimation === 'function') {
                    window.resetGoldTextAnimation();
                }
                
                const splash = document.getElementById('logo-splash');
                if (splash) {
                    splash.classList.remove('hidden');
                    splash.classList.remove('morphing');
                }
                const hud = document.getElementById('hud-header');
                if (hud) hud.style.opacity = '0';
                const wm = document.getElementById('logo-watermark');
                if (wm) wm.classList.remove('visible');
                const soundBtn = document.getElementById('sound-btn');
                if (soundBtn) {
                    soundBtn.style.opacity = '0';
                    soundBtn.style.pointerEvents = 'none';
                }
            }
        } else if (payload.type === 'new_message') {
            tree.addWish(payload.data);
        } else if (payload.type === 'delete_message') {
            tree.deleteWish(payload.data.id);
        } else if (payload.type === 'clear_tree') {
            tree.clearTree();
        }
    };

    ws.onclose = () => { console.log('WS closed, retrying…'); setTimeout(connectWebSocket, 3000); };
}

function triggerActivation() {
    if (!tree || tree.isActivated) return;

    // Activate tree state
    tree.activate();
    tree.startTimer(0);

    // Compute morph offsets dynamically
    const splash = document.getElementById('logo-splash');
    const logoImg = splash ? splash.querySelector('.splash-logo-img') : null;
    if (splash && logoImg) {
        const logoRect = logoImg.getBoundingClientRect();
        const logoCX = logoRect.left + logoRect.width / 2;
        const logoCY = logoRect.top + logoRect.height / 2;
        const targetX = window.innerWidth / 2;
        const targetY = window.innerHeight * 0.88 - 14;
        logoImg.style.setProperty('--morph-x', `${targetX - logoCX}px`);
        logoImg.style.setProperty('--morph-y', `${targetY - logoCY}px`);
        splash.classList.add('morphing');
    }

    // Start seed sequence
    setTimeout(() => {
        tree.startSeedSequence();
    }, 2600);

    // Hide splash container fully
    setTimeout(() => {
        if (splash) splash.classList.add('hidden');
        setTimeout(loadExistingMessages, 2500);
    }, 3000);
}

window.onload = initDisplay;
