// Graphics handles every single thing the player sees (and hears during the intro).
// It builds the HTML/canvas UI, keeps it updated, and shows all the popup screens.
// GameControl calls methods on this class; Graphics never calls back into GameControl.

// ── Map layout constants ──────────────────────────────────────────────────────
// The cave is drawn as a 5-row × 6-column honeycomb of pointy-top hexagons.
// Odd-numbered rows are shifted right by half a column so the hexes tile flush.

const ROOM_R    = 50;                                  // radius of each hex (centre to vertex)
const MAP_COL_W = Math.round(ROOM_R * Math.sqrt(3));   // ≈ 87px — exact horizontal spacing for touching hexes
const MAP_ROW_H = Math.round(ROOM_R * 1.5);            // = 75px — exact vertical spacing for touching hexes
const MAP_MARGIN = 50;                                  // gap around the edge of the canvas (must be ≥ ROOM_R)
const MAP_W = MAP_MARGIN * 2 + 5.5 * MAP_COL_W;        // total canvas width
const MAP_H = MAP_MARGIN * 2 + 4   * MAP_ROW_H;        // total canvas height


// Draws a single pointy-top hexagon on a canvas context.
// The first vertex is at the top (−90°), going clockwise in 60° steps.
function drawHexagon(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, r: number,
    fillStyle: string, strokeStyle: string, lineWidth: number
): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2; // −90° = top vertex
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fillStyle; ctx.fill();
    ctx.strokeStyle = strokeStyle; ctx.lineWidth = lineWidth; ctx.stroke();
}

// Converts a room number (1–30) into pixel coordinates on the map canvas.
// Rooms are laid out in 5 rows of 6; odd rows are shifted right by half a column.
function roomPos(room: number): [number, number] {
    const idx = room - 1;
    const row = Math.floor(idx / 6);
    const col = idx % 6;
    const x = MAP_MARGIN + col * MAP_COL_W + (row % 2) * (MAP_COL_W / 2);
    const y = MAP_MARGIN + row * MAP_ROW_H;
    return [x, y];
}

// ── Graphics class ────────────────────────────────────────────────────────────

export default class Graphics {
    // The canvas element where the exploration map is drawn
    private canvas!: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;

    // References to the live HTML elements in the stats bar so we can update them cheaply
    private elName!: HTMLElement;
    private elRoom!: HTMLElement;
    private elArrows!: HTMLElement;
    private elCoins!: HTMLElement;
    private elTurns!: HTMLElement;
    private elExits!: HTMLElement;    // always-visible exits line below the map
    private elWarnings!: HTMLElement; // bold hazard warning line
    private elStatus!: HTMLElement;   // scrolling status log
    private elSecrets!: HTMLElement;  // accumulated purchased secrets

    // Which rooms the player has visited, and what exits each one has.
    // The map only draws rooms that appear in this collection (fog of war).
    private revealedRooms = new Map<number, number[]>();

    // The room the player is currently standing in
    private currentRoom = 0;

    // Which room the Wumpus (Mr Burns) is in — used to swap sprites
    private wumpusRoom = -1;

    // All secrets the player has purchased this game (displayed as a list)
    private secrets: string[] = [];

    // Whether the game is running in hard mode (trivia gets sabotaged)
    private hardMode = false;

    // True while the player is answering trivia inside a pit
    private inPit = false;

    // True while the player is fighting the Wumpus
    private inWumpusBattle = false;

    // The dark shaking overlay shown while the player is in a pit
    private pitOverlay: HTMLElement | null = null;

    // The dark shaking overlay shown during a Wumpus battle
    private wumpusOverlay: HTMLElement | null = null;
    // The two Wumpus sprite elements that float above the trivia modal
    private wumpusSprites: HTMLElement[] = [];

    // ── Sprite preloading ────────────────────────────────────────────

    // The Homer Simpson sprite shown in the player's current room
    private homerImg  = new Image();

    // The Mr Burns sprite shown when the player is in the Wumpus's room
    private wumpusImg = new Image();

    // A version of the Mr Burns image with its white background removed,
    // drawn to a hidden offscreen canvas during loading
    private wumpusCanvas: HTMLCanvasElement | null = null;

    // The donut image used instead of confetti rectangles on a win
    private donutImg    = new Image();
    // Background-removed version of the donut, drawn to a hidden offscreen canvas
    private donutCanvas: HTMLCanvasElement | null = null;
    // Transparent-background version (for spinning confetti)
    private donutDataUrl     = '';
    // White-background version (for bouncing donuts — zero transparent pixels)
    private donutFlatDataUrl = '';

    // The pointing finger used in the hard-mode trivia sabotage
    private fingerImg = new Image();

    // The rock image rained down while the player is in a pit
    private rockImg = new Image();

    // Looping audio for the pit and Wumpus-battle scenes
    private pitAudio:     HTMLAudioElement | null = null;
    private wumpusAudio:  HTMLAudioElement | null = null;
    private readonly pitSoundUrl     = new URL('../../assets/rocks.mp3',    import.meta.url).href;
    private readonly wumpusSoundUrl  = new URL('../../assets/laughter.mp3', import.meta.url).href;

    constructor() {
        // Start loading both sprites as soon as the class is created.
        // Vite resolves the URLs so they still work in the production build.
        this.homerImg.src  = new URL('../../assets/Homer_Simpson_2006.png', import.meta.url).href;
        this.wumpusImg.src = new URL('../../assets/Buns.webp',              import.meta.url).href;
        this.donutImg.src  = new URL('../../assets/doughnut.png',           import.meta.url).href;
        this.fingerImg.src = new URL('../../assets/finger.webp',                 import.meta.url).href;
        this.rockImg.src   = new URL('../../assets/a-large-gray-rock-is-the-central-element-exhibiting-a-rough-texture-and-natural-patterns-that-convey-solidity-and-geological-history-free-png.png.webp', import.meta.url).href;
        // Remove the background of the donut image using a flood-fill from the corners,
        // then cache a data URL so every donut display (border, bouncing, confetti) is clean.
        this.donutImg.onload = () => {
            // Step 1 — remove the background by flood-filling from every corner
            // AND from the centre (catches the enclosed donut hole).
            // This works regardless of whether the background is white, grey, or a
            // checkerboard pattern — it samples the corner pixel's actual colour.
            this.donutCanvas  = this.floodFillRemoveBackground(this.donutImg);
            this.donutDataUrl = this.donutCanvas.toDataURL();

            // Step 2 — create a fully opaque (white-backed) version for bouncing
            // donuts so zero transparent pixels can ever show through.
            const flat = document.createElement("canvas");
            flat.width  = this.donutCanvas.width;
            flat.height = this.donutCanvas.height;
            const fctx  = flat.getContext("2d")!;
            fctx.fillStyle = "#fff";
            fctx.fillRect(0, 0, flat.width, flat.height);
            fctx.drawImage(this.donutCanvas, 0, 0);   // transparent canvas on white
            this.donutFlatDataUrl = flat.toDataURL();
            // Retroactively update any border elements already in the DOM
            document.querySelectorAll<HTMLElement>(".donut-border").forEach(el => {
                el.style.backgroundImage = `url(${this.donutDataUrl})`;
            });
            // (Bouncing donut imgs use the raw PNG on purpose — white bg blends with the page)
        };

        // Once Mr Burns has loaded, strip his white background and refresh the map
        this.wumpusImg.onload = () => {
            this.wumpusCanvas = this.removeWhiteBackground(this.wumpusImg);
            this.drawMap();
        };
    }

    // Draws the image onto a hidden canvas, then loops through every pixel.
    // Any pixel that is near-white (R, G, B all above 230) gets its
    // alpha (opacity) set to 0, making it transparent.
    private removeWhiteBackground(img: HTMLImageElement): HTMLCanvasElement {
        const c  = document.createElement("canvas");
        c.width  = img.naturalWidth;
        c.height = img.naturalHeight;
        const cx = c.getContext("2d")!;
        cx.drawImage(img, 0, 0);
        const data = cx.getImageData(0, 0, c.width, c.height);
        const px   = data.data; // flat array: R, G, B, A, R, G, B, A, ...
        for (let i = 0; i < px.length; i += 4) {
            if (px[i] > 230 && px[i+1] > 230 && px[i+2] > 230) px[i+3] = 0;
        }
        cx.putImageData(data, 0, 0);
        return c;
    }

    // Removes the background of an image by flood-filling from the four corners
    // AND the image centre (to catch the enclosed donut hole).
    // Samples the top-left corner colour and erases all connected pixels within
    // a colour tolerance — works for white, grey, or any uniform background.
    private floodFillRemoveBackground(img: HTMLImageElement): HTMLCanvasElement {
        const c  = document.createElement("canvas");
        c.width  = img.naturalWidth;
        c.height = img.naturalHeight;
        const cx = c.getContext("2d")!;
        cx.drawImage(img, 0, 0);

        const W = c.width, H = c.height;
        const imageData = cx.getImageData(0, 0, W, H);
        const d = imageData.data;

        const bgR = d[0], bgG = d[1], bgB = d[2];
        const TOLERANCE = 60; // generous tolerance to catch checkerboard greys

        const isBg = (i: number) =>
            d[i+3] > 0 &&
            Math.abs(d[i]   - bgR) <= TOLERANCE &&
            Math.abs(d[i+1] - bgG) <= TOLERANCE &&
            Math.abs(d[i+2] - bgB) <= TOLERANCE;

        const visited = new Uint8Array(W * H);
        const queue: number[] = [];

        const tryEnqueue = (px: number) => {
            if (px >= 0 && px < W * H && !visited[px] && isBg(px * 4)) {
                visited[px] = 1;
                queue.push(px);
            }
        };

        // Seed from all four corners AND the centre to catch the donut hole
        tryEnqueue(0);
        tryEnqueue(W - 1);
        tryEnqueue(W * (H - 1));
        tryEnqueue(W * H - 1);
        tryEnqueue(Math.floor(H / 2) * W + Math.floor(W / 2));

        while (queue.length > 0) {
            const px = queue.pop()!;
            d[px * 4 + 3] = 0;
            const x = px % W, y = Math.floor(px / W);
            if (x > 0)   tryEnqueue(px - 1);
            if (x < W-1) tryEnqueue(px + 1);
            if (y > 0)   tryEnqueue(px - W);
            if (y < H-1) tryEnqueue(px + W);
        }

        cx.putImageData(imageData, 0, 0);
        return c;
    }

    // ── Intro music ───────────────────────────────────────────────────────────
    // Uses an HTML <audio> element with the real M4A recording.
    // Must be called from inside a click handler — browsers block audio
    // that starts without any user interaction first.

    private introAudio: HTMLAudioElement | null = null;

    // Vite bundles the audio file and gives us a stable URL for it
    private readonly gladiatorsUrl = new URL('../../assets/simpsons song.mp3', import.meta.url).href;

    // Creates the audio element on first call, then starts playing (looping).
    // Safe to call multiple times — won't restart if already playing.
    unlockAndPlayIntroMusic(): void {
        if (!this.introAudio) {
            this.introAudio          = new Audio(this.gladiatorsUrl);
            this.introAudio.loop     = true;
            this.introAudio.volume   = 0.6;
        }
        if (this.introAudio.paused) {
            this.introAudio.play().catch(() => {}); // silently swallow any autoplay blocks
        }
    }

    // Called by showHighScores — does nothing here because music is only started
    // from explicit button clicks (unlockAndPlayIntroMusic handles it)
    playIntroMusic(): void {}

    // Pauses the intro music and rewinds it to the beginning
    stopIntroMusic(): void {
        if (this.introAudio) {
            this.introAudio.pause();
            this.introAudio.currentTime = 0;
        }
    }

    // ── Particle effects ──────────────────────────────────────────────────────
    // A full-screen canvas is overlaid on the page and animates 120 particles.
    // Win → colourful spinning confetti rectangles
    // Lose → dark red blood teardrop shapes

    private particleCanvas: HTMLCanvasElement | null = null;
    private particleAnimId: number | null = null;

    private startParticles(won: boolean): void {
        this.stopParticles(); // remove any leftover particles from a previous round

        // Create a full-screen canvas that sits above the game UI but below the modal
        const canvas       = document.createElement("canvas");
        canvas.width       = window.innerWidth;
        canvas.height      = window.innerHeight;
        canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:190;";
        document.body.appendChild(canvas);
        this.particleCanvas = canvas;

        const ctx = canvas.getContext("2d")!;
        const W = canvas.width, H = canvas.height;
        const CONFETTI_COLORS = ["#e74c3c","#f39c12","#2ecc71","#3498db","#9b59b6","#e91e63","#00bcd4","#ffeb3b"];

        // Each particle is a plain object with position, velocity, rotation, and size
        type P = { x: number; y: number; vx: number; vy: number; rot: number; rotV: number; w: number; h: number; color: string; };

        // Returns a freshly spawned particle just above the top of the screen
        const spawn = (): P => won ? {
            x: Math.random() * W, y: -15,
            vx: (Math.random() - 0.5) * 2.5,
            vy: 2.5 + Math.random() * 3.5,
            rot: Math.random() * Math.PI * 2,
            rotV: (Math.random() - 0.5) * 0.08,
            w: 55 + Math.random() * 35,   // 55–90 px — donuts are big and round
            h: 55 + Math.random() * 35,
            color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        } : {
            x: Math.random() * W, y: -15,
            vx: (Math.random() - 0.5) * 0.8,
            vy: 5 + Math.random() * 6,
            rot: 0, rotV: 0,
            w: 4 + Math.random() * 7, // doubles as the drop radius
            h: 0, color: "",
        };

        // Stagger the starting Y positions so the screen fills immediately
        const particles: P[] = Array.from({ length: 120 }, () => {
            const p = spawn(); p.y = Math.random() * H; return p;
        });

        // Draw a single particle — either a spinning donut or a blood teardrop
        const draw = (p: P) => {
            if (won) {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                // Draw the background-stripped donut centred on the particle position
                const donutSrc = this.donutCanvas ?? (this.donutImg.complete ? this.donutImg : null);
                if (donutSrc) {
                    ctx.drawImage(donutSrc, -p.w / 2, -p.h / 2, p.w, p.h);
                } else {
                    // Fallback pink circle while image loads
                    ctx.beginPath();
                    ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
                    ctx.fillStyle = "#ff69b4";
                    ctx.fill();
                }
                ctx.restore();
            } else {
                const r = p.w;
                // Round bottom
                ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                ctx.fillStyle = "#8B0000"; ctx.fill();
                // Pointed tip above
                ctx.beginPath();
                ctx.moveTo(p.x - r * 0.5, p.y - r * 0.3);
                ctx.lineTo(p.x,           p.y - r * 2.2);
                ctx.lineTo(p.x + r * 0.5, p.y - r * 0.3);
                ctx.fillStyle = "#8B0000"; ctx.fill();
            }
        };

        // Animation loop — runs every frame until stopParticles() is called
        const animate = () => {
            ctx.clearRect(0, 0, W, H);
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.x += p.vx; p.y += p.vy; p.rot += p.rotV;
                draw(p);
                if (p.y > H + 20) particles[i] = spawn(); // recycle off-screen particles
            }
            this.particleAnimId = requestAnimationFrame(animate);
        };
        this.particleAnimId = requestAnimationFrame(animate);
    }

    // Cancels the animation loop and removes the canvas from the page
    private stopParticles(): void {
        if (this.particleAnimId !== null) { cancelAnimationFrame(this.particleAnimId); this.particleAnimId = null; }
        this.particleCanvas?.remove();
        this.particleCanvas = null;
    }

    // ── Rock particles (pit) ──────────────────────────────────────────────────
    // Rocks rain down behind the pit overlay (z-index 51) while the player is
    // answering trivia to escape. Same pattern as startParticles().

    private rockCanvas:  HTMLCanvasElement | null = null;
    private rockAnimId:  number | null = null;

    private startRockParticles(): void {
        this.stopRockParticles();

        const canvas       = document.createElement("canvas");
        canvas.width       = window.innerWidth;
        canvas.height      = window.innerHeight;
        // z-index 51: above the dark pit overlay (50) but well below the trivia modal (100)
        canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:51;";
        document.body.appendChild(canvas);
        this.rockCanvas = canvas;

        const ctx = canvas.getContext("2d")!;
        const W = canvas.width, H = canvas.height;

        type R = { x: number; y: number; vx: number; vy: number; rot: number; rotV: number; w: number; h: number };

        const aspect = (this.rockImg.naturalHeight || 120) / (this.rockImg.naturalWidth || 150);

        const spawn = (): R => {
            const w = 55 + Math.random() * 50;   // 55–105 px wide
            return {
                x:    Math.random() * W,
                y:    -80,
                vx:   (Math.random() - 0.5) * 3,
                vy:   3 + Math.random() * 4,
                rot:  Math.random() * Math.PI * 2,
                rotV: (Math.random() - 0.5) * 0.05,
                w,
                h: w * aspect,
            };
        };

        // Stagger initial positions so rocks are already mid-fall when the overlay opens
        const particles: R[] = Array.from({ length: 18 }, () => {
            const p = spawn(); p.y = Math.random() * H; return p;
        });

        const animate = () => {
            ctx.clearRect(0, 0, W, H);
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.x += p.vx; p.y += p.vy; p.rot += p.rotV;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                if (this.rockImg.complete && this.rockImg.naturalWidth > 0) {
                    ctx.drawImage(this.rockImg, -p.w / 2, -p.h / 2, p.w, p.h);
                } else {
                    // Fallback grey oval while image loads
                    ctx.beginPath();
                    ctx.ellipse(0, 0, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
                    ctx.fillStyle = "#888";
                    ctx.fill();
                }
                ctx.restore();

                if (p.y > H + 100) particles[i] = spawn();
            }
            this.rockAnimId = requestAnimationFrame(animate);
        };
        this.rockAnimId = requestAnimationFrame(animate);
    }

    private stopRockParticles(): void {
        if (this.rockAnimId !== null) { cancelAnimationFrame(this.rockAnimId); this.rockAnimId = null; }
        this.rockCanvas?.remove();
        this.rockCanvas = null;
    }

    // ── Wumpus room tracking ──────────────────────────────────────────────────

    // Called by GameControl whenever the Wumpus moves to a new room.
    // Stores the room number so drawMap() knows which sprite to show.
    setWumpusRoom(room: number): void {
        this.wumpusRoom = room;
        this.drawMap();
    }

    // ── In-game UI builder ────────────────────────────────────────────────────

    // Creates all the HTML elements that make up the game screen:
    // stats bar → map canvas → exits line → warnings → status log → secrets box.
    buildUI(container: HTMLElement): void {
        container.innerHTML = "";
        container.style.cssText = "font-family:monospace;background:#fff;color:#000;max-width:600px;margin:0 auto;padding:8px;";

        // Stats bar across the top
        const stats = document.createElement("div");
        stats.style.cssText = "display:flex;gap:16px;border-bottom:2px solid #000;padding-bottom:4px;margin-bottom:8px;flex-wrap:wrap;";
        this.elName   = this.statSpan(stats, "Player: —");
        this.elRoom   = this.statSpan(stats, "Room: —");
        this.elArrows = this.statSpan(stats, "Arrows: —");
        this.elCoins  = this.statSpan(stats, "Donuts: —");
        this.elTurns  = this.statSpan(stats, "Turns: —");
        container.appendChild(stats);

        // Map canvas — the hex grid is drawn here
        this.canvas        = document.createElement("canvas");
        this.canvas.width  = Math.ceil(MAP_W);
        this.canvas.height = Math.ceil(MAP_H);
        this.canvas.style.cssText = "display:block;border:1px solid #000;margin:0 auto 4px;max-width:100%;";
        this.ctx = this.canvas.getContext("2d")!;
        container.appendChild(this.canvas);

        // Always-visible list of rooms the player can move into from here
        this.elExits = document.createElement("div");
        this.elExits.style.cssText = "text-align:center;margin-bottom:6px;font-size:13px;";
        container.appendChild(this.elExits);

        // Bold warning line (Wumpus / bats / pit nearby)
        this.elWarnings = document.createElement("div");
        this.elWarnings.style.cssText = "min-height:18px;font-weight:bold;margin-bottom:4px;color:#000;";
        container.appendChild(this.elWarnings);

        // Scrolling event log — every status message appends here
        this.elStatus = document.createElement("div");
        this.elStatus.style.cssText = "border:1px solid #000;height:80px;overflow-y:auto;padding:4px;margin-bottom:6px;white-space:pre-wrap;font-size:13px;";
        container.appendChild(this.elStatus);

        // Secrets panel — accumulates every secret the player has purchased
        const secretsLabel = document.createElement("div");
        secretsLabel.style.cssText = "font-size:12px;font-weight:bold;margin-bottom:2px;";
        secretsLabel.textContent = "Secrets:";
        container.appendChild(secretsLabel);

        this.elSecrets = document.createElement("div");
        this.elSecrets.style.cssText = "border:1px dashed #000;min-height:20px;max-height:60px;overflow-y:auto;padding:4px;margin-bottom:8px;font-size:12px;white-space:pre-wrap;";
        container.appendChild(this.elSecrets);
    }

    // Helper that creates a <span> inside a parent element and returns it
    private statSpan(parent: HTMLElement, text: string): HTMLElement {
        const s = document.createElement("span");
        s.textContent = text;
        parent.appendChild(s);
        return s;
    }

    // Adds black-on-hover / pink-on-leave to any button
    private addHover(btn: HTMLButtonElement): void {
        btn.addEventListener("mouseenter", () => { btn.style.background = "#000"; btn.style.color = "#fff"; });
        btn.addEventListener("mouseleave", () => { btn.style.background = "#FFB6C1"; btn.style.color = "#000"; });
    }

    // ── Live stat updates ─────────────────────────────────────────────────────
    // Each method updates exactly one element in the stats bar or UI.

    updatePlayerName(name: string): void   { this.elName.textContent   = `Player: ${name}`; }
    updateArrowCount(a: number): void      { this.elArrows.textContent = `Arrows: ${a}`; }
    updateCoinCount(c: number): void       { this.elCoins.textContent  = `Donuts: ${c}`; }
    updateTurnCount(t: number): void       { this.elTurns.textContent  = `Turns: ${t}`; }
    updateCurrentRoom(n: number): void     { this.elRoom.textContent   = `Room: ${n}`; this.currentRoom = n; this.drawMap(); }
    updateRoomExits(_adj: number[]): void  { /* exits are handled by revealRoom() instead */ }
    updateScreen(): void                   { this.drawMap(); }

    // Adds a room to the fog-of-war map, updates the exits line, and redraws.
    // Called every time the player enters a new room.
    revealRoom(room: number, connectedRooms: number[]): void {
        this.revealedRooms.set(room, connectedRooms);
        this.currentRoom         = room;
        this.elRoom.textContent  = `Room: ${room}`;
        this.elExits.textContent = `Exits: ${connectedRooms.map(r => `Room ${r}`).join("  |  ")}`;
        this.drawMap();
    }

    // Replaces the warning line with the current set of hazard warnings
    updateWarnings(warnings: string[]): void {
        this.elWarnings.textContent = warnings.join("   ");
    }

    // Appends a line to the scrolling status log and auto-scrolls to the bottom
    updateStatusMessage(message: string): void {
        this.elStatus.textContent += (this.elStatus.textContent ? "\n" : "") + message;
        this.elStatus.scrollTop    = this.elStatus.scrollHeight;
    }

    // Adds a newly purchased secret to the list (all secrets stay visible)
    addSecret(secret: string): void {
        this.secrets.push(secret);
        this.elSecrets.textContent = this.secrets.join("\n");
        this.elSecrets.scrollTop   = this.elSecrets.scrollHeight;
    }

    updateSecret(_secret: string): void {} // replaced by addSecret; kept for interface compatibility

    clearStatus(): void { this.elStatus.textContent = ""; }

    // ── Map drawing ───────────────────────────────────────────────────────────

    // Redraws the entire exploration map from scratch.
    // Only rooms that have been visited are shown (fog of war).
    // The current room shows Homer or Mr Burns depending on whether the Wumpus is there.
    private drawMap(): void {
        if (!this.ctx) return; // canvas not built yet (e.g. called from image onload before buildUI)
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw the hex rooms.
        this.revealedRooms.forEach((_, room) => {
            const [x, y]    = roomPos(room);
            const isCurrent = room === this.currentRoom;

            // White hex with thicker border for the current room
            drawHexagon(ctx, x, y, ROOM_R, "#fff", "#000", isCurrent ? 3 : 1.5);

            // Draw the character sprite inside the player's current room
            if (isCurrent) {
                const isWumpusRoom = this.wumpusRoom === room;
                // Use Mr Burns if the Wumpus is here, otherwise use Homer
                const sprite: CanvasImageSource | null = isWumpusRoom
                    ? (this.wumpusCanvas ?? null)
                    : (this.homerImg.complete && this.homerImg.naturalWidth > 0 ? this.homerImg : null);
                if (sprite) {
                    const size = ROOM_R * 1.5;
                    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
                }
            }

            // Small room number at the bottom of each hex
            ctx.fillStyle     = "#000";
            ctx.font          = `${isCurrent ? "bold" : ""} 9px monospace`;
            ctx.textAlign     = "center";
            ctx.textBaseline  = "middle";
            ctx.fillText(String(room), x, y + ROOM_R * 0.72);
        });
    }

    // ── Trivia modal ──────────────────────────────────────────────────────────

    // Shows a full-screen dimmed overlay with the trivia question, four answer
    // buttons, and a progress header (e.g. "Question 2 of 3 | Correct: 1 | Need: 2").
    // Calls onAnswer(index) when the player clicks an answer button.
    // In hard mode the buttons scramble and a finger auto-clicks the wrong answer.
    showTriviaModal(
        question: string,
        answers: string[],
        qNum: number, totalQ: number, correctSoFar: number, required: number,
        correctAnswerIndex: number,
        onAnswer: (index: number) => void
    ): void {
        const overlay = document.createElement("div");
        overlay.id = "trivia-overlay";
        overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:100;";

        const box = document.createElement("div");
        box.style.cssText = "background:#fff;border:3px solid #000;padding:24px;max-width:480px;width:90%;font-family:monospace;";

        // Show a context banner at the top of the modal when in a special situation
        if (this.inPit) {
            const banner = document.createElement("div");
            banner.style.cssText = [
                "background:#8B0000", "color:#fff", "font-weight:bold",
                "padding:6px 12px", "margin-bottom:12px",
                "font-size:13px", "text-align:center", "letter-spacing:0.05em",
            ].join(";");
            banner.textContent = "⬇  YOU ARE IN A PIT  ⬇";
            box.appendChild(banner);
        } else if (this.inWumpusBattle) {
            const banner = document.createElement("div");
            banner.style.cssText = [
                "background:#8B4500", "color:#fff", "font-weight:bold",
                "padding:6px 12px", "margin-bottom:12px",
                "font-size:13px", "text-align:center", "letter-spacing:0.05em",
            ].join(";");
            banner.textContent = "⚔  YOU ARE FIGHTING THE WUMPUS  ⚔";
            box.appendChild(banner);
        }

        // Progress line at the top of the modal
        const header = document.createElement("p");
        header.style.cssText = "font-size:12px;margin-bottom:6px;border-bottom:1px solid #000;padding-bottom:6px;";
        header.textContent = `Question ${qNum} of ${totalQ}  |  Correct: ${correctSoFar}  |  Need: ${required}`;
        box.appendChild(header);

        // The question text
        const q = document.createElement("p");
        q.style.cssText   = "font-weight:bold;margin-bottom:16px;";
        q.textContent     = question;
        box.appendChild(q);

        // One button per answer (labelled A, B, C, D)
        const btns: HTMLButtonElement[] = [];
        answers.forEach((ans, i) => {
            const btn = document.createElement("button");
            btn.style.cssText = "display:block;width:100%;margin-bottom:8px;padding:8px;border:2px solid #000;background:#FFB6C1;font-family:monospace;font-size:14px;cursor:pointer;text-align:left;transition:transform 0.12s;";
            btn.textContent   = `${String.fromCharCode(65 + i)}) ${ans}`;
            this.addHover(btn);

            if (this.hardMode) {
                // In hard mode the player's click triggers the gag sequence.
                // reportedIndices tracks which answer index each button position reports;
                // swapping text also swaps these so the submitted answer is always wrong.
                btn.addEventListener("click", () => {
                    const clickedIdx = i;
                    btns.forEach(b => b.style.pointerEvents = "none");

                    // reportedIndices[pos] = the answer index that will be submitted if pos is clicked
                    const reportedIndices = answers.map((_, k) => k);

                    // Phase 1 — scramble labels + indices 6 times over 600 ms
                    let shufflesDone = 0;
                    const scrambleInterval = setInterval(() => {
                        const a = Math.floor(Math.random() * btns.length);
                        let   b = Math.floor(Math.random() * (btns.length - 1));
                        if (b >= a) b++;
                        [btns[a].textContent,    btns[b].textContent   ] = [btns[b].textContent,    btns[a].textContent   ];
                        [reportedIndices[a],      reportedIndices[b]    ] = [reportedIndices[b],      reportedIndices[a]    ];
                        btns[a].style.transform = "scale(1.08)";
                        btns[b].style.transform = "scale(1.08)";
                        setTimeout(() => { btns[a].style.transform = ""; btns[b].style.transform = ""; }, 80);

                        shufflesDone++;
                        if (shufflesDone >= 6) {
                            clearInterval(scrambleInterval);

                            // Phase 2 — ensure the clicked spot now holds a wrong answer.
                            // If the correct answer drifted to clickedIdx, swap it away.
                            if (reportedIndices[clickedIdx] === correctAnswerIndex) {
                                // Find any other position that is NOT the correct answer
                                const swapTo = reportedIndices.findIndex(
                                    (ri, k) => k !== clickedIdx && ri !== correctAnswerIndex
                                );
                                if (swapTo !== -1) {
                                    [btns[clickedIdx].textContent, btns[swapTo].textContent] =
                                        [btns[swapTo].textContent,  btns[clickedIdx].textContent];
                                    [reportedIndices[clickedIdx],  reportedIndices[swapTo]] =
                                        [reportedIndices[swapTo],   reportedIndices[clickedIdx]];
                                }
                            }

                            // Phase 3 — finger goes to the button the player clicked.
                            //
                            // Finger image points upward naturally; rotate(-90deg) makes tip point left.
                            // After rotate(-90deg):
                            //   visual width  = cssH  (CSS height spans horizontally)
                            //   visual height = cssW  (CSS width  spans vertically)
                            //   visual centre x = layout_left + cssW/2  (rotation is around element centre)
                            //
                            // "Half the finger inside the box" means the visual midpoint is at rect.right:
                            //   layout_left + cssW/2 = rect.right  →  layout_left = rect.right - cssW/2
                            const targetBtn = btns[clickedIdx];
                            const rect      = targetBtn.getBoundingClientRect();
                            const btnCY     = rect.top + rect.height / 2;

                            const imgNW  = this.fingerImg.naturalWidth  || 80;
                            const imgNH  = this.fingerImg.naturalHeight || 160;
                            const aspect = imgNH / imgNW;
                            // Fixed size so the finger is always the same and stops at the same
                            // depth regardless of whether the answer text wraps or not.
                            const cssW   = 36;
                            const cssH   = cssW * aspect;

                            const finalLeft = rect.right - cssW / 2;   // exactly half the finger inside
                            const topPos    = btnCY - cssH / 2;

                            const finger = document.createElement("img");
                            finger.id  = "hard-mode-finger";
                            finger.src = this.fingerImg.src;
                            finger.style.cssText = [
                                "position:fixed",
                                `left:${window.innerWidth + 80}px`,
                                `top:${topPos}px`,
                                `width:${cssW}px`,
                                `height:${cssH}px`,
                                "transform:rotate(-90deg)",
                                "z-index:9999",
                                "pointer-events:none",
                                "transition:left 0.75s cubic-bezier(0.25,0.46,0.45,0.94)",
                            ].join(";");
                            document.body.appendChild(finger);

                            requestAnimationFrame(() => requestAnimationFrame(() => {
                                finger.style.left = `${finalLeft}px`;
                            }));

                            // Phase 4 — submit the wrong answer after the finger arrives
                            setTimeout(() => {
                                finger.remove();
                                this.closeTriviaModal();
                                onAnswer(reportedIndices[clickedIdx]); // guaranteed ≠ correctAnswerIndex
                            }, 900);
                        }
                    }, 100);
                });
            } else {
                btn.addEventListener("click", () => { this.closeTriviaModal(); onAnswer(i); });
            }

            btns.push(btn);
            box.appendChild(btn);
        });

        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    // Removes the trivia overlay from the page
    closeTriviaModal(): void {
        document.getElementById("trivia-overlay")?.remove();
    }

    // ── Direction picker ──────────────────────────────────────────────────────

    // Shows a popup listing every room the player can move into (or shoot into),
    // with the compass direction for each. Calls onPick(index) when one is chosen.
    showDirectionPicker(
        label: string,
        connectedRooms: number[],
        _directionNames: string[],
        onPick: (index: number) => void
    ): void {
        const overlay = document.createElement("div");
        overlay.id = "dir-overlay";
        overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:100;";

        const box = document.createElement("div");
        box.style.cssText = "background:#fff;border:3px solid #000;padding:24px;max-width:360px;width:90%;font-family:monospace;";

        const title = document.createElement("p");
        title.style.cssText  = "font-weight:bold;margin-bottom:16px;";
        title.textContent    = label;
        box.appendChild(title);

        // One button per available exit
        connectedRooms.forEach((room, i) => {
            const btn = document.createElement("button");
            btn.style.cssText = "display:block;width:100%;margin-bottom:8px;padding:8px;border:2px solid #000;background:#FFB6C1;font-family:monospace;font-size:14px;cursor:pointer;text-align:left;";
            btn.textContent   = `Room ${room}`;
            this.addHover(btn);
            btn.addEventListener("click", () => { this.closeDirectionPicker(); onPick(i); });
            box.appendChild(btn);
        });

        // Cancel button closes the picker without doing anything
        const cancel = document.createElement("button");
        cancel.style.cssText = "display:block;width:100%;padding:8px;border:2px solid #000;background:#FFB6C1;font-family:monospace;font-size:14px;cursor:pointer;";
        cancel.textContent   = "Cancel";
        this.addHover(cancel);
        cancel.addEventListener("click", () => this.closeDirectionPicker());
        box.appendChild(cancel);

        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    closeDirectionPicker(): void {
        document.getElementById("dir-overlay")?.remove();
    }

    // ── Cave picker ───────────────────────────────────────────────────────────

    // Shows a list of all five available caves for the player to choose from.
    // Stops the intro music when a cave is selected (game is about to start).
    showCavePicker(caves: string[], onPick: (cave: string) => void): void {
        this.addBouncingDonuts();
        const container = document.getElementById("app") ?? document.body;
        container.innerHTML = "";
        container.style.cssText = "font-family:monospace;max-width:600px;margin:0 auto;padding:16px;position:relative;z-index:10;";

        const title = document.createElement("h2");
        title.textContent = "Choose a Cave";
        container.appendChild(title);

        caves.forEach((cave, i) => {
            const btn = document.createElement("button");
            btn.style.cssText = "display:block;width:100%;margin-bottom:10px;padding:10px;border:2px solid #000;background:#FFB6C1;font-family:monospace;font-size:15px;cursor:pointer;text-align:left;";
            btn.textContent   = `Cave ${i + 1}  (${cave})`;
            this.addHover(btn);
            btn.addEventListener("click", () => { onPick(cave); });
            container.appendChild(btn);
        });
    }

    // ── Splash screen ─────────────────────────────────────────────────────────

    // Adds a repeating donut image border around all four edges of the screen.
    // Each strip is one donut tall/wide and tiles the donut image across its length.
    private addDonutBorder(): void {
        this.removeDonutBorder();
        // Prefer the background-removed data URL; fall back to raw URL.
        // If the canvas isn't ready yet the onload callback will update the elements.
        const url  = this.donutDataUrl || new URL('../../assets/doughnut.png', import.meta.url).href;
        const size = 70; // px — nominal donut size (scaled slightly by 'round' to avoid cropping)
        const base = `position:fixed;background-image:url(${url});background-size:${size}px ${size}px;z-index:10;pointer-events:none;`;

        const make = (style: string, repeat: string) => {
            const d = document.createElement("div");
            d.className = "donut-border";
            d.style.cssText = base + `background-repeat:${repeat};` + style;
            document.body.appendChild(d);
        };

        // 'round no-repeat' scales tiles horizontally so the row always fits exactly
        make(`top:0;left:0;right:0;height:${size}px;`,                        "round no-repeat"); // top
        make(`bottom:0;left:0;right:0;height:${size}px;`,                     "round no-repeat"); // bottom
        // 'no-repeat round' scales tiles vertically so the column always fits exactly
        make(`top:${size}px;left:0;bottom:${size}px;width:${size}px;`,        "no-repeat round"); // left
        make(`top:${size}px;right:0;bottom:${size}px;width:${size}px;`,       "no-repeat round"); // right
    }

    private removeDonutBorder(): void {
        document.querySelectorAll(".donut-border").forEach(el => el.remove());
    }

    // The very first screen the player sees when they open the game.
    // A large "CLICK HERE" button starts the intro music and leads to high scores.
    showSplashScreen(onEnter: () => void): void {
        const container = document.getElementById("app") ?? document.body;
        container.innerHTML = "";
        container.style.cssText = "font-family:monospace;background:#fff;color:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;padding:0;max-width:100%;text-align:center;";

        const title = document.createElement("h1");
        title.style.cssText = "font-size:clamp(2rem,6vw,4rem);margin-bottom:0.25em;letter-spacing:0.05em;";
        title.textContent   = "Hunt the Wumpus - Simpsons Edition!";
        container.appendChild(title);

        const sub = document.createElement("p");
        sub.style.cssText = "font-size:1.1rem;margin-bottom:2.5em;opacity:0.6;";
        sub.textContent   = "A game of caves, arrows, and a very unpleasant creature.";
        container.appendChild(sub);

        const btn = document.createElement("button");
        btn.style.cssText = [
            "padding:18px 48px", "border:4px solid #000", "background:#FFB6C1",
            "font-family:monospace", "font-size:1.4rem", "cursor:pointer",
            "letter-spacing:0.1em", "transition:background 0.15s,color 0.15s",
        ].join(";");
        btn.textContent = "CLICK HERE";
        this.addHover(btn);;
        // The click starts the audio (must happen inside a user gesture) then navigates
        btn.addEventListener("click", () => { this.removeDonutBorder(); this.unlockAndPlayIntroMusic(); onEnter(); });
        container.appendChild(btn);

        this.addDonutBorder();
    }

    // ── Bouncing intro sprites ────────────────────────────────────────────────
    // Homer bounces on the left, Mr Burns on the right, filling the space
    // between the leaderboard (600px wide, centred) and the screen edges.

    private addBouncingSprites(): void {
        this.removeBouncingSprites(); // clear any previous set

        // Inject the CSS animation once (guard prevents duplicate <style> tags)
        if (!document.getElementById("wumpus-bounce-style")) {
            const style = document.createElement("style");
            style.id    = "wumpus-bounce-style";
            style.textContent = `
                @keyframes wumpusBounce {
                    0%, 100% { transform: translateY(0); }
                    50%       { transform: translateY(-40px); }
                }
                /* Each wrapper fills the gap between the 600px leaderboard and one screen edge */
                .intro-sprite-wrap {
                    position: fixed; bottom: 60px;
                    display: flex; justify-content: center; align-items: flex-end;
                    width: calc((100vw - 600px) / 2);
                    pointer-events: none; z-index: 0;
                }
                .intro-sprite-wrap-left  { left: 0; }
                .intro-sprite-wrap-right { right: 0; }
                /* Both images same box size so they look equal */
                .intro-sprite {
                    width: 50vh; height: 50vh; object-fit: contain;
                    animation: wumpusBounce 0.9s ease-in-out infinite;
                }
                /* multiply blend mode makes the white background transparent on a white page */
                .intro-sprite-wumpus { mix-blend-mode: multiply; }
            `;
            document.head.appendChild(style);
        }

        // Homer — left side
        const homerWrap = document.createElement("div");
        homerWrap.className = "intro-sprite-wrap intro-sprite-wrap-left";
        const homer = document.createElement("img");
        homer.src   = new URL('../../assets/Homer_Simpson_2006.png', import.meta.url).href;
        homer.className = "intro-sprite";
        homerWrap.appendChild(homer);
        document.body.appendChild(homerWrap);

        // Mr Burns — right side
        const wumpusWrap = document.createElement("div");
        wumpusWrap.className = "intro-sprite-wrap intro-sprite-wrap-right";
        const wumpus = document.createElement("img");
        wumpus.src   = new URL('../../assets/Buns.webp', import.meta.url).href;
        wumpus.className = "intro-sprite intro-sprite-wumpus";
        wumpusWrap.appendChild(wumpus);
        document.body.appendChild(wumpusWrap);
    }

    // Removes both bouncing sprite wrappers from the page
    private removeBouncingSprites(): void {
        document.querySelectorAll(".intro-sprite-wrap").forEach(el => el.remove());
    }

    // ── Bouncing donuts (setup screens) ──────────────────────────────────────
    // Shows several large bouncing donuts in the side gutters during the name-
    // entry, cave-picker, and difficulty-picker screens.

    private addBouncingDonuts(): void {
        this.removeBouncingDonuts();

        // Ensure bounce keyframes exist
        if (!document.getElementById("wumpus-bounce-style")) {
            const style = document.createElement("style");
            style.id = "wumpus-bounce-style";
            style.textContent = `
                @keyframes wumpusBounce {
                    0%, 100% { transform: translateY(0); }
                    50%       { transform: translateY(-40px); }
                }
                .intro-sprite-wrap { position:fixed;bottom:60px;display:flex;justify-content:center;align-items:flex-end;width:calc((100vw - 600px) / 2);pointer-events:none;z-index:0; }
                .intro-sprite-wrap-left  { left:0; }
                .intro-sprite-wrap-right { right:0; }
                .intro-sprite { width:50vh;height:50vh;object-fit:contain;animation:wumpusBounce 0.9s ease-in-out infinite; }
                .intro-sprite-wumpus { mix-blend-mode:multiply; }
            `;
            document.head.appendChild(style);
        }

        // Use the white-flattened version so there are no transparent pixels.
        // If it's not ready yet (image still loading), generate it on the spot.
        if (!this.donutFlatDataUrl && this.donutImg.complete && this.donutImg.naturalWidth > 0) {
            const flat = document.createElement("canvas");
            flat.width = this.donutImg.naturalWidth;
            flat.height = this.donutImg.naturalHeight;
            const fctx = flat.getContext("2d")!;
            fctx.fillStyle = "#fff";
            fctx.fillRect(0, 0, flat.width, flat.height);
            fctx.drawImage(this.donutImg, 0, 0);
            this.donutFlatDataUrl = flat.toDataURL();
        }
        const donutSrc = this.donutFlatDataUrl
            || new URL('../../assets/doughnut.png', import.meta.url).href;

        // Ensure the page itself is white so the donut holes read as white too
        document.body.style.background = "#fff";
        document.documentElement.style.background = "#fff";

        // Full-screen container — covers everything including the middle.
        const grid = document.createElement("div");
        grid.className = "bouncing-donut-wrap";
        grid.style.cssText = [
            "position:fixed", "top:0", "left:0", "width:100vw", "height:100vh",
            "display:grid",
            "grid-template-columns:repeat(5,1fr)",
            "grid-template-rows:repeat(3,1fr)",
            "pointer-events:none",
            "z-index:0",
            "background:#fff",
            "overflow:hidden",
        ].join(";");

        const durations = ["0.80s","1.05s","0.90s","1.15s","0.85s",
                           "1.00s","0.88s","1.10s","0.92s","0.78s",
                           "1.08s","0.95s","0.82s","1.02s","0.87s"];
        const delays    = ["0s","0.3s","0.6s","0.2s","0.5s",
                           "0.4s","0.7s","0.1s","0.55s","0.35s",
                           "0.8s","0.15s","0.45s","0.65s","0.25s"];

        // Varying sizes (% of cell) so donuts feel organic rather than uniform
        const sizes = ["72%","95%","60%","88%","78%",
                       "92%","65%","80%","55%","98%",
                       "85%","70%","90%","62%","75%"];

        for (let i = 0; i < 15; i++) {
            const cell = document.createElement("div");
            cell.style.cssText = "display:flex;align-items:center;justify-content:center;";

            const img = document.createElement("img");
            img.className = "bouncing-donut-img";
            img.src = donutSrc;
            const s = sizes[i];
            img.style.cssText = [
                `width:${s}`, `height:${s}`, "object-fit:contain",
                `animation:wumpusBounce ${durations[i]} ${delays[i]} ease-in-out infinite`,
            ].join(";");
            cell.appendChild(img);
            grid.appendChild(cell);
        }

        document.body.appendChild(grid);
        // Note: don't set #app styles here — each screen's container.style.cssText
        // overwrites inline styles, so we add z-index there directly instead.
    }

    private removeBouncingDonuts(): void {
        document.querySelectorAll(".bouncing-donut-wrap").forEach(el => el.remove());
    }

    // ── Instructions modal ────────────────────────────────────────────────────

    showInstructionsModal(): void {
        const overlay = document.createElement("div");
        overlay.id = "instructions-overlay";
        overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:100;";

        const box = document.createElement("div");
        box.style.cssText = "background:#fff;border:3px solid #000;padding:24px;max-width:480px;width:90%;font-family:monospace;max-height:80vh;overflow-y:auto;";

        const title = document.createElement("h2");
        title.style.cssText = "margin:0 0 12px;border-bottom:2px solid #000;padding-bottom:8px;font-size:16px;";
        title.textContent = "How to Play";
        box.appendChild(title);

        const sections: { heading: string; body: string }[] = [
            {
                heading: "🏹 How to Win",
                body: "Shoot an arrow into the Wumpus's room to kill it. Use Shoot Arrow and pick the adjacent room you think it's in. Hit = you win. Miss = the Wumpus wakes up and moves.",
            },
            {
                heading: "🦇 Bats",
                body: "Walk into a bat's room and it picks you up and drops you in a random room elsewhere in the cave. The bat then flies to a new room too.",
            },
            {
                heading: "⬇ Pits",
                body: "Fall into a pit and you must answer 2 out of 3 trivia questions correctly to climb out. Fail and it's game over. Each question costs 1 donut.",
            },
            {
                heading: "🐉 Wumpus Battle",
                body: "Wander into the Wumpus's room and a fight starts. Answer 3 out of 5 trivia questions correctly to wound it and send it fleeing 2–4 rooms away. Fail = game over.",
            },
            {
                heading: "🍩 Donuts",
                body: "You earn 1 donut each time you move to a new room (up to 100 total). Spend donuts on trivia to Buy Arrows (+2 arrows for 2 of 3 correct) or Buy a Secret (reveals a hidden clue). Go into donut debt mid-challenge = game over.",
            },
            {
                heading: "⚠ Hazard Warnings",
                body: "\"I smell a Wumpus!\" — Wumpus is in an adjacent room.\n\"Bats nearby\" — a bat is adjacent.\n\"I feel a draft\" — a pit is adjacent.",
            },
        ];

        sections.forEach(s => {
            const h = document.createElement("p");
            h.style.cssText = "font-weight:bold;margin:10px 0 4px;";
            h.textContent   = s.heading;
            box.appendChild(h);

            const p = document.createElement("p");
            p.style.cssText = "margin:0 0 6px;font-size:13px;white-space:pre-wrap;line-height:1.45;";
            p.textContent   = s.body;
            box.appendChild(p);
        });

        const close = document.createElement("button");
        close.style.cssText = "display:block;width:100%;margin-top:14px;padding:8px;border:2px solid #000;background:#FFB6C1;font-family:monospace;font-size:14px;cursor:pointer;";
        close.textContent   = "Close";
        this.addHover(close);
        close.addEventListener("click", () => overlay.remove());
        box.appendChild(close);

        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    // ── High scores screen ────────────────────────────────────────────────────

    // Shows the leaderboard table with the top 10 scores, the bouncing sprites,
    // and a START GAME button. Music continues from wherever it left off.
    showHighScores(scores: { name: string; score: number; cave: string; turns: number; coins: number; arrows: number; difficulty?: string }[], onStart: () => void): void {
        var container = document.getElementById("app");
        if (container == null) container = document.body;

        container.innerHTML = "";
        container.style.cssText = "font-family:monospace;max-width:600px;margin:0 auto;padding:16px;position:relative;z-index:10;";

        const title = document.createElement("h1");
        title.style.cssText = "border-bottom:3px solid #000;padding-bottom:8px;";
        title.textContent   = "Hunt the Wumpus - Simpsons Edition!";
        container.appendChild(title);

        const sub = document.createElement("h2");
        sub.textContent = "High Scores";
        container.appendChild(sub);

        if (scores.length === 0) {
            const none = document.createElement("p");
            none.textContent = "No scores yet.";
            container.appendChild(none);
        } else {
            // Build the scores table with columns for all tracked values
            const table = document.createElement("table");
            table.style.cssText = "border-collapse:collapse;width:100%;margin-bottom:16px;";
            const header = table.insertRow();
            ["#", "Name", "Score", "Cave", "Difficulty", "Turns (N)", "Donuts (G)", "Arrows (A)"].forEach(h => {
                const th = document.createElement("th");
                th.style.cssText = "border:1px solid #000;padding:4px 8px;text-align:left;";
                th.textContent   = h;
                header.appendChild(th);
            });
            scores.forEach((s, i) => {
                const row        = table.insertRow();
                const caveDisplay = s.cave ? s.cave.replace("cave", "") : "—"; // "cave3" → "3"
                const diffDisplay = s.difficulty ? s.difficulty.charAt(0).toUpperCase() + s.difficulty.slice(1) : "—";
                [String(i + 1), s.name, String(s.score), caveDisplay, diffDisplay,
                 String(s.turns ?? "—"), String(s.coins ?? "—"), String(s.arrows ?? "—")
                ].forEach(val => {
                    const td = row.insertCell();
                    td.style.cssText = "border:1px solid #000;padding:4px 8px;";
                    td.textContent   = val;
                });
            });
            container.appendChild(table);
        }

        const prompt = document.createElement("p");
        prompt.textContent = "Press Enter or click below to start a new game.";
        container.appendChild(prompt);

        const startBtn = document.createElement("button");
        startBtn.style.cssText = "padding:10px 24px;border:3px solid #000;background:#FFB6C1;font-family:monospace;font-size:16px;cursor:pointer;";
        startBtn.textContent   = "[ START GAME ]";
        this.addHover(startBtn);

        // The Enter-key listener is registered at the document level so the
        // player doesn't have to click the button — just press Enter.
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                this.unlockAndPlayIntroMusic(); // keep music going if it was paused
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
        this.playIntroMusic(); // no-op if already playing; ensures music starts on return visits
    }

    // ── Name entry prompt ─────────────────────────────────────────────────────

    // Simple text-input screen where the player types their name before playing.
    // Removes the bouncing sprites but keeps the intro music playing.
    showSetupPrompt(onSubmit: (name: string) => void): void {
        this.removeBouncingSprites();
        this.addBouncingDonuts();
        const container = document.getElementById("app") ?? document.body;
        container.innerHTML = "";
        container.style.cssText = "font-family:monospace;max-width:600px;margin:0 auto;padding:16px;position:relative;z-index:10;";

        const title = document.createElement("h2");
        title.textContent = "Enter Your Name";
        container.appendChild(title);

        const input = document.createElement("input");
        input.type        = "text";
        input.placeholder = "Your name";
        input.style.cssText = "border:3px solid #FF1493;padding:6px;font-family:monospace;font-size:16px;margin-right:8px;width:200px;background:#FFB6C1;";
        container.appendChild(input);

        const btn = document.createElement("button");
        btn.style.cssText = "padding:6px 16px;border:2px solid #000;background:#FFB6C1;font-family:monospace;font-size:16px;cursor:pointer;";
        btn.textContent   = "OK";
        this.addHover(btn);
        // Default name is "Hunter" if the player leaves the field blank
        const submit = () => onSubmit(input.value.trim() || "Hunter");
        btn.addEventListener("click", submit);
        input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
        container.appendChild(btn);
        input.focus(); // auto-focus so the player can start typing immediately
    }

    // ── Game over screen ──────────────────────────────────────────────────────

    // Shows a dimmed overlay with win/lose heading, the result message, the score,
    // and a Continue button. Also kicks off the particle effect (confetti or blood).
    showGameOver(won: boolean, message: string, score: number, onContinue: () => void): void {
        this.startParticles(won); // start raining confetti or blood behind the modal

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
        scoreEl.textContent      = `Score: ${score}`;
        box.appendChild(scoreEl);

        const btn = document.createElement("button");
        btn.style.cssText = "margin-top:16px;padding:10px 24px;border:3px solid #000;background:#FFB6C1;font-family:monospace;font-size:16px;cursor:pointer;";
        btn.textContent   = "Continue";
        this.addHover(btn);
        btn.addEventListener("click", () => {
            // Create/resume the AudioContext inside this click handler — this is
            // the user gesture that allows intro music to play on the next high
            // scores screen without needing an extra click.
            this.unlockAndPlayIntroMusic();
            this.stopParticles();
            overlay.remove();
            onContinue();
        });
        box.appendChild(btn);

        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    // ── Difficulty ────────────────────────────────────────────────────────────

    // Tells Graphics whether trivia challenges should be sabotaged (hard mode).
    setHardMode(hard: boolean): void {
        this.hardMode = hard;
    }

    // Shows a simple difficulty selection screen.
    showDifficultyPicker(onPick: (difficulty: 'easy' | 'normal' | 'hard') => void): void {
        this.addBouncingDonuts();
        const container = document.getElementById("app") ?? document.body;
        container.innerHTML = "";
        container.style.cssText = "font-family:monospace;max-width:600px;margin:0 auto;padding:16px;position:relative;z-index:10;";

        const title = document.createElement("h2");
        title.textContent = "Select Difficulty";
        container.appendChild(title);

        const choices: { id: 'easy' | 'normal' | 'hard'; label: string; desc: string }[] = [
            { id: 'easy',   label: 'Easy',   desc: 'Start with 3 bonus coins.' },
            { id: 'normal', label: 'Normal', desc: 'Standard rules.' },
            { id: 'hard',   label: 'Hard',   desc: "Good luck clicking that answer…" },
        ];

        choices.forEach(c => {
            const btn = document.createElement("button");
            btn.style.cssText = "display:block;width:100%;margin-bottom:10px;padding:10px;border:2px solid #000;background:#FFB6C1;font-family:monospace;font-size:15px;cursor:pointer;text-align:left;";
            btn.textContent = c.label;
            this.addHover(btn);
            btn.addEventListener("click", () => onPick(c.id));
            container.appendChild(btn);
        });
    }

    // ── Pit overlay ───────────────────────────────────────────────────────────

    // Shows a dark, shaking "You fell into a pit!" overlay behind the trivia modals.
    showPitOverlay(): void {
        this.hidePitOverlay();

        // Inject shake keyframes once
        if (!document.getElementById("pit-shake-style")) {
            const style = document.createElement("style");
            style.id    = "pit-shake-style";
            style.textContent = `
                @keyframes pitShake {
                    0%,100% { transform:translate(0,0) rotate(0deg); }
                    10%     { transform:translate(-7px,-3px) rotate(-1deg); }
                    20%     { transform:translate(7px,3px)   rotate(1deg); }
                    30%     { transform:translate(-5px,2px)  rotate(0.5deg); }
                    40%     { transform:translate(9px,-4px)  rotate(-1deg); }
                    50%     { transform:translate(-9px,4px)  rotate(1deg); }
                    60%     { transform:translate(5px,-2px)  rotate(-0.5deg); }
                    70%     { transform:translate(-3px,5px)  rotate(0deg); }
                    80%     { transform:translate(3px,-5px)  rotate(1deg); }
                    90%     { transform:translate(-2px,2px)  rotate(-0.5deg); }
                }
            `;
            document.head.appendChild(style);
        }

        const overlay = document.createElement("div");
        overlay.id          = "pit-overlay";
        overlay.style.cssText = [
            "position:fixed", "top:0", "left:0", "width:100%", "height:100%",
            "background:rgba(0,0,0,0.55)",
            "display:flex", "flex-direction:column",
            "align-items:center", "justify-content:center",
            "z-index:50",
            "animation:pitShake 0.45s ease-in-out infinite",
            "pointer-events:none",
        ].join(";");

        const msg = document.createElement("div");
        msg.style.cssText = [
            "color:#ff3333", "font-family:monospace", "font-size:clamp(1.4rem,4vw,2.2rem)",
            "font-weight:bold", "text-align:center",
            "text-shadow:0 0 16px #ff0000,0 0 32px #880000",
            "padding:0 16px",
        ].join(";");
        msg.textContent = "⬇  You fell into a pit!  ⬇";
        overlay.appendChild(msg);

        const sub = document.createElement("div");
        sub.style.cssText = "color:#ffaaaa;font-family:monospace;font-size:1rem;margin-top:12px;text-align:center;";
        sub.textContent   = "Answer the trivia questions to climb out…";
        overlay.appendChild(sub);

        document.body.appendChild(overlay);
        this.pitOverlay = overlay;
        this.inPit = true;
        this.startRockParticles();
        // Start looping rocks audio
        if (!this.pitAudio) {
            this.pitAudio = new Audio(this.pitSoundUrl);
            this.pitAudio.loop   = true;
            this.pitAudio.volume = 0.6;
        }
        this.pitAudio.currentTime = 0;
        this.pitAudio.play().catch(() => {});
    }

    // Removes the pit overlay, stops rocks and audio.
    hidePitOverlay(): void {
        this.pitOverlay?.remove();
        this.pitOverlay = null;
        document.getElementById("pit-overlay")?.remove();
        this.inPit = false;
        this.stopRockParticles();
        this.pitAudio?.pause();
        if (this.pitAudio) this.pitAudio.currentTime = 0;
    }

    // Shows a dark shaking "You are fighting the Wumpus!" overlay with Wumpus
    // sprites flanking the trivia modal. No rock particles.
    showWumpusOverlay(): void {
        this.hideWumpusOverlay();

        // Reuse the same shake keyframes as the pit
        if (!document.getElementById("pit-shake-style")) {
            const style = document.createElement("style");
            style.id    = "pit-shake-style";
            style.textContent = `
                @keyframes pitShake {
                    0%,100% { transform:translate(0,0) rotate(0deg); }
                    10%     { transform:translate(-7px,-3px) rotate(-1deg); }
                    20%     { transform:translate(7px,3px)   rotate(1deg); }
                    30%     { transform:translate(-5px,2px)  rotate(0.5deg); }
                    40%     { transform:translate(9px,-4px)  rotate(-1deg); }
                    50%     { transform:translate(-9px,4px)  rotate(1deg); }
                    60%     { transform:translate(5px,-2px)  rotate(-0.5deg); }
                    70%     { transform:translate(-3px,5px)  rotate(0deg); }
                    80%     { transform:translate(3px,-5px)  rotate(1deg); }
                    90%     { transform:translate(-2px,2px)  rotate(-0.5deg); }
                }
            `;
            document.head.appendChild(style);
        }

        const overlay = document.createElement("div");
        overlay.id = "wumpus-battle-overlay";
        overlay.style.cssText = [
            "position:fixed", "top:0", "left:0", "width:100%", "height:100%",
            "background:rgba(0,0,0,0.55)",
            "display:flex", "flex-direction:column",
            "align-items:center", "justify-content:center",
            "z-index:50",
            "animation:pitShake 0.45s ease-in-out infinite",
            "pointer-events:none",
        ].join(";");

        // Heading banner
        const msg = document.createElement("div");
        msg.style.cssText = [
            "color:#ff9900", "font-family:monospace",
            "font-size:clamp(1.4rem,4vw,2rem)", "font-weight:bold",
            "text-align:center", "padding:0 16px",
            "text-shadow:0 0 16px #ff6600,0 0 32px #880000",
        ].join(";");
        msg.textContent = "⚔  You are fighting the Wumpus!  ⚔";
        overlay.appendChild(msg);

        const sub = document.createElement("div");
        sub.style.cssText = "color:#ffddaa;font-family:monospace;font-size:1rem;margin-top:10px;text-align:center;";
        sub.textContent   = "Answer the trivia questions to wound it…";
        overlay.appendChild(sub);

        // Wumpus sprites removed from overlay — see below
        document.body.appendChild(overlay);
        this.wumpusOverlay = overlay;
        // Start looping laughter audio
        if (!this.wumpusAudio) {
            this.wumpusAudio = new Audio(this.wumpusSoundUrl);
            this.wumpusAudio.loop   = true;
            this.wumpusAudio.volume = 0.6;
        }
        this.wumpusAudio.currentTime = 0;
        this.wumpusAudio.play().catch(() => {});

        // Wumpus sprites live at z-index 150 (above the trivia modal at 100).
        // They have their own shake animation so they appear at full brightness,
        // overlay the trivia box edges when the shake moves them there.
        const wumpusUrl = new URL('../../assets/Buns.webp', import.meta.url).href;
        const SPRITE_W  = 160;
        this.wumpusSprites = [];

        (["left", "right"] as const).forEach(side => {
            const el = document.createElement("img");
            el.src = wumpusUrl;
            el.className = "wumpus-battle-sprite";
            el.style.cssText = [
                "position:fixed",
                "top:50%",
                "transform:translateY(-50%)",
                side === "left"
                    ? `left:calc(50% - 260px - ${SPRITE_W}px)`
                    : `left:calc(50% + 260px)`,
                `width:${SPRITE_W}px`,
                "height:auto",
                "mix-blend-mode:normal",       // full brightness above overlay
                "z-index:150",                 // above trivia modal (100)
                "pointer-events:none",
                "animation:pitShake 0.45s ease-in-out infinite",
            ].join(";");
            document.body.appendChild(el);
            this.wumpusSprites.push(el);
        });

        this.inWumpusBattle = true;
    }

    // Removes the Wumpus battle overlay, sprites, and audio.
    hideWumpusOverlay(): void {
        this.wumpusOverlay?.remove();
        this.wumpusOverlay = null;
        document.getElementById("wumpus-battle-overlay")?.remove();
        this.wumpusSprites.forEach(s => s.remove());
        this.wumpusSprites = [];
        this.inWumpusBattle = false;
        this.wumpusAudio?.pause();
        if (this.wumpusAudio) this.wumpusAudio.currentTime = 0;
    }

    // ── Game layout shell ─────────────────────────────────────────────────────

    // Builds the full in-game screen: stops intro music, clears the map and
    // secrets list, creates the UI elements, and adds the four action buttons.
    buildGameUI(
        container: HTMLElement,
        onMove: () => void,
        onShoot: () => void,
        onBuyArrows: () => void,
        onBuySecret: () => void,
        onQuit: () => void
    ): void {
        this.stopIntroMusic();      // no music during the game
        this.removeBouncingSprites();
        this.removeBouncingDonuts();
        this.revealedRooms.clear(); // start with a blank map (all rooms hidden)
        this.currentRoom = 0;
        this.secrets     = [];      // clear secrets from any previous game

        this.buildUI(container);

        // Row of action buttons below the status log
        const actions = document.createElement("div");
        actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;";

        const makeBtn = (label: string, handler: () => void) => {
            const btn = document.createElement("button");
            btn.style.cssText = "padding:8px 14px;border:2px solid #000;background:#FFB6C1;font-family:monospace;font-size:14px;cursor:pointer;";
            btn.textContent   = label;
            this.addHover(btn);
            btn.addEventListener("click", handler);
            actions.appendChild(btn);
        };

        makeBtn("Move",               onMove);
        makeBtn("Shoot Arrow",        onShoot);
        makeBtn("Buy Arrows",         onBuyArrows);
        makeBtn("Buy Secret",         onBuySecret);
        makeBtn("Return to Homepage", onQuit);
        makeBtn("Instructions",       () => this.showInstructionsModal());

        container.appendChild(actions);
    }
}
