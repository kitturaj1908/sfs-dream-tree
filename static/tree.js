// SFS College Dream Tree - Redesigned Hand-Drawn Border Tree & Message Rain System

// Audio Synthesizer using Web Audio API
class SoundSynth {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playInaugurationBoom() {
        this.init();
        const now = this.ctx.currentTime;

        // Deep sub impact
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(100, now);
        osc1.frequency.exponentialRampToValueAtTime(30, now + 1.5);
        gain1.gain.setValueAtTime(0.8, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 1.8);
        osc1.connect(gain1);
        gain1.connect(this.ctx.destination);
        osc1.start(now);
        osc1.stop(now + 2.0);

        // Rising glitter
        for (let i = 0; i < 8; i++) {
            const delay = i * 0.15;
            const freq = 450 + i * 200;
            this.playChimeNode(freq, now + delay, 0.18);
        }
    }

    playChimeNode(freq, startTime, duration) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    playChime() {
        this.init();
        const now = this.ctx.currentTime;
        const notes = [523.25, 587.33, 659.25, 783.99, 880.00]; // Pentatonic notes C5, D5, E5, G5, A5
        const note1 = notes[Math.floor(Math.random() * notes.length)];

        this.playChimeNode(note1, now, 0.6);
    }

    playCardWhoosh() {
        this.init();
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.35);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(250, now);
        filter.frequency.exponentialRampToValueAtTime(1000, now + 0.35);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.4);
    }
}

const synth = new SoundSynth();

// Canvas Visualization Engine
class BorderDreamTree {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.isActivated = false;
        this.activationKey = "Space";
        this.activationProgress = 0; // Transition state 0 to 1
        this.activationStage = 'blank'; // Stages: blank -> welcome -> growing -> title -> raining

        this.stars = [];
        this.sparkles = []; // Activation flare particles
        this.canopyLeaves = []; // Dense foliage inside canopy
        this.borderLeaves = []; // Foliage outlining the border

        // Data queues
        this.messageQueue = [];
        this.activeOverlayMessage = null;
        this.carouselTimer = null;
        this.carouselIndex = 0;

        // Colors
        this.chalkWhite = 'rgba(240, 245, 255, 0.8)';
        this.chalkBrown = 'rgba(127, 95, 70, 0.85)';

        this.leafColors = [
            'rgba(0, 242, 254, 0.45)',  // Cyan glow
            'rgba(217, 70, 239, 0.45)', // Magenta glow
            'rgba(16, 185, 129, 0.45)'  // Emerald green glow
        ];

        this.trunkHue = 0;
        this.canopyHue = 180;

        this.resize();
        window.addEventListener('resize', () => {
            this.resize();
            this.generateBorderCanopy();
            this.generateDenseCanopyLeaves();
        });

        this.createStars();
        this.generateBorderCanopy();
        this.generateDenseCanopyLeaves();

        // Fades in the welcome prompt button after 1.2s blank delay
        setTimeout(() => {
            if (this.activationStage === 'blank' && !this.isActivated) {
                this.activationStage = 'welcome';
                if (typeof showPrompt === 'function') showPrompt();
            }
        }, 1200);
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.ctx.scale(dpr, dpr);
        this.width = window.innerWidth;
        this.height = window.innerHeight;
    }

    createStars() {
        this.stars = [];
        for (let i = 0; i < 90; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 1.5 + 0.5,
                alpha: Math.random() * 0.7 + 0.3,
                speed: Math.random() * 0.01 + 0.005
            });
        }
    }

    // Generate static leafy clusters defining the canopy crown
    generateBorderCanopy() {
        this.borderLeaves = [];

        const cx = this.width / 2;
        const cy = this.height * 0.4;
        const rx = Math.min(this.width * 0.32, 380);
        const ry = Math.min(this.height * 0.28, 160);

        const startAngle = 0.76 * Math.PI;
        const endAngle = 0.24 * Math.PI;
        const span = 1.48 * Math.PI;
        const numLeaves = 45; // place 45 leaves along the canopy
        const numBumps = 12;

        for (let i = 0; i < numLeaves; i++) {
            const angle = startAngle + (i / numLeaves) * span + (Math.random() - 0.5) * 0.05;

            // Find corresponding bump index to align with outer wavy curves
            const t = (angle - startAngle) / span;
            const bumpIdx = Math.floor(t * numBumps);
            const bumpHeight = 55 + Math.sin(bumpIdx * 1.5) * 10;

            // Base coordinate on the canopy boundary
            const bx = cx + rx * Math.cos(angle);
            const by = cy + ry * Math.sin(angle);

            // Vector from center to base point
            const dx = bx - cx;
            const dy = by - cy;
            const len = Math.sqrt(dx * dx + dy * dy);

            // Place leaves along the outer green sketchy boundary
            const offsetDist = bumpHeight + (Math.random() - 0.5) * 12;
            const lx = bx + (dx / len) * offsetDist;
            const ly = by + (dy / len) * offsetDist;

            this.borderLeaves.push({
                x: lx,
                y: ly,
                size: Math.random() * 8 + 10, // slightly smaller leaves for the center tree
                color: this.leafColors[Math.floor(Math.random() * this.leafColors.length)],
                angle: angle + Math.PI / 2 + (Math.random() - 0.5) * 0.5, // align perpendicular to boundary
                pulseSpeed: Math.random() * 0.02 + 0.01,
                offset: Math.random() * Math.PI
            });
        }
    }

    generateDenseCanopyLeaves() {
        this.canopyLeaves = [];
        const cx = this.width / 2;
        const cy = this.height * 0.4;
        const rx = Math.min(this.width * 0.32, 380);
        const ry = Math.min(this.height * 0.28, 160);
        const numLeaves = 120; // Dense foliage pool

        for (let i = 0; i < numLeaves; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * 0.82; // distributed within canopy outline
            const lx = cx + rx * r * Math.cos(angle);
            const ly = cy + ry * r * Math.sin(angle);

            this.canopyLeaves.push({
                id: i,
                x: lx,
                y: ly,
                size: Math.random() * 6 + 9, // Small canopy leaf size
                color: this.leafColors[Math.floor(Math.random() * this.leafColors.length)],
                angle: angle + Math.PI / 2 + (Math.random() - 0.5) * 1.0,
                pulseSpeed: Math.random() * 0.02 + 0.01,
                offset: Math.random() * Math.PI,

                // Plucking & morphing physics parameters
                isPlucked: false,
                wish: null,
                currentX: lx,
                currentY: ly,
                vx: 0,
                vy: 0,
                swayAngle: Math.random() * Math.PI * 2,
                swaySpeed: 0.003 + Math.random() * 0.006,
                swayWidth: 4 + Math.random() * 8,
                opacity: 0,
                lifetime: 0,
                maxLifetime: 750 + Math.random() * 200,
                angleVelocity: (Math.random() - 0.5) * 0.012
            });
        }
    }

    activate() {
        if (this.isActivated) return;
        this.isActivated = true;
        this.activationProgress = 0.01;
        this.activationStage = 'growing'; // Move to growing phase

        if (typeof hidePrompt === 'function') hidePrompt();

        synth.playInaugurationBoom();
        this.growBorderTree();
    }

    getBezierPoint(p0, p1, p2, p3, t) {
        const oneMinusT = 1 - t;
        const x = Math.pow(oneMinusT, 3) * p0.x +
            3 * Math.pow(oneMinusT, 2) * t * p1.x +
            3 * oneMinusT * Math.pow(t, 2) * p2.x +
            Math.pow(t, 3) * p3.x;
        const y = Math.pow(oneMinusT, 3) * p0.y +
            3 * Math.pow(oneMinusT, 2) * t * p1.y +
            3 * oneMinusT * Math.pow(t, 2) * p2.y +
            Math.pow(t, 3) * p3.y;
        return { x, y };
    }

    getBezierSegment(p0, p1, p2, p3, t) {
        if (t <= 0) return { p0, p1: p0, p2: p0, p3: p0 };
        if (t >= 1) return { p0, p1, p2, p3 };

        const p01 = { x: p0.x + t * (p1.x - p0.x), y: p0.y + t * (p1.y - p0.y) };
        const p12 = { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
        const p23 = { x: p2.x + t * (p3.x - p2.x), y: p2.y + t * (p3.y - p2.y) };

        const p012 = { x: p01.x + t * (p12.x - p01.x), y: p01.y + t * (p12.y - p01.y) };
        const p123 = { x: p12.x + t * (p23.x - p12.x), y: p12.y + t * (p23.y - p12.y) };

        const p0123 = { x: p012.x + t * (p123.x - p012.x), y: p012.y + t * (p123.y - p012.y) };

        return {
            p0,
            p1: p01,
            p2: p012,
            p3: p0123
        };
    }

    getQuadraticSegment(p0, p1, p2, t) {
        if (t <= 0) return { p0, p1: p0, p2: p0 };
        if (t >= 1) return { p0, p1, p2 };

        const p01 = { x: p0.x + t * (p1.x - p0.x), y: p0.y + t * (p1.y - p0.y) };
        const p12 = { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
        const p012 = { x: p01.x + t * (p12.x - p01.x), y: p01.y + t * (p12.y - p01.y) };

        return {
            p0,
            p1: p01,
            p2: p012
        };
    }

    getLeftTrunkPoint(t) {
        const cx = this.width / 2;
        const cy = this.height * 0.4;
        const rx = Math.min(this.width * 0.32, 380);
        const ry = Math.min(this.height * 0.28, 160);
        const startAngle = 0.76 * Math.PI;

        const p0 = { x: cx - 0.85 * rx, y: this.height + 20 };
        const p1 = { x: cx - 0.25 * rx, y: this.height * 0.82 };
        const p2 = { x: cx - 0.2 * rx, y: this.height * 0.68 };
        const p3 = { x: cx + rx * Math.cos(startAngle), y: cy + ry * Math.sin(startAngle) };

        return this.getBezierPoint(p0, p1, p2, p3, t);
    }

    getRightTrunkPoint(t) {
        const cx = this.width / 2;
        const cy = this.height * 0.4;
        const rx = Math.min(this.width * 0.32, 380);
        const ry = Math.min(this.height * 0.28, 160);
        const endAngle = 0.24 * Math.PI;

        const p0 = { x: cx + 0.85 * rx, y: this.height + 20 };
        const p1 = { x: cx + 0.25 * rx, y: this.height * 0.82 };
        const p2 = { x: cx + 0.2 * rx, y: this.height * 0.68 };
        const p3 = { x: cx + rx * Math.cos(endAngle), y: cy + ry * Math.sin(endAngle) };

        return this.getBezierPoint(p0, p1, p2, p3, t);
    }

    growBorderTree() {
        const duration = 2000; // ms
        const start = performance.now();

        const animate = (now) => {
            const elapsed = now - start;
            this.activationProgress = Math.min(1.0, elapsed / duration);

            // Add sparkles outlining the tree shape during growth
            if (this.activationProgress < 1.0 && Math.random() < 0.8) {
                const cx = this.width / 2;
                const cy = this.height * 0.4;
                const rx = Math.min(this.width * 0.32, 380);
                const ry = Math.min(this.height * 0.28, 160);

                // Spawn sparkles along the trunk or canopy
                let sx, sy;
                if (Math.random() < 0.3) {
                    // Left trunk Bezier path
                    const t = Math.random();
                    const pt = this.getLeftTrunkPoint(t);
                    sx = pt.x;
                    sy = pt.y;
                } else if (Math.random() < 0.3) {
                    // Right trunk Bezier path
                    const t = Math.random();
                    const pt = this.getRightTrunkPoint(t);
                    sx = pt.x;
                    sy = pt.y;
                } else {
                    // Canopy path
                    const angle = 0.76 * Math.PI + Math.random() * 1.48 * Math.PI;
                    sx = cx + rx * Math.cos(angle) * (0.8 + Math.random() * 0.2);
                    sy = cy + ry * Math.sin(angle) * (0.8 + Math.random() * 0.2);
                }
                this.createSparkle(sx, sy, ['rgba(0,242,254,0.9)', 'rgba(16,185,129,0.9)', 'rgba(217,70,239,0.9)'][Math.floor(Math.random() * 3)], 2);
            }

            if (this.activationProgress < 1.0) {
                requestAnimationFrame(animate);
            } else {
                // Tree fully formed — move to 'title' stage and fade in HUD header
                this.activationStage = 'title';
                if (typeof activateTitle === 'function') activateTitle();

                // Wait 1.5s for title to fade in, then move to 'raining' stage
                setTimeout(() => {
                    this.activationStage = 'raining';
                    this.rainQueuedWishes();
                }, 1500);
            }
        };
        requestAnimationFrame(animate);
    }

    createSparkle(x, y, color, count = 4) {
        for (let i = 0; i < count; i++) {
            this.sparkles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6 - 1,
                size: Math.random() * 4 + 1,
                alpha: 1.0,
                color: color || 'rgba(0, 242, 254, 0.8)',
                decay: Math.random() * 0.03 + 0.015
            });
        }
    }

    addWish(wish) {
        if (!this.isActivated || this.activationStage !== 'raining') {
            // Queue the message to load when stage is ready
            if (!this.messageQueue.some(w => w.id === wish.id)) {
                this.messageQueue.push(wish);
            }
            return;
        }

        // 10 messages should be shown at a time
        const activePluckedCount = this.canopyLeaves.filter(l => l.isPlucked).length;
        if (activePluckedCount >= 10) {
            if (!this.messageQueue.some(w => w.id === wish.id)) {
                this.messageQueue.push(wish);
            }
            return;
        }

        // Avoid duplication among active wishes
        const isAlreadyActive = this.canopyLeaves.some(l => l.isPlucked && l.wish && l.wish.id === wish.id);
        if (isAlreadyActive) return;

        // Pluck a random unplucked canopy leaf
        const availableLeaves = this.canopyLeaves.filter(l => !l.isPlucked);
        if (availableLeaves.length === 0) {
            this.messageQueue.push(wish);
            return;
        }

        synth.playChime();

        const leaf = availableLeaves[Math.floor(Math.random() * availableLeaves.length)];

        // Wrap message text and determine font size dynamically based on length
        const len = wish.message.length;
        let fontSize = 11.5;
        let lineHeight = 12.0;
        let wrapChars = 29;
        let leafScale = 0.96;

        if (len <= 40) {
            fontSize = 14.0;
            lineHeight = 15.0;
            wrapChars = 20;
            leafScale = 0.72; // Decreased leaf size a bit more, increased font size
        } else if (len <= 80) {
            fontSize = 13.0;
            lineHeight = 13.5;
            wrapChars = 24;
            leafScale = 0.85; // Decreased leaf size a bit more, increased font size
        } else {
            fontSize = 11.5;
            lineHeight = 12.0;
            wrapChars = 29;
            leafScale = 0.96; // Decreased leaf size a bit more, increased font size
        }

        // Fixed leaf dimensions (scaled dynamically for longer messages)
        const LEAF_W = 120 * leafScale;  // slightly shorter half-length of leaf
        const LEAF_H = 58 * leafScale;   // slightly taller half-height of leaf (more rounded)

        const colors = [
            { fill: 'rgba(0, 180, 200, 0.72)', glow: 'rgba(0,242,254,0.9)', vein: 'rgba(180,255,255,0.55)' },
            { fill: 'rgba(160, 40, 200, 0.68)', glow: 'rgba(217,70,239,0.9)', vein: 'rgba(240,180,255,0.55)' },
            { fill: 'rgba(10, 150, 90, 0.72)', glow: 'rgba(16,185,129,0.9)', vein: 'rgba(140,255,200,0.55)' },
        ];
        const palette = colors[wish.id % colors.length];

        const msgLines = this.wrapText(wish.message, wrapChars);
        const nameStr = wish.student_name ? wish.student_name.substring(0, 18) : '';

        // Pluck the leaf!
        leaf.isPlucked = true;
        leaf.wish = wish;
        leaf.palette = palette;
        leaf.msgLines = msgLines;
        leaf.nameStr = nameStr;
        leaf.fontSize = fontSize;
        leaf.lineHeight = lineHeight;
        leaf.leafW = LEAF_W;
        leaf.leafH = LEAF_H;

        // Initialize physics for falling from its original position
        leaf.currentX = leaf.x;
        leaf.currentY = leaf.y;
        leaf.vx = (Math.random() - 0.5) * 0.3;
        leaf.vy = 0.35 + Math.random() * 0.35; // float down
        leaf.opacity = 1.0;
        leaf.lifetime = 0;
        leaf.maxLifetime = 750 + Math.random() * 200;
        leaf.swayAngle = Math.random() * Math.PI * 2;
        leaf.swaySpeed = 0.004 + Math.random() * 0.008;
        leaf.swayWidth = 4 + Math.random() * 8;
        leaf.angle = leaf.angle; // keep original angle or let it drift
        leaf.angleVelocity = (Math.random() - 0.5) * 0.012;
    }

    wrapText(text, maxChars) {
        const words = text.split(" ");
        const lines = [];
        let currentLine = "";

        words.forEach(word => {
            if ((currentLine + " " + word).trim().length <= maxChars) {
                currentLine = (currentLine + " " + word).trim();
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        });
        if (currentLine) lines.push(currentLine);
        return lines;
    }

    rainQueuedWishes() {
        const process = () => {
            if (this.activationStage !== 'raining') return;
            const activePluckedCount = this.canopyLeaves.filter(l => l.isPlucked).length;
            if (this.messageQueue.length > 0 && activePluckedCount < 10) {
                const wish = this.messageQueue.shift();
                this.addWish(wish);
            }
            setTimeout(process, 800);
        };
        process();
    }

    deleteWish(id) {
        this.canopyLeaves.forEach(l => {
            if (l.isPlucked && l.wish && l.wish.id === id) {
                l.isPlucked = false;
                l.wish = null;
            }
        });
        this.messageQueue = this.messageQueue.filter(w => w.id !== id);
    }

    clearTree() {
        this.canopyLeaves.forEach(l => {
            l.isPlucked = false;
            l.wish = null;
        });
        this.messageQueue = [];
        messagesLoaded = false;
    }

    // Chalk outline sketch style helper
    drawSketchyLine(ctx, x1, y1, x2, y2, thickness, color) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';

        // Sketch 1: Main line with slight waviness
        ctx.moveTo(x1, y1);
        const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * 1.5;
        const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * 1.5;
        ctx.quadraticCurveTo(midX, midY, x2, y2);
        ctx.stroke();

        // Sketch 2: Fine overlap line
        ctx.beginPath();
        ctx.lineWidth = Math.max(1, thickness * 0.35);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.moveTo(x1 + (Math.random() - 0.5) * 2, y1 + (Math.random() - 0.5) * 2);
        ctx.lineTo(x2 + (Math.random() - 0.5) * 2, y2 + (Math.random() - 0.5) * 2);
        ctx.stroke();
    }

    // Chalk outline hand-drawn leaf
    drawSketchLeaf(ctx, x, y, size, color, angle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        ctx.shadowBlur = this.isActivated ? 8 : 0;
        ctx.shadowColor = color;

        // Sketchy double path leaf shape
        for (let i = 0; i < 2; i++) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(size * 0.5 + i * 2, -size * 0.4, size, 0);
            ctx.quadraticCurveTo(size * 0.5 + i * 2, size * 0.4, 0, 0);

            ctx.fillStyle = i === 0 ? color : 'rgba(255,255,255,0.05)';
            ctx.fill();

            ctx.strokeStyle = i === 0 ? 'rgba(255,255,255,0.8)' : color;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();
    }

    update() {
        const ctx = this.ctx;

        // Subtle glow trail refresh
        ctx.fillStyle = 'rgba(7, 8, 20, 0.2)';
        ctx.fillRect(0, 0, this.width, this.height);

        // 1. Stars
        ctx.fillStyle = '#ffffff';
        this.stars.forEach(star => {
            star.alpha += star.speed;
            if (star.alpha > 0.95 || star.alpha < 0.2) {
                star.speed = -star.speed;
            }
            ctx.globalAlpha = Math.max(0.1, Math.min(1.0, star.alpha));
            ctx.fillRect(star.x, star.y, star.size, star.size);
        });
        ctx.globalAlpha = 1.0;

        if (this.activationStage === 'blank' || this.activationStage === 'welcome') {
            return; // Only background dots / stars in these stages
        }

        // 2. Draw procedural tree shape (matching user's drawing)
        const cx = this.width / 2;
        const cy = this.height * 0.4;
        const rx = Math.min(this.width * 0.32, 380);
        const ry = Math.min(this.height * 0.28, 160);

        const startAngle = 0.76 * Math.PI;
        const endAngle = 0.24 * Math.PI;
        const span = 1.48 * Math.PI;
        const numBumps = 12;

        // Generate canopy boundary points
        const canopyPoints = [];
        for (let i = 0; i <= numBumps; i++) {
            const angle = startAngle + (i / numBumps) * span;
            canopyPoints.push({
                x: cx + rx * Math.cos(angle),
                y: cy + ry * Math.sin(angle)
            });
        }

        if (this.isActivated) {
            // Speed up and randomize the hue shifts slightly so they cycle through random colors dynamically
            this.trunkHue = (this.trunkHue + 1.8) % 360;
            this.canopyHue = (this.canopyHue + 2.2) % 360;
        }

        // 2a. Draw the Black/Chalk Tree Trunk lines
        // titleZone: the bottom area occupied by the HUD title (approx 155px from bottom)
        // We clip drawing to everything ABOVE the title zone, leaving a natural gap.
        const titleZoneHeight = 155; // px — adjust if title size changes
        const trunkClipBottom = this.height - titleZoneHeight;

        const leftTrunkP0 = { x: cx - 0.85 * rx, y: this.height + 20 }; // slightly off-screen
        const leftTrunkP1 = { x: cx - 0.25 * rx, y: this.height * 0.82 };
        const leftTrunkP2 = { x: cx - 0.2 * rx, y: this.height * 0.68 };
        const leftTrunkP3 = { x: canopyPoints[0].x, y: canopyPoints[0].y };

        const rightTrunkP0 = { x: cx + 0.85 * rx, y: this.height + 20 }; // slightly off-screen
        const rightTrunkP1 = { x: cx + 0.25 * rx, y: this.height * 0.82 };
        const rightTrunkP2 = { x: cx + 0.2 * rx, y: this.height * 0.68 };
        const rightTrunkP3 = { x: canopyPoints[numBumps].x, y: canopyPoints[numBumps].y };

        const createRainbowGradient = (x1, y1, x2, y2, baseHue) => {
            const grad = ctx.createLinearGradient(x1, y1, x2, y2);
            grad.addColorStop(0.0, `hsla(${baseHue}, 95%, 65%, 0.95)`);
            grad.addColorStop(0.33, `hsla(${(baseHue + 90) % 360}, 95%, 65%, 0.95)`);
            grad.addColorStop(0.66, `hsla(${(baseHue + 180) % 360}, 95%, 65%, 0.95)`);
            grad.addColorStop(1.0, `hsla(${(baseHue + 270) % 360}, 95%, 65%, 0.95)`);
            return grad;
        };

        const createRainbowGradientSketch = (x1, y1, x2, y2, baseHue) => {
            const grad = ctx.createLinearGradient(x1, y1, x2, y2);
            grad.addColorStop(0.0, `hsla(${(baseHue + 120) % 360}, 95%, 75%, 0.85)`);
            grad.addColorStop(0.5, `hsla(${(baseHue + 210) % 360}, 95%, 75%, 0.85)`);
            grad.addColorStop(1.0, `hsla(${(baseHue + 300) % 360}, 95%, 75%, 0.85)`);
            return grad;
        };

        const dormantCanopyColor = 'rgba(16, 185, 129, 0.15)';
        const dormantTrunkColor = 'rgba(255, 255, 255, 0.12)';

        let leftTrunkStroke, leftTrunkSketchStroke;
        let rightTrunkStroke, rightTrunkSketchStroke;
        let canopyStroke, canopySketchStroke;

        if (this.isActivated) {
            leftTrunkStroke = createRainbowGradient(leftTrunkP0.x, leftTrunkP0.y, leftTrunkP3.x, leftTrunkP3.y, this.trunkHue);
            leftTrunkSketchStroke = createRainbowGradientSketch(leftTrunkP0.x, leftTrunkP0.y, leftTrunkP3.x, leftTrunkP3.y, this.trunkHue);

            rightTrunkStroke = createRainbowGradient(rightTrunkP3.x, rightTrunkP3.y, rightTrunkP0.x, rightTrunkP0.y, this.trunkHue + 180);
            rightTrunkSketchStroke = createRainbowGradientSketch(rightTrunkP3.x, rightTrunkP3.y, rightTrunkP0.x, rightTrunkP0.y, this.trunkHue + 180);

            canopyStroke = createRainbowGradient(cx - rx, cy, cx + rx, cy, this.canopyHue);
            canopySketchStroke = createRainbowGradientSketch(cx - rx, cy, cx + rx, cy, this.canopyHue);
        } else {
            leftTrunkStroke = dormantTrunkColor;
            leftTrunkSketchStroke = 'rgba(255, 255, 255, 0.08)';

            rightTrunkStroke = dormantTrunkColor;
            rightTrunkSketchStroke = 'rgba(255, 255, 255, 0.08)';

            canopyStroke = dormantCanopyColor;
            canopySketchStroke = 'rgba(255, 255, 255, 0.08)';
        }

        let t_L = 1.0;
        let t_C = 1.0;
        let t_R = 1.0;

        if (this.isActivated) {
            const progress = this.activationProgress;
            t_L = Math.min(1.0, progress / 0.25);
            t_C = Math.max(0.0, Math.min(1.0, (progress - 0.25) / 0.50));
            t_R = Math.max(0.0, Math.min(1.0, (progress - 0.75) / 0.25));
        }

        // Save canvas state and apply clip — draw trunks only above title zone
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, this.width, trunkClipBottom);
        ctx.clip();

        // Draw Left Trunk - Main curve
        ctx.beginPath();
        ctx.strokeStyle = leftTrunkStroke;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        const leftSeg = this.getBezierSegment(leftTrunkP0, leftTrunkP1, leftTrunkP2, leftTrunkP3, t_L);
        ctx.moveTo(leftSeg.p0.x, leftSeg.p0.y);
        ctx.bezierCurveTo(leftSeg.p1.x, leftSeg.p1.y, leftSeg.p2.x, leftSeg.p2.y, leftSeg.p3.x, leftSeg.p3.y);
        ctx.stroke();

        // Draw Left Trunk - Fine overlap sketchy line
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = leftTrunkSketchStroke;
        const leftTrunkP0_offset = { x: leftTrunkP0.x + (Math.random() - 0.5) * 3, y: leftTrunkP0.y };
        const leftTrunkP1_offset = { x: leftTrunkP1.x + (Math.random() - 0.5) * 4, y: leftTrunkP1.y + (Math.random() - 0.5) * 4 };
        const leftTrunkP2_offset = { x: leftTrunkP2.x + (Math.random() - 0.5) * 4, y: leftTrunkP2.y + (Math.random() - 0.5) * 4 };
        const leftTrunkP3_offset = { x: leftTrunkP3.x + (Math.random() - 0.5) * 3, y: leftTrunkP3.y + (Math.random() - 0.5) * 3 };

        const leftSegSketch = this.getBezierSegment(leftTrunkP0_offset, leftTrunkP1_offset, leftTrunkP2_offset, leftTrunkP3_offset, t_L);
        ctx.moveTo(leftSegSketch.p0.x, leftSegSketch.p0.y);
        ctx.bezierCurveTo(leftSegSketch.p1.x, leftSegSketch.p1.y, leftSegSketch.p2.x, leftSegSketch.p2.y, leftSegSketch.p3.x, leftSegSketch.p3.y);
        ctx.stroke();

        // Draw Right Trunk - Main curve
        ctx.beginPath();
        ctx.strokeStyle = rightTrunkStroke;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        const rightSeg = this.getBezierSegment(rightTrunkP3, rightTrunkP2, rightTrunkP1, rightTrunkP0, t_R);
        ctx.moveTo(rightSeg.p0.x, rightSeg.p0.y);
        ctx.bezierCurveTo(rightSeg.p1.x, rightSeg.p1.y, rightSeg.p2.x, rightSeg.p2.y, rightSeg.p3.x, rightSeg.p3.y);
        ctx.stroke();

        // Draw Right Trunk - Fine overlap sketchy line
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = rightTrunkSketchStroke;
        const rightTrunkP3_offset = { x: rightTrunkP3.x + (Math.random() - 0.5) * 3, y: rightTrunkP3.y + (Math.random() - 0.5) * 3 };
        const rightTrunkP2_offset = { x: rightTrunkP2.x + (Math.random() - 0.5) * 4, y: rightTrunkP2.y + (Math.random() - 0.5) * 4 };
        const rightTrunkP1_offset = { x: rightTrunkP1.x + (Math.random() - 0.5) * 4, y: rightTrunkP1.y + (Math.random() - 0.5) * 4 };
        const rightTrunkP0_offset = { x: rightTrunkP0.x + (Math.random() - 0.5) * 3, y: rightTrunkP0.y };

        const rightSegSketch = this.getBezierSegment(rightTrunkP3_offset, rightTrunkP2_offset, rightTrunkP1_offset, rightTrunkP0_offset, t_R);
        ctx.moveTo(rightSegSketch.p0.x, rightSegSketch.p0.y);
        ctx.bezierCurveTo(rightSegSketch.p1.x, rightSegSketch.p1.y, rightSegSketch.p2.x, rightSegSketch.p2.y, rightSegSketch.p3.x, rightSegSketch.p3.y);
        ctx.stroke();

        // Restore canvas — clip ends here; canopy and everything else draws freely
        ctx.restore();

        // 2b. Draw the Canopy Cloud-like outer crown (progressive draw if active)
        ctx.beginPath();
        ctx.strokeStyle = canopyStroke;
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.shadowBlur = this.isActivated ? 12 : 0;
        ctx.shadowColor = this.isActivated ? `hsla(${this.canopyHue}, 95%, 65%, 0.8)` : 'transparent';

        ctx.moveTo(canopyPoints[0].x, canopyPoints[0].y);
        const totalBumpsToDraw = t_C * numBumps;
        const fullBumps = Math.floor(totalBumpsToDraw);
        const fracBump = totalBumpsToDraw - fullBumps;

        for (let i = 0; i < numBumps; i++) {
            if (i > fullBumps) break;

            const p1 = canopyPoints[i];
            const p2 = canopyPoints[i + 1];

            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            const dx = mx - cx;
            const dy = my - cy;
            const len = Math.sqrt(dx * dx + dy * dy);
            const bumpHeight = 55 + Math.sin(i * 1.5) * 10;
            const cpx = mx + (dx / len) * bumpHeight;
            const cpy = my + (dy / len) * bumpHeight;

            if (i < fullBumps) {
                ctx.quadraticCurveTo(cpx, cpy, p2.x, p2.y);
            } else if (fracBump > 0) {
                const cp = { x: cpx, y: cpy };
                const seg = this.getQuadraticSegment(p1, cp, p2, fracBump);
                ctx.quadraticCurveTo(seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
            }
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // reset shadow

        // Draw Canopy - Fine overlap sketchy line
        ctx.beginPath();
        ctx.strokeStyle = canopySketchStroke;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.moveTo(canopyPoints[0].x + (Math.random() - 0.5) * 2, canopyPoints[0].y + (Math.random() - 0.5) * 2);
        for (let i = 0; i < numBumps; i++) {
            if (i > fullBumps) break;

            const p1 = canopyPoints[i];
            const p2 = canopyPoints[i + 1];

            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;

            const dx = mx - cx;
            const dy = my - cy;
            const len = Math.sqrt(dx * dx + dy * dy);

            const bumpHeight = 55 + Math.sin(i * 1.5) * 10 + (Math.random() - 0.5) * 3;
            const cpx = mx + (dx / len) * bumpHeight;
            const cpy = my + (dy / len) * bumpHeight;

            if (i < fullBumps) {
                ctx.quadraticCurveTo(cpx, cpy, p2.x + (Math.random() - 0.5) * 2, p2.y + (Math.random() - 0.5) * 2);
            } else if (fracBump > 0) {
                const cp = { x: cpx, y: cpy };
                const p2_offset = { x: p2.x + (Math.random() - 0.5) * 2, y: p2.y + (Math.random() - 0.5) * 2 };
                const seg = this.getQuadraticSegment(p1, cp, p2_offset, fracBump);
                ctx.quadraticCurveTo(seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
            }
        }
        ctx.stroke();

        // 3. Draw border canopy leaves
        if (this.activationStage === 'raining') {
            this.borderLeaves.forEach(l => {
                l.offset += l.pulseSpeed;
                // Breathe animation scale factor
                const breathing = Math.sin(l.offset) * 2.5;

                const color = this.isActivated ? l.color : 'rgba(255, 255, 255, 0.03)';
                this.drawSketchLeaf(ctx, l.x, l.y, l.size + breathing, color, l.angle);
            });
        }

        // 4. Update sparkles
        this.sparkles.forEach((s, idx) => {
            s.x += s.vx;
            s.y += s.vy;
            s.alpha -= s.decay;

            if (s.alpha <= 0) {
                this.sparkles.splice(idx, 1);
                return;
            }

            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fillStyle = s.color;
            ctx.globalAlpha = s.alpha;
            ctx.fill();
            ctx.globalAlpha = 1.0;
        });

        // 5. Update and Draw Dense Canopy & Plucked wishes (only in raining stage)
        if (this.activationStage === 'raining') {
            this.canopyLeaves.forEach(l => {
                if (!l.isPlucked) {
                    l.offset += l.pulseSpeed;
                    const breathing = Math.sin(l.offset) * 1.5;
                    this.drawSketchLeaf(ctx, l.x, l.y, l.size + breathing, l.color, l.angle);
                } else {
                    l.lifetime++;

                    // Apply subtle repulsion from other wishes to prevent overlap
                    this.canopyLeaves.forEach(other => {
                        if (other.isPlucked && other.id !== l.id) {
                            const dx = other.currentX - l.currentX;
                            const dy = other.currentY - l.currentY;
                            const minDistX = 110; // minimum horizontal distance
                            const minDistY = 40;  // minimum vertical distance

                            if (Math.abs(dx) < minDistX && Math.abs(dy) < minDistY) {
                                // Apply soft repelling force
                                const forceX = (minDistX - Math.abs(dx)) * 0.0004 * (dx > 0 ? -1 : 1);
                                const forceY = (minDistY - Math.abs(dy)) * 0.0004 * (dy > 0 ? -1 : 1);

                                l.vx += forceX;
                                l.vy += forceY;
                            }
                        }
                    });

                    // Damp and bound velocities to maintain slow, gentle drift
                    l.vx *= 0.98;
                    l.vy *= 0.98;
                    const speed = Math.sqrt(l.vx * l.vx + l.vy * l.vy);
                    const maxSpeed = 0.25;
                    if (speed > maxSpeed) {
                        l.vx = (l.vx / speed) * maxSpeed;
                        l.vy = (l.vy / speed) * maxSpeed;
                    }

                    // Drift position update
                    l.currentX += l.vx;
                    l.currentY += l.vy;

                    // Sway horizontal calculation
                    l.swayAngle += l.swaySpeed;
                    const swayOffset = Math.sin(l.swayAngle) * l.swayWidth;
                    const drawX = l.currentX + swayOffset;

                    // Real leaf floating sway tilt physics (keeps text readable and upright)
                    l.angle = Math.sin(l.lifetime * 0.035) * 0.3 + (l.vx * 0.6);

                    // Handle fading in at start / fading out at end of lifetime
                    let opacity = 0;
                    if (l.lifetime < 90) {
                        opacity = l.lifetime / 90;
                    } else if (l.lifetime > l.maxLifetime - 90) {
                        opacity = (l.maxLifetime - l.lifetime) / 90;
                    } else {
                        opacity = 1.0;
                    }

                    // Recycle leaf back to canopy
                    const distSq = Math.pow((l.currentX - cx) / rx, 2) + Math.pow((l.currentY - cy) / ry, 2);
                    if (l.lifetime >= l.maxLifetime || distSq > 0.95 || l.currentY > this.height - 180) {
                        l.isPlucked = false;
                        l.wish = null;
                        return;
                    }

                    // --- 1. Draw a slightly larger mask leaf to wipe out background lines/stars ---
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    ctx.translate(drawX, l.currentY);
                    ctx.rotate(l.angle);
                    const maskScale = 1.15; // 15% larger for a nice gap
                    const mw = l.leafW * maskScale;
                    const mh = l.leafH * maskScale;
                    ctx.beginPath();
                    ctx.moveTo(-mw, 0);
                    ctx.bezierCurveTo(-mw * 0.72, -mh, mw * 0.72, -mh, mw, 0);
                    ctx.bezierCurveTo(mw * 0.72, mh, -mw * 0.72, mh, -mw, 0);
                    ctx.closePath();
                    ctx.fillStyle = '#070814'; // Canvas background color
                    ctx.fill();
                    ctx.restore();

                    // Render wish as a morphing LEAF shape
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    ctx.translate(drawX, l.currentY);
                    ctx.rotate(l.angle);

                    // Morphing scale based on transition progress
                    const t = Math.min(1.0, l.lifetime / 90);
                    const currentW = l.size * 0.8 * (1 - t) + l.leafW * t;
                    const currentH = l.size * 0.4 * (1 - t) + l.leafH * t;

                    // --- 2. Leaf silhouette path ---
                    ctx.beginPath();
                    ctx.moveTo(-currentW, 0);
                    ctx.bezierCurveTo(-currentW * 0.72, -currentH, currentW * 0.72, -currentH, currentW, 0);
                    ctx.bezierCurveTo(currentW * 0.72, currentH, -currentW * 0.72, currentH, -currentW, 0);
                    ctx.closePath();

                    // Fill leaf
                    ctx.fillStyle = l.palette.fill;
                    ctx.shadowColor = l.palette.glow;
                    ctx.shadowBlur = this.isActivated ? 10 : 0;
                    ctx.fill();

                    // Leaf outline
                    ctx.strokeStyle = l.palette.vein;
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    // --- 3. Split Centre vein line to leave a gap in the center ---
                    ctx.beginPath();
                    ctx.moveTo(-currentW * 0.85, 0);
                    ctx.lineTo(-currentW * 0.35, 0); // left part
                    ctx.moveTo(currentW * 0.35, 0);
                    ctx.lineTo(currentW * 0.85, 0);  // right part
                    ctx.strokeStyle = l.palette.vein;
                    ctx.lineWidth = 0.8;
                    ctx.stroke();

                    ctx.shadowBlur = 0;

                    // Render text inside
                    if (t > 0.1) {
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';

                        const nameHeight = l.nameStr ? 10 : 0;
                        const gap = l.nameStr ? 3 : 0;
                        const totalMsgHeight = l.msgLines.length * l.lineHeight;
                        const totalHeight = nameHeight + gap + totalMsgHeight;
                        const startY = -totalHeight / 2;

                        ctx.globalAlpha = opacity * t;

                        // --- Name line ---
                        if (l.nameStr) {
                            ctx.font = 'bold 9px Outfit';
                            ctx.fillStyle = 'rgba(255,255,255,0.95)';
                            ctx.fillText(l.nameStr, 0, startY + 5);
                        }

                        // --- Message lines ---
                        ctx.font = `500 ${l.fontSize}px Outfit`;
                        ctx.fillStyle = 'rgba(255,255,255,0.88)';
                        const msgStartY = startY + nameHeight + gap;
                        l.msgLines.forEach((line, li) => {
                            ctx.fillText(line, 0, msgStartY + li * l.lineHeight + l.lineHeight / 2);
                        });
                    }

                    ctx.restore();
                }
            });
        }
    }
}

// Global initialization
let tree;
let ws;
let messagesLoaded = false;

function initDisplay() {
    tree = new BorderDreamTree("tree-canvas");

    function loop() {
        tree.update();
        requestAnimationFrame(loop);
    }
    loop();

    checkActivationState();
    connectWebSocket();
    window.addEventListener('keydown', handleKeyPress);
}

async function checkActivationState() {
    try {
        const response = await fetch("/api/status");
        if (response.ok) {
            const data = await response.json();
            tree.activationKey = data.activation_key;
            if (data.is_activated && !tree.isActivated) {
                // Instantly activate without animation transitions if DB already active on load
                tree.isActivated = true;
                tree.activationProgress = 1.0;
                tree.activationStage = 'raining';
                if (typeof activateTitle === 'function') activateTitle();
                loadExistingMessages();
            }
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadExistingMessages() {
    if (messagesLoaded) return;
    messagesLoaded = true;
    try {
        const response = await fetch("/api/messages");
        if (response.ok) {
            const wishes = await response.json();
            wishes.forEach(w => tree.addWish(w));
        }
    } catch (err) {
        console.error(err);
        messagesLoaded = false;
    }
}

function connectWebSocket() {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;

    ws = new WebSocket(`${proto}//${host}/api/ws`);

    ws.onmessage = function (event) {
        const payload = JSON.parse(event.data);

        if (payload.type === "activation_state") {
            if (payload.is_activated && !tree.isActivated) {
                tree.activate();
                setTimeout(loadExistingMessages, 3500);
            }
        } else if (payload.type === "new_message") {
            tree.addWish(payload.data);
        } else if (payload.type === "delete_message") {
            tree.deleteWish(payload.data.id);
        } else if (payload.type === "clear_tree") {
            tree.clearTree();
        }
    };

    ws.onclose = function () {
        console.log("WS closed, retrying...");
        setTimeout(connectWebSocket, 3000);
    };
}

function triggerActivation() {
    if (tree && !tree.isActivated) {
        tree.activate();

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: "keypress_activation"
            }));
        }

        fetch("/api/admin/toggle-activation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_activated: true })
        });

        setTimeout(loadExistingMessages, 3500);
    }
}

function handleKeyPress(event) {
    let pressedKey = event.key;
    if (pressedKey === " ") pressedKey = "Space";

    if (pressedKey === tree.activationKey && !tree.isActivated) {
        event.preventDefault();
        triggerActivation();
    }
}

window.onload = initDisplay;
