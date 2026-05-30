import Cave from "../cave/Cave";
import GameMap from "../Map_and_PLayer/Map";
import { MapObjectType } from "../Map_and_PLayer/IMap";
import { Player } from "../Map_and_PLayer/Player";
import { PlayerResourceType } from "../Map_and_PLayer/IPLayer";
import Trivia from "../trivia/Trivia";
import HighScores from "../high_scores/HighScores";
import Graphics from "../Graphics/Graphics";
import SoundManager from "../sound/sound";
import { SoundEventType } from "../sound/ISound";
import { CaveRoomDirections } from "../shared/CaveRoomDirections";

const DIR_NAMES = [
    CaveRoomDirections.NORTH,
    CaveRoomDirections.NORTHEAST,
    CaveRoomDirections.SOUTHEAST,
    CaveRoomDirections.SOUTH,
    CaveRoomDirections.SOUTHWEST,
    CaveRoomDirections.NORTHWEST,
];

export default class GameControl {
    private cave     = new Cave();
    private map      = new GameMap();
    private player   = new Player();
    private trivia   = new Trivia();
    private scores   = new HighScores();
    private gfx      = new Graphics();
    private sound    = new SoundManager();

    private container!: HTMLElement;
    private startRoom  = 1;
    private caveName   = "";
    private gameOver   = false;

    async init(container: HTMLElement): Promise<void> {
        this.container = container;
        await this.scores.load();
        this.gfx.showHighScores(this.scores.getHighScores(), () => this.startSetup());
    }

    private startSetup(): void {
        this.gfx.showSetupPrompt(name => {
            this.player.setPlayerName(name);
            this.gfx.showCavePicker(this.cave.getAvailableCaves(), cave => {
                this.beginGame(cave);
            });
        });
    }

    private beginGame(caveName: string): void {
        this.gameOver  = false;
        this.caveName  = caveName;
        const savedName = this.player.getPlayerName();
        this.player = new Player();
        this.player.setPlayerName(savedName);
        this.trivia = new Trivia();
        this.trivia.initialize();

        this.cave.loadCave(caveName);
        const total = this.cave.getRoomCount();

        const used = new Set<number>();
        const pick = () => {
            let r: number;
            do { r = Math.floor(Math.random() * total) + 1; } while (used.has(r));
            used.add(r);
            return r;
        };

        this.startRoom = pick();
        this.map.setRoomLocation(MapObjectType.PLAYER, this.startRoom);
        this.map.setRoomLocation(MapObjectType.WUMPUS, pick());
        this.map.setRoomLocation(MapObjectType.BAT1,   pick());
        this.map.setRoomLocation(MapObjectType.BAT2,   pick());
        this.map.setRoomLocation(MapObjectType.PIT1,   pick());
        this.map.setRoomLocation(MapObjectType.PIT2,   pick());

        this.player.incrementResource(PlayerResourceType.ARROWS, 3);

        this.container.innerHTML = "";
        this.gfx.buildGameUI(
            this.container,
            () => this.onMoveClick(),
            () => this.onShootClick(),
            () => this.onBuyArrowsClick(),
            () => this.onBuySecretClick(),
        );

        this.refreshUI();
        this.gfx.updateStatusMessage(`Cave "${caveName}" — you start in room ${this.startRoom}. Good luck!`);
        this.checkWarnings();
    }

    // ── UI refresh ───────────────────────────────────────────────

    private refreshUI(): void {
        const room = this.map.getRoomLocation(MapObjectType.PLAYER);
        this.gfx.updatePlayerName(this.player.getPlayerName());
        this.gfx.updateArrowCount(this.player.getResource(PlayerResourceType.ARROWS));
        this.gfx.updateCoinCount(this.player.getResource(PlayerResourceType.COINS));
        this.gfx.updateTurnCount(this.player.getResource(PlayerResourceType.TURNS));
        this.gfx.revealRoom(room, this.cave.getConnectedRooms(room));
    }

    // #3 — warnings printed to both the warnings bar AND the status log
    private checkWarnings(): void {
        const room      = this.map.getRoomLocation(MapObjectType.PLAYER);
        const connected = this.cave.getConnectedRooms(room);
        const warnings: string[] = [];

        if (connected.includes(this.map.getRoomLocation(MapObjectType.WUMPUS))) warnings.push("I smell a Wumpus!");
        if (connected.includes(this.map.getRoomLocation(MapObjectType.BAT1)) ||
            connected.includes(this.map.getRoomLocation(MapObjectType.BAT2)))   warnings.push("Bats Nearby");
        if (connected.includes(this.map.getRoomLocation(MapObjectType.PIT1)) ||
            connected.includes(this.map.getRoomLocation(MapObjectType.PIT2)))   warnings.push("I feel a draft");

        this.gfx.updateWarnings(warnings);
        if (warnings.length > 0) this.gfx.updateStatusMessage(warnings.join("  "));
        if (warnings.includes("I smell a Wumpus!"))  this.sound.playSound(SoundEventType.WARNING_WUMPUS);
        if (warnings.includes("Bats Nearby"))         this.sound.playSound(SoundEventType.WARNING_BAT);
        if (warnings.includes("I feel a draft"))      this.sound.playSound(SoundEventType.WARNING_PIT);
    }

    // ── Movement ─────────────────────────────────────────────────

    private onMoveClick(): void {
        if (this.gameOver) return;
        this.promptDirection("Move to which room?", dir => this.movePlayer(dir));
    }

    private async movePlayer(dirIndex: number): Promise<void> {
        const room = this.map.getRoomLocation(MapObjectType.PLAYER);
        const connected = this.cave.getConnectedRooms(room);
        const target = connected[dirIndex];
        if (!target) return;

        this.map.setRoomLocation(MapObjectType.PLAYER, target);
        this.player.incrementResource(PlayerResourceType.TURNS);
        const gotCoin = this.player.collectCoin();
        this.sound.playSound(SoundEventType.WALK);
        this.gfx.updateStatusMessage(`You move to room ${target}.${gotCoin ? " (+1 coin)" : " (no coins left in cave)"}`);

        // #5 — trivia fact on every move
        this.gfx.updateStatusMessage(`Trivia: ${this.trivia.getHint()}`);

        this.refreshUI();
        await this.handleRoomEntry(target);
    }

    private async handleRoomEntry(room: number): Promise<void> {
        if (this.gameOver) return;

        if (room === this.map.getRoomLocation(MapObjectType.WUMPUS)) {
            await this.fightWumpus();
            return;
        }

        const bat1room = this.map.getRoomLocation(MapObjectType.BAT1);
        const bat2room = this.map.getRoomLocation(MapObjectType.BAT2);
        if (room === bat1room || room === bat2room) {
            await this.handleBat(room === bat1room ? MapObjectType.BAT1 : MapObjectType.BAT2);
            return;
        }

        const pit1room = this.map.getRoomLocation(MapObjectType.PIT1);
        const pit2room = this.map.getRoomLocation(MapObjectType.PIT2);
        if (room === pit1room || room === pit2room) {
            await this.handlePit();
            return;
        }

        this.checkWarnings();
    }

    // ── Hazards ──────────────────────────────────────────────────

    private async handleBat(batType: MapObjectType): Promise<void> {
        const total = this.cave.getRoomCount();
        let newPlayerRoom: number;
        do { newPlayerRoom = Math.floor(Math.random() * total) + 1; }
        while (newPlayerRoom === this.map.getRoomLocation(MapObjectType.PLAYER));

        let newBatRoom: number;
        do { newBatRoom = Math.floor(Math.random() * total) + 1; }
        while (newBatRoom === newPlayerRoom);

        this.map.setRoomLocation(batType, newBatRoom);
        this.map.setRoomLocation(MapObjectType.PLAYER, newPlayerRoom);
        this.gfx.updateStatusMessage(`A bat grabs you and drops you in room ${newPlayerRoom}!`);
        this.refreshUI();
        await this.handleRoomEntry(newPlayerRoom);
    }

    private async handlePit(): Promise<void> {
        this.gfx.updateStatusMessage("You fell into a bottomless pit! Answer 2 of 3 questions to climb out.");
        const result = await this.runTriviaChallenge(3, 2);
        if (result.outOfCoins) {
            await this.endGame(false, "You ran out of coins in the pit. Game over.");
            return;
        }
        if (result.passed) {
            this.gfx.updateStatusMessage("You climbed out! Back to your starting room.");
            this.map.setRoomLocation(MapObjectType.PLAYER, this.startRoom);
            this.refreshUI();
            this.checkWarnings();
        } else {
            await this.endGame(false, "You couldn't climb out of the pit. Game over.");
        }
    }

    private async fightWumpus(): Promise<void> {
        this.gfx.updateStatusMessage("The Wumpus is here! Answer 3 of 5 questions to wound it.");
        const result = await this.runTriviaChallenge(5, 3);
        if (result.outOfCoins) {
            await this.endGame(false, "You ran out of coins fighting the Wumpus. Game over.");
            return;
        }
        if (result.passed) {
            // #1 — BFS flee: wumpus moves 2–4 rooms away, never back to player's room
            const fleeRoom = this.wumpusFlee();
            this.map.setRoomLocation(MapObjectType.WUMPUS, fleeRoom);
            this.gfx.updateStatusMessage(`You wounded the Wumpus! It flees to room ${fleeRoom}.`);
            this.refreshUI();
            this.checkWarnings();
        } else {
            await this.endGame(false, "The Wumpus beat you in a fight. Game over.");
        }
    }

    // #1 — wumpus flees 2–4 rooms away via BFS, never to player's room
    private wumpusFlee(): number {
        const playerRoom = this.map.getRoomLocation(MapObjectType.PLAYER);
        const startRoom  = this.map.getRoomLocation(MapObjectType.WUMPUS);

        const visited = new Set<number>([startRoom]);
        let frontier = [startRoom];
        const candidates: number[] = [];

        for (let dist = 1; dist <= 4; dist++) {
            const next: number[] = [];
            for (const r of frontier) {
                for (const nb of this.cave.getConnectedRooms(r)) {
                    if (!visited.has(nb)) {
                        visited.add(nb);
                        next.push(nb);
                        if (dist >= 2 && nb !== playerRoom) candidates.push(nb);
                    }
                }
            }
            frontier = next;
        }

        if (candidates.length > 0) {
            return candidates[Math.floor(Math.random() * candidates.length)];
        }
        // fallback: any room that isn't the player's
        for (let r = 1; r <= this.cave.getRoomCount(); r++) {
            if (r !== playerRoom) return r;
        }
        return startRoom;
    }

    private wakeWumpus(): void {
        if (Math.random() < 0.5) {
            const wRoom    = this.map.getRoomLocation(MapObjectType.WUMPUS);
            const neighbors = this.cave.getConnectedRooms(wRoom);
            if (neighbors.length > 0) {
                this.map.setRoomLocation(MapObjectType.WUMPUS, neighbors[Math.floor(Math.random() * neighbors.length)]);
                this.gfx.updateStatusMessage("You hear the Wumpus stir...");
            }
        }
    }

    // ── Arrow ────────────────────────────────────────────────────

    private onShootClick(): void {
        if (this.gameOver) return;
        this.promptDirection("Shoot into which room?", async dirIndex => {
            const room      = this.map.getRoomLocation(MapObjectType.PLAYER);
            const connected = this.cave.getConnectedRooms(room);
            const target    = connected[dirIndex];
            if (!target) return;

            this.player.decrementResource(PlayerResourceType.ARROWS);
            this.sound.playSound(SoundEventType.SHOOT_ARROW);
            this.refreshUI();

            if (target === this.map.getRoomLocation(MapObjectType.WUMPUS)) {
                this.player.setWumpusKilled();
                await this.endGame(true, "Your arrow flies true — you killed the Wumpus!");
            } else {
                this.gfx.updateStatusMessage(`Your arrow misses. (${this.player.getResource(PlayerResourceType.ARROWS)} arrows left)`);
                this.wakeWumpus();
                if (this.map.getRoomLocation(MapObjectType.WUMPUS) === this.map.getRoomLocation(MapObjectType.PLAYER)) {
                    await this.fightWumpus();
                } else if (this.player.getResource(PlayerResourceType.ARROWS) <= 0) {
                    await this.endGame(false, "You have no arrows left. Game over.");
                } else {
                    this.checkWarnings();
                }
            }
        });
    }

    // ── Purchase arrows ───────────────────────────────────────────

    private async onBuyArrowsClick(): Promise<void> {
        if (this.gameOver) return;
        if (this.player.getResource(PlayerResourceType.COINS) < 3) {
            this.gfx.updateStatusMessage("Not enough coins to purchase arrows (need at least 3).");
            return;
        }
        this.gfx.updateStatusMessage("Answer 2 of 3 correctly to buy 2 arrows.");
        const result = await this.runTriviaChallenge(3, 2);
        if (result.passed) {
            this.player.incrementResource(PlayerResourceType.ARROWS, 2);
            this.gfx.updateStatusMessage("You bought 2 arrows!");
        } else {
            this.gfx.updateStatusMessage("Not enough correct answers. No arrows purchased.");
        }
        this.refreshUI();
    }

    // ── Purchase secret ───────────────────────────────────────────

    private async onBuySecretClick(): Promise<void> {
        if (this.gameOver) return;
        if (this.player.getResource(PlayerResourceType.COINS) < 3) {
            this.gfx.updateStatusMessage("Not enough coins to buy a secret (need at least 3).");
            return;
        }
        this.gfx.updateStatusMessage("Answer 2 of 3 correctly to buy a secret.");
        const result = await this.runTriviaChallenge(3, 2);
        if (result.passed) {
            this.gfx.addSecret(this.revealSecret());
        } else {
            this.gfx.updateStatusMessage("Not enough correct answers. No secret revealed.");
        }
        this.refreshUI();
    }

    private revealSecret(): string {
        const player = this.map.getRoomLocation(MapObjectType.PLAYER);
        const options = [
            () => `You are in room ${player}.`,
            () => `The Wumpus is in room ${this.map.getRoomLocation(MapObjectType.WUMPUS)}.`,
            () => `A bat lives in room ${this.map.getRoomLocation(MapObjectType.BAT1)}.`,
            () => `A pit is in room ${this.map.getRoomLocation(MapObjectType.PIT1)}.`,
            () => {
                const wRoom  = this.map.getRoomLocation(MapObjectType.WUMPUS);
                const within = this.roomsWithinN(player, 2);
                return within.has(wRoom)
                    ? "The Wumpus is within 2 rooms of you!"
                    : "The Wumpus is NOT within 2 rooms of you.";
            },
            () => `Trivia: ${this.trivia.getHint()}`,
        ];
        return options[Math.floor(Math.random() * options.length)]();
    }

    private roomsWithinN(start: number, n: number): Set<number> {
        const visited = new Set<number>();
        let frontier = [start];
        for (let i = 0; i < n; i++) {
            const next: number[] = [];
            for (const r of frontier) {
                for (const nb of this.cave.getConnectedRooms(r)) {
                    if (!visited.has(nb)) { visited.add(nb); next.push(nb); }
                }
            }
            frontier = next;
        }
        return visited;
    }

    // ── Trivia engine ─────────────────────────────────────────────

    private runTriviaChallenge(
        questionCount: number,
        requiredCorrect: number,
    ): Promise<{ passed: boolean; outOfCoins: boolean }> {
        return new Promise(resolve => {
            let correct = 0;
            let asked   = 0;

            const ask = () => {
                if (asked >= questionCount) {
                    resolve({ passed: correct >= requiredCorrect, outOfCoins: false });
                    return;
                }

                // Only deduct a coin if there are questions left to answer
                const hasQuestion = this.trivia.getRemainingCount() > 0;
                if (hasQuestion) {
                    this.player.decrementResource(PlayerResourceType.COINS);
                    this.refreshUI();
                    if (this.player.getResource(PlayerResourceType.COINS) < 0) {
                        this.gfx.updateStatusMessage("You have gone into debt — you're out of coins!");
                        resolve({ passed: false, outOfCoins: true });
                        return;
                    }
                }

                if (!hasQuestion) {
                    // No questions left — skip this slot, counts as wrong, no coin charged
                    this.gfx.updateStatusMessage("No trivia questions remaining — skipping question.");
                    ask();
                    return;
                }

                const q = this.trivia.getNextQuestion();
                asked++;

                this.gfx.showTriviaModal(
                    q.question,
                    q.answers,
                    asked,
                    questionCount,
                    correct,
                    requiredCorrect,
                    answerIndex => {
                        if (answerIndex === q.correctAnswerIndex) {
                            correct++;
                            this.gfx.updateStatusMessage("Correct!");
                        } else {
                            this.gfx.updateStatusMessage(`Wrong. Answer: ${q.answers[q.correctAnswerIndex]}`);
                        }
                        ask();
                    }
                );
            };

            ask();
        });
    }

    // ── Direction picker ─────────────────────────────────────────

    private promptDirection(label: string, onPick: (connectedIndex: number) => void): void {
        const room      = this.map.getRoomLocation(MapObjectType.PLAYER);
        const connected = this.cave.getConnectedRooms(room);
        const adj       = this.cave.getAdjacentRooms(room);

        const dirLabels = connected.map(cr => {
            const i = adj.indexOf(cr);
            return i >= 0 ? DIR_NAMES[i] : "?";
        });

        this.gfx.showDirectionPicker(label, connected, dirLabels, onPick);
    }

    // ── Game over ────────────────────────────────────────────────

    private async endGame(won: boolean, message: string): Promise<void> {
        this.gameOver = true;
        this.sound.playSound(won ? SoundEventType.WIN : SoundEventType.LOSE);
        const score = this.player.getScore();

        this.gfx.showGameOver(won, message, score, async () => {
            if (won) {
                // #6 — cave name saved with score
                await this.scores.addScore(this.player.getPlayerName(), score, this.caveName);
            }
            await this.scores.load();
            this.gfx.showHighScores(this.scores.getHighScores(), () => this.startSetup());
        });
    }
}
