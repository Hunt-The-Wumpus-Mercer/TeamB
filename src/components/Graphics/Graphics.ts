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
    private secrets: string[] = [];

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
            drawHexagon(ctx, x, y, ROOM_R,
                isCurrent ? "#000" : "#fff",
                "#000",
                isCurrent ? 3 : 1.5
            );
            ctx.fillStyle = isCurrent ? "#fff" : "#000";
            ctx.font = "bold 11px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(room), x, y);
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
            btn.addEventListener("click", () => onPick(cave));
            container.appendChild(btn);
        });
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
            scores.forEach((s, i) => {
                const row = table.insertRow();
                const caveDisplay = s.cave ? s.cave.replace("cave", "") : "—";
                [String(i + 1), s.name, String(s.score), caveDisplay, String(s.turns ?? "—"), String(s.coins ?? "—"), String(s.arrows ?? "—")].forEach(val => {
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
            if (e.key === "Enter") { document.removeEventListener("keydown", onKey); onStart(); }
        };
        startBtn.addEventListener("click", () => { document.removeEventListener("keydown", onKey); onStart(); });
        document.addEventListener("keydown", onKey);
        container.appendChild(startBtn);
    }

    // ── Setup prompt ─────────────────────────────────────────────

    showSetupPrompt(onSubmit: (name: string) => void): void {
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
        const overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:200;";

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
        btn.addEventListener("click", () => { overlay.remove(); onContinue(); });
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
