// Map layout: 5 rows × 6 cols, odd rows offset right by half a column.
// Pointy-top hexagons tile perfectly with row-offset grids.
// Touching hex geometry: col spacing = r*√3, row spacing = r*1.5
const ROOM_R     = 26;
const MAP_COL_W  = Math.round(ROOM_R * Math.sqrt(3)); // ≈ 45 — exact touching distance
const MAP_ROW_H  = Math.round(ROOM_R * 1.5);          // = 39 — exact touching distance
const MAP_MARGIN = 30;                                  // must be ≥ ROOM_R to keep top hex in canvas
const MAP_W = MAP_MARGIN * 2 + 5.5 * MAP_COL_W;
const MAP_H = MAP_MARGIN * 2 + 4   * MAP_ROW_H;

// For a pointy-top hex, face centres lie at angles 0°, 60°, 120°, 180°, 240°, 300°
// at distance = apothem (= r * √3/2) from the hex centre.
// Given a direction toward a target, return the point on the nearest face edge.
const APOTHEM = ROOM_R * Math.sqrt(3) / 2;
const FACE_ANGLES = [0, 1, 2, 3, 4, 5].map(i => i * Math.PI / 3);

function hexFacePoint(cx: number, cy: number, tx: number, ty: number): [number, number] {
    const angle = Math.atan2(ty - cy, tx - cx);
    let bestAngle = FACE_ANGLES[0];
    let bestDiff = Infinity;
    for (const fa of FACE_ANGLES) {
        let diff = Math.abs(angle - fa);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        if (diff < bestDiff) { bestDiff = diff; bestAngle = fa; }
    }
    return [cx + APOTHEM * Math.cos(bestAngle), cy + APOTHEM * Math.sin(bestAngle)];
}

// Pointy-top hexagon: vertex at top/bottom (angle = 60°*i − 90°)
function drawHexagon(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, r: number,
    fillStyle: string, strokeStyle: string, lineWidth: number
): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2; // −90° start → top vertex
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
}

function roomPos(room: number): [number, number] {
    const idx = room - 1;
    const row = Math.floor(idx / 6);
    const col = idx % 6;
    const x = MAP_MARGIN + col * MAP_COL_W + (row % 2) * (MAP_COL_W / 2);
    const y = MAP_MARGIN + row * MAP_ROW_H;
    return [x, y];
}

export default class Graphics {
    private canvas!: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;

    private elName!: HTMLElement;
    private elRoom!: HTMLElement;
    private elArrows!: HTMLElement;
    private elCoins!: HTMLElement;
    private elTurns!: HTMLElement;
    private elExits!: HTMLElement;
    private elWarnings!: HTMLElement;
    private elStatus!: HTMLElement;
    private elSecrets!: HTMLElement;

    private revealedRooms = new Map<number, number[]>();
    private currentRoom = 0;
    private wumpusRoom  = -1;
    private secrets: string[] = [];

    // Preload Homer and Wumpus sprites
    private homerImg  = new Image();
    private wumpusImg = new Image();
    // Processed (white-background-removed) version of the wumpus sprite
    private wumpusCanvas: HTMLCanvasElement | null = null;

    constructor() {
        this.homerImg.src  = new URL('../../assets/Homer_Simpson_2006.png', import.meta.url).href;
        this.wumpusImg.src = new URL('../../assets/wumpus.webp',            import.meta.url).href;
        this.wumpusImg.onload = () => {
            this.wumpusCanvas = this.removeWhiteBackground(this.wumpusImg);
            this.drawMap();
        };
    }

    // Draw the image to an offscreen canvas and zero-out near-white pixels
    private removeWhiteBackground(img: HTMLImageElement): HTMLCanvasElement {
        const c = document.createElement("canvas");
        c.width  = img.naturalWidth;
        c.height = img.naturalHeight;
        const cx = c.getContext("2d")!;
        cx.drawImage(img, 0, 0);
        const data = cx.getImageData(0, 0, c.width, c.height);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
            if (px[i] > 230 && px[i+1] > 230 && px[i+2] > 230) px[i+3] = 0;
        }
        cx.putImageData(data, 0, 0);
        return c;
    }

    // ── Intro music (Entrance of the Gladiators) ─────────────────

    private introAudio: HTMLAudioElement | null = null;

    private readonly gladiatorsUrl = new URL('../../assets/gladiators.m4a', import.meta.url).href;

    // Call from inside a click handler — starts the audio
    unlockAndPlayIntroMusic(): void {
        if (!this.introAudio) {
            this.introAudio = new Audio(this.gladiatorsUrl);
            this.introAudio.loop = true;
            this.introAudio.volume = 0.6;
        }
        if (this.introAudio.paused) {
            this.introAudio.play().catch(() => {});
        }
    }

    playIntroMusic(): void {
        // No-op — music is started explicitly via unlockAndPlayIntroMusic()
        // which must be called from within a user gesture (click handler).
    }

    stopIntroMusic(): void {
        if (this.introAudio) {
            this.introAudio.pause();
            this.introAudio.currentTime = 0;
        }
    }

    // ── Particle effects (confetti / blood) ───────────────────────

    private particleCanvas: HTMLCanvasElement | null = null;
    private particleAnimId: number | null = null;

    private startParticles(won: boolean): void {
        this.stopParticles();
        const canvas = document.createElement("canvas");
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:190;";
        document.body.appendChild(canvas);
        this.particleCanvas = canvas;

        const ctx = canvas.getContext("2d")!;
        const W = canvas.width, H = canvas.height;
        const CONFETTI_COLORS = ["#e74c3c","#f39c12","#2ecc71","#3498db","#9b59b6","#e91e63","#00bcd4","#ffeb3b"];

        type P = {
            x: number; y: number; vx: number; vy: number;
            rot: number; rotV: number; w: number; h: number;
            color: string;
        };

        const spawn = (): P => won ? {
            x: Math.random() * W,
            y: -15,
            vx: (Math.random() - 0.5) * 2.5,
            vy: 2.5 + Math.random() * 3.5,
            rot: Math.random() * Math.PI * 2,
            rotV: (Math.random() - 0.5) * 0.15,
            w: 6 + Math.random() * 9,
            h: 10 + Math.random() * 12,
            color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        } : {
            x: Math.random() * W,
            y: -15,
            vx: (Math.random() - 0.5) * 0.8,
            vy: 5 + Math.random() * 6,
            rot: 0, rotV: 0,
            w: 4 + Math.random() * 7,   // used as radius for drop
            h: 0, color: "",
        };

        // Stagger particles across the screen height initially
        const particles: P[] = Array.from({ length: 120 }, () => {
            const p = spawn(); p.y = Math.random() * H; return p;
        });

        const draw = (p: P) => {
            if (won) {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            } else {
                const r = p.w;
                // Teardrop: circle at bottom, pointed tip at top
                ctx.beginPath();
                ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                ctx.fillStyle = "#8B0000";
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(p.x - r * 0.5, p.y - r * 0.3);
                ctx.lineTo(p.x, p.y - r * 2.2);
                ctx.lineTo(p.x + r * 0.5, p.y - r * 0.3);
                ctx.fillStyle = "#8B0000";
                ctx.fill();
            }
        };

        const animate = () => {
            ctx.clearRect(0, 0, W, H);
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.x += p.vx; p.y += p.vy; p.rot += p.rotV;
                draw(p);
                if (p.y > H + 20) particles[i] = spawn();
            }
            this.particleAnimId = requestAnimationFrame(animate);
        };
        this.particleAnimId = requestAnimationFrame(animate);
    }

    private stopParticles(): void {
        if (this.particleAnimId !== null) { cancelAnimationFrame(this.particleAnimId); this.particleAnimId = null; }
        this.particleCanvas?.remove();
        this.particleCanvas = null;
    }

    setWumpusRoom(room: number): void {
        this.wumpusRoom = room;
        this.drawMap();
    }

    // ── Build game UI ────────────────────────────────────────────

    buildUI(container: HTMLElement): void {
        container.innerHTML = "";
        container.style.cssText = "font-family:monospace;background:#fff;color:#000;max-width:600px;margin:0 auto;padding:8px;";

        const stats = document.createElement("div");
        stats.style.cssText = "display:flex;gap:16px;border-bottom:2px solid #000;padding-bottom:4px;margin-bottom:8px;flex-wrap:wrap;";
        this.elName   = this.statSpan(stats, "Player: —");
        this.elRoom   = this.statSpan(stats, "Room: —");
        this.elArrows = this.statSpan(stats, "Arrows: —");
        this.elCoins  = this.statSpan(stats, "Coins: —");
        this.elTurns  = this.statSpan(stats, "Turns: —");
        container.appendChild(stats);

        this.canvas = document.createElement("canvas");
        this.canvas.width  = Math.ceil(MAP_W);
        this.canvas.height = Math.ceil(MAP_H);
        this.canvas.style.cssText = "display:block;border:1px solid #000;margin:0 auto 4px;max-width:100%;";
        this.ctx = this.canvas.getContext("2d")!;
        container.appendChild(this.canvas);

        // always-visible exits line
        this.elExits = document.createElement("div");
        this.elExits.style.cssText = "text-align:center;margin-bottom:6px;font-size:13px;";
        container.appendChild(this.elExits);

        // warnings
        this.elWarnings = document.createElement("div");
        this.elWarnings.style.cssText = "min-height:18px;font-weight:bold;margin-bottom:4px;color:#000;";
        container.appendChild(this.elWarnings);

        // status log
        this.elStatus = document.createElement("div");
        this.elStatus.style.cssText = "border:1px solid #000;height:80px;overflow-y:auto;padding:4px;margin-bottom:6px;white-space:pre-wrap;font-size:13px;";
        container.appendChild(this.elStatus);

        // secrets log (all purchased secrets)
        const secretsLabel = document.createElement("div");
        secretsLabel.style.cssText = "font-size:12px;font-weight:bold;margin-bottom:2px;";
        secretsLabel.textContent = "Secrets:";
        container.appendChild(secretsLabel);

        this.elSecrets = document.createElement("div");
        this.elSecrets.style.cssText = "border:1px dashed #000;min-height:20px;max-height:60px;overflow-y:auto;padding:4px;margin-bottom:8px;font-size:12px;white-space:pre-wrap;";
        container.appendChild(this.elSecrets);
    }

    private statSpan(parent: HTMLElement, text: string): HTMLElement {
        const s = document.createElement("span");
        s.textContent = text;
        parent.appendChild(s);
        return s;
    }

    // ── Stat updates ─────────────────────────────────────────────

    updatePlayerName(name: string): void   { this.elName.textContent   = `Player: ${name}`; }
    updateArrowCount(a: number): void      { this.elArrows.textContent = `Arrows: ${a}`; }
    updateCoinCount(c: number): void       { this.elCoins.textContent  = `Coins: ${c}`; }
    updateTurnCount(t: number): void       { this.elTurns.textContent  = `Turns: ${t}`; }
    updateCurrentRoom(n: number): void     { this.elRoom.textContent   = `Room: ${n}`; this.currentRoom = n; this.drawMap(); }
    updateRoomExits(_adj: number[]): void  { /* handled by revealRoom */ }
    updateScreen(): void                   { this.drawMap(); }

    revealRoom(room: number, connectedRooms: number[]): void {
        this.revealedRooms.set(room, connectedRooms);
        this.currentRoom = room;
        this.elRoom.textContent = `Room: ${room}`;
        this.elExits.textContent = `Exits: ${connectedRooms.map(r => `Room ${r}`).join("  |  ")}`;
        this.drawMap();
    }

    updateWarnings(warnings: string[]): void {
        this.elWarnings.textContent = warnings.join("   ");
    }

    updateStatusMessage(message: string): void {
        this.elStatus.textContent += (this.elStatus.textContent ? "\n" : "") + message;
        this.elStatus.scrollTop = this.elStatus.scrollHeight;
    }

    // Append a new secret to the running list
    addSecret(secret: string): void {
        this.secrets.push(secret);
        this.elSecrets.textContent = this.secrets.join("\n");
        this.elSecrets.scrollTop = this.elSecrets.scrollHeight;
    }

    // Legacy single-secret setter (no-op now; use addSecret)
    updateSecret(_secret: string): void {}

    clearStatus(): void { this.elStatus.textContent = ""; }

    // ── Map drawing ───────────────────────────────────────────────

    private drawMap(): void {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.5;
        this.revealedRooms.forEach((connected, room) => {
            const [x1, y1] = roomPos(room);
            connected.forEach(cr => {
                if (!this.revealedRooms.has(cr)) return;
                const [x2, y2] = roomPos(cr);
                // Skip wrapping connections that span most of the canvas
                if (Math.abs(x2 - x1) > MAP_COL_W * 3 || Math.abs(y2 - y1) > MAP_ROW_H * 3) return;
                // Draw from face centre to face centre so lines never exit through a vertex
                const [fx1, fy1] = hexFacePoint(x1, y1, x2, y2);
                const [fx2, fy2] = hexFacePoint(x2, y2, x1, y1);
                ctx.beginPath();
                ctx.moveTo(fx1, fy1);
                ctx.lineTo(fx2, fy2);
                ctx.stroke();
            });
        });

        this.revealedRooms.forEach((_, room) => {
            const [x, y] = roomPos(room);
            const isCurrent = room === this.currentRoom;

            drawHexagon(ctx, x, y, ROOM_R, "#fff", "#000", isCurrent ? 3 : 1.5);

            if (isCurrent) {
                const isWumpusRoom = this.wumpusRoom === room;
                const sprite: CanvasImageSource | null = isWumpusRoom
                    ? (this.wumpusCanvas ?? null)
                    : (this.homerImg.complete && this.homerImg.naturalWidth > 0 ? this.homerImg : null);
                if (sprite) {
                    const size = ROOM_R * 1.5;
                    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
                }
            }

            // Room number — small, bottom-centre of hex
            ctx.fillStyle = "#000";
            ctx.font = `${isCurrent ? "bold" : ""} 9px monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(room), x, y + ROOM_R * 0.72);
        });
    }

    // ── Trivia modal ─────────────────────────────────────────────

    showTriviaModal(
        question: string,
        answers: string[],
        qNum: number,
        totalQ: number,
        correctSoFar: number,
        required: number,
        onAnswer: (index: number) => void
    ): void {
        const overlay = document.createElement("div");
        overlay.id = "trivia-overlay";
        overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:100;";

        const box = document.createElement("div");
        box.style.cssText = "background:#fff;border:3px solid #000;padding:24px;max-width:480px;width:90%;font-family:monospace;";

        const header = document.createElement("p");
        header.style.cssText = "font-size:12px;margin-bottom:6px;border-bottom:1px solid #000;padding-bottom:6px;";
        header.textContent = `Question ${qNum} of ${totalQ}  |  Correct: ${correctSoFar}  |  Need: ${required}`;
        box.appendChild(header);

        const q = document.createElement("p");
        q.style.cssText = "font-weight:bold;margin-bottom:16px;";
        q.textContent = question;
        box.appendChild(q);

        answers.forEach((ans, i) => {
            const btn = document.createElement("button");
            btn.style.cssText = "display:block;width:100%;margin-bottom:8px;padding:8px;border:2px solid #000;background:#fff;font-family:monospace;font-size:14px;cursor:pointer;text-align:left;";
            btn.textContent = `${String.fromCharCode(65 + i)}) ${ans}`;
            btn.addEventListener("click", () => { this.closeTriviaModal(); onAnswer(i); });
            box.appendChild(btn);
        });

        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    closeTriviaModal(): void {
        document.getElementById("trivia-overlay")?.remove();
    }

    // ── Direction picker ─────────────────────────────────────────

    showDirectionPicker(
        label: string,
        connectedRooms: number[],
        directionNames: string[],
        onPick: (index: number) => void
    ): void {
        const overlay = document.createElement("div");
        overlay.id = "dir-overlay";
        overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:100;";

        const box = document.createElement("div");
        box.style.cssText = "background:#fff;border:3px solid #000;padding:24px;max-width:360px;width:90%;font-family:monospace;";

        const title = document.createElement("p");
        title.style.cssText = "font-weight:bold;margin-bottom:16px;";
        title.textContent = label;
        box.appendChild(title);

        connectedRooms.forEach((room, i) => {
            const btn = document.createElement("button");
            btn.style.cssText = "display:block;width:100%;margin-bottom:8px;padding:8px;border:2px solid #000;background:#fff;font-family:monospace;font-size:14px;cursor:pointer;text-align:left;";
            btn.textContent = `${directionNames[i]} → Room ${room}`;
            btn.addEventListener("click", () => { this.closeDirectionPicker(); onPick(i); });
            box.appendChild(btn);
        });

        const cancel = document.createElement("button");
        cancel.style.cssText = "display:block;width:100%;padding:8px;border:2px solid #000;background:#fff;font-family:monospace;font-size:14px;cursor:pointer;";
        cancel.textContent = "Cancel";
        cancel.addEventListener("click", () => this.closeDirectionPicker());
        box.appendChild(cancel);

        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    closeDirectionPicker(): void {
        document.getElementById("dir-overlay")?.remove();
    }

    // ── Cave picker ───────────────────────────────────────────────

    showCavePicker(caves: string[], onPick: (cave: string) => void): void {
        const container = document.getElementById("app") ?? document.body;
        container.innerHTML = "";
        container.style.cssText = "font-family:monospace;max-width:600px;margin:0 auto;padding:16px;";

        const title = document.createElement("h2");
        title.textContent = "Choose a Cave";
        container.appendChild(title);

        caves.forEach((cave, i) => {
            const btn = document.createElement("button");
            btn.style.cssText = "display:block;width:100%;margin-bottom:10px;padding:10px;border:2px solid #000;background:#fff;font-family:monospace;font-size:15px;cursor:pointer;text-align:left;";
            btn.textContent = `Cave ${i + 1}  (${cave})`;
            btn.addEventListener("click", () => { this.stopIntroMusic(); onPick(cave); });
            container.appendChild(btn);
        });
    }

    // ── Splash screen ────────────────────────────────────────────

    showSplashScreen(onEnter: () => void): void {
        const container = document.getElementById("app") ?? document.body;
        container.innerHTML = "";
        container.style.cssText = "font-family:monospace;background:#fff;color:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;padding:0;max-width:100%;text-align:center;";

        const title = document.createElement("h1");
        title.style.cssText = "font-size:clamp(2rem,6vw,4rem);margin-bottom:0.25em;letter-spacing:0.05em;";
        title.textContent = "HUNT THE WUMPUS";
        container.appendChild(title);

        const sub = document.createElement("p");
        sub.style.cssText = "font-size:1.1rem;margin-bottom:2.5em;opacity:0.6;";
        sub.textContent = "A game of caves, arrows, and a very unpleasant creature.";
        container.appendChild(sub);

        const btn = document.createElement("button");
        btn.style.cssText = [
            "padding:18px 48px",
            "border:4px solid #000",
            "background:#fff",
            "font-family:monospace",
            "font-size:1.4rem",
            "cursor:pointer",
            "letter-spacing:0.1em",
            "transition:background 0.15s,color 0.15s",
        ].join(";");
        btn.textContent = "CLICK HERE";
        btn.addEventListener("mouseenter", () => { btn.style.background = "#000"; btn.style.color = "#fff"; });
        btn.addEventListener("mouseleave", () => { btn.style.background = "#fff"; btn.style.color = "#000"; });
        btn.addEventListener("click", () => {
            this.unlockAndPlayIntroMusic();
            onEnter();
        });
        container.appendChild(btn);
    }

    // ── Bouncing intro sprites ────────────────────────────────────

    private addBouncingSprites(): void {
        this.removeBouncingSprites();

        // Inject keyframe animation once
        if (!document.getElementById("wumpus-bounce-style")) {
            const style = document.createElement("style");
            style.id = "wumpus-bounce-style";
            style.textContent = `
                @keyframes wumpusBounce {
                    0%, 100% { transform: translateY(0); }
                    50%       { transform: translateY(-40px); }
                }
                /* Wrapper fills the gap between screen edge and the 600px leaderboard */
                .intro-sprite-wrap {
                    position: fixed;
                    bottom: 60px;
                    display: flex;
                    justify-content: center;
                    align-items: flex-end;
                    width: calc((100vw - 600px) / 2);
                    pointer-events: none;
                    z-index: 0;
                }
                .intro-sprite-wrap-left  { left: 0; }
                .intro-sprite-wrap-right { right: 0; }
                /* Both images same size; animation sits on the img */
                .intro-sprite {
                    width: 50vh;
                    height: 50vh;
                    object-fit: contain;
                    animation: wumpusBounce 0.9s ease-in-out infinite;
                }
                .intro-sprite-wumpus { mix-blend-mode: multiply; }
            `;
            document.head.appendChild(style);
        }

        const homerWrap = document.createElement("div");
        homerWrap.className = "intro-sprite-wrap intro-sprite-wrap-left";
        const homer = document.createElement("img");
        homer.src = new URL('../../assets/Homer_Simpson_2006.png', import.meta.url).href;
        homer.className = "intro-sprite";
        homerWrap.appendChild(homer);
        document.body.appendChild(homerWrap);

        const wumpusWrap = document.createElement("div");
        wumpusWrap.className = "intro-sprite-wrap intro-sprite-wrap-right";
        const wumpus = document.createElement("img");
        wumpus.src = new URL('../../assets/wumpus.webp', import.meta.url).href;
        wumpus.className = "intro-sprite intro-sprite-wumpus";
        wumpusWrap.appendChild(wumpus);
        document.body.appendChild(wumpusWrap);
    }

    private removeBouncingSprites(): void {
        document.querySelectorAll(".intro-sprite-wrap").forEach(el => el.remove());
    }

    // ── High scores ───────────────────────────────────────────────

    showHighScores(scores: { name: string; score: number; cave: string; turns: number; coins: number; arrows: number }[], onStart: () => void): void {
        var container = document.getElementById("app");
        if (container == null) {
            container = document.body;
        }

        container.innerHTML = "";
        container.style.cssText = "font-family:monospace;max-width:600px;margin:0 auto;padding:16px;";

        const title = document.createElement("h1");
        title.style.cssText = "border-bottom:3px solid #000;padding-bottom:8px;";
        title.textContent = "HUNT THE WUMPUS";
        container.appendChild(title);


        const sub = document.createElement("h2");
        sub.textContent = "High Scores";
        container.appendChild(sub);

        if (scores.length === 0) {
            const none = document.createElement("p");
            none.textContent = "No scores yet.";
            container.appendChild(none);
        } else {
            const table = document.createElement("table");
            table.style.cssText = "border-collapse:collapse;width:100%;margin-bottom:16px;";
            const header = table.insertRow();
            ["#", "Name", "Score", "Cave", "Turns (N)", "Coins (G)", "Arrows (A)"].forEach(h => {
                const th = document.createElement("th");
                th.style.cssText = "border:1px solid #000;padding:4px 8px;text-align:left;";
                th.textContent = h;
                header.appendChild(th);
            });
            scores.forEach((score_in_array, score_index) => {
                const row = table.insertRow();
                const caveDisplay = score_in_array.cave ? score_in_array.cave.replace("cave", "") : "—";
                [String(score_index + 1), score_in_array.name, String(score_in_array.score), caveDisplay, String(score_in_array.turns ?? "—"), String(score_in_array.coins ?? "—"), String(score_in_array.arrows ?? "—")].forEach(val => {
                    const td = row.insertCell();
                    td.style.cssText = "border:1px solid #000;padding:4px 8px;";
                    td.textContent = val;
                });
            });
            container.appendChild(table);
        }

        const prompt = document.createElement("p");
        prompt.textContent = "Press Enter or click below to start a new game.";
        container.appendChild(prompt);

        const startBtn = document.createElement("button");
        startBtn.style.cssText = "padding:10px 24px;border:3px solid #000;background:#fff;font-family:monospace;font-size:16px;cursor:pointer;";
        startBtn.textContent = "[ START GAME ]";

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                this.unlockAndPlayIntroMusic();
                document.removeEventListener("keydown", onKey);
                onStart();
            }
        };
        startBtn.addEventListener("click", () => {
            this.unlockAndPlayIntroMusic();
            document.removeEventListener("keydown", onKey);
            onStart();
        });
        document.addEventListener("keydown", onKey);
        container.appendChild(startBtn);

        this.addBouncingSprites();
        this.playIntroMusic();
    }

    // ── Setup prompt ─────────────────────────────────────────────

    showSetupPrompt(onSubmit: (name: string) => void): void {
        this.removeBouncingSprites();
        const container = document.getElementById("app") ?? document.body;
        container.innerHTML = "";
        container.style.cssText = "font-family:monospace;max-width:600px;margin:0 auto;padding:16px;";

        const title = document.createElement("h2");
        title.textContent = "Enter Your Name";
        container.appendChild(title);

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Your name";
        input.style.cssText = "border:2px solid #000;padding:6px;font-family:monospace;font-size:16px;margin-right:8px;width:200px;";
        container.appendChild(input);

        const btn = document.createElement("button");
        btn.style.cssText = "padding:6px 16px;border:2px solid #000;background:#fff;font-family:monospace;font-size:16px;cursor:pointer;";
        btn.textContent = "OK";
        const submit = () => onSubmit(input.value.trim() || "Hunter");
        btn.addEventListener("click", submit);
        input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
        container.appendChild(btn);
        input.focus();
    }

    // ── Game over ─────────────────────────────────────────────────

    showGameOver(won: boolean, message: string, score: number, onContinue: () => void): void {
        this.startParticles(won);

        const overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;z-index:200;";

        const box = document.createElement("div");
        box.style.cssText = "background:#fff;border:4px solid #000;padding:32px;max-width:400px;width:90%;font-family:monospace;text-align:center;";

        const heading = document.createElement("h2");
        heading.textContent = won ? "YOU WIN!" : "GAME OVER";
        box.appendChild(heading);

        const msg = document.createElement("p");
        msg.textContent = message;
        box.appendChild(msg);

        const scoreEl = document.createElement("p");
        scoreEl.style.fontWeight = "bold";
        scoreEl.textContent = `Score: ${score}`;
        box.appendChild(scoreEl);

        const btn = document.createElement("button");
        btn.style.cssText = "margin-top:16px;padding:10px 24px;border:3px solid #000;background:#fff;font-family:monospace;font-size:16px;cursor:pointer;";
        btn.textContent = "Continue";
        btn.addEventListener("click", () => {
            this.unlockAndPlayIntroMusic(); // create AudioContext inside this gesture
            this.stopParticles();
            overlay.remove();
            onContinue();
        });
        box.appendChild(btn);

        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    // ── Game layout shell ─────────────────────────────────────────

    buildGameUI(
        container: HTMLElement,
        onMove: () => void,
        onShoot: () => void,
        onBuyArrows: () => void,
        onBuySecret: () => void
    ): void {
        this.stopIntroMusic();
        this.removeBouncingSprites();
        this.revealedRooms.clear();
        this.currentRoom = 0;
        this.secrets = [];

        this.buildUI(container);

        const actions = document.createElement("div");
        actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;";

        const makeBtn = (label: string, handler: () => void) => {
            const btn = document.createElement("button");
            btn.style.cssText = "padding:8px 14px;border:2px solid #000;background:#fff;font-family:monospace;font-size:14px;cursor:pointer;";
            btn.textContent = label;
            btn.addEventListener("click", handler);
            actions.appendChild(btn);
        };

        makeBtn("Move", onMove);
        makeBtn("Shoot Arrow", onShoot);
        makeBtn("Buy Arrows", onBuyArrows);
        makeBtn("Buy Secret", onBuySecret);

        container.appendChild(actions);
    }
}
