// GameControl is the brain of the game. It wires together every other component
// (cave layout, player stats, map positions, trivia, scores, graphics, sound)
// and runs all the game rules: movement, hazards, combat, scoring, and win/lose.

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

// The six compass directions a player can move or shoot, in the same order
// as the adjacent_rooms array stored in each cave's JSON file.
const DIR_NAMES = [
    CaveRoomDirections.NORTH,
    CaveRoomDirections.NORTHEAST,
    CaveRoomDirections.SOUTHEAST,
    CaveRoomDirections.SOUTH,
    CaveRoomDirections.SOUTHWEST,
    CaveRoomDirections.NORTHWEST,
];

export default class GameControl {
    // One instance of each major system — created once and reused
    private cave   = new Cave();         // knows the cave layout
    private map    = new GameMap();      // tracks where everything is
    private player = new Player();       // tracks player stats
    private trivia = new Trivia();       // manages the question pool
    private scores = new HighScores();   // reads/writes the leaderboard
    private gfx    = new Graphics();     // draws everything on screen
    private sound  = new SoundManager(); // plays sound effects

    // The HTML element the whole game lives inside
    private container!: HTMLElement;

    // The room the player started in — used to respawn after a pit escape
    private startRoom = 1;

    // Which cave is currently being played (e.g. "cave3")
    private caveName = "";

    // Prevents buttons from doing anything after the game has ended
    private gameOver = false;

    // ── Startup ───────────────────────────────────────────────────

    // Called once when the page loads.
    // Loads saved scores then shows the splash screen.
    async init(container: HTMLElement): Promise<void> {
        this.container = container;
        await this.scores.load();
        // Show the "Click Here" landing page; when clicked, go to high scores
        this.gfx.showSplashScreen(() => {
            this.gfx.showHighScores(this.scores.getHighScores(), () => this.startSetup());
        });
    }

    // Shows the name-entry prompt, then the cave-picker
    private startSetup(): void {
        this.gfx.showSetupPrompt(name => {
            this.player.setPlayerName(name);
            this.gfx.showCavePicker(this.cave.getAvailableCaves(), cave => {
                this.beginGame(cave);
            });
        });
    }

    // ── Game setup ────────────────────────────────────────────────

    // Resets all state and starts a fresh game in the chosen cave.
    private beginGame(caveName: string): void {
        this.gameOver = false;
        this.caveName = caveName;

        // Keep the player's name but reset everything else
        const savedName = this.player.getPlayerName();
        this.player = new Player();
        this.player.setPlayerName(savedName);

        // Reset the trivia pool so questions can be asked again
        this.trivia = new Trivia();
        this.trivia.initialize();

        // Load the cave layout
        this.cave.loadCave(caveName);
        const total = this.cave.getRoomCount();

        // Place all entities in different random rooms.
        // 'used' makes sure no two entities start in the same room.
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

        // Player always starts with 3 arrows
        this.player.incrementResource(PlayerResourceType.ARROWS, 3);

        // Build the game UI and attach the four action buttons
        this.container.innerHTML = "";
        this.gfx.buildGameUI(
            this.container,
            () => this.onMoveClick(),
            () => this.onShootClick(),
            () => this.onBuyArrowsClick(),
            () => this.onBuySecretClick(),
            () => this.onQuitClick(),
        );

        // Draw the initial state
        this.refreshUI();
        this.gfx.setWumpusRoom(this.map.getRoomLocation(MapObjectType.WUMPUS));
        this.gfx.updateStatusMessage(`Cave "${caveName}" — you start in room ${this.startRoom}. Good luck!`);
        this.checkWarnings();
    }

    // ── UI refresh ────────────────────────────────────────────────

    // Pushes the current player stats and room info to the display.
    // Called after anything changes (move, shoot, buy, etc.)
    private refreshUI(): void {
        const room = this.map.getRoomLocation(MapObjectType.PLAYER);
        this.gfx.updatePlayerName(this.player.getPlayerName());
        this.gfx.updateArrowCount(this.player.getResource(PlayerResourceType.ARROWS));
        this.gfx.updateCoinCount(this.player.getResource(PlayerResourceType.COINS));
        this.gfx.updateTurnCount(this.player.getResource(PlayerResourceType.TURNS));
        // Reveals this room on the map and shows its exits
        this.gfx.revealRoom(room, this.cave.getConnectedRooms(room));
    }

    // Looks at all rooms directly connected to the player's current room.
    // If any of them contain a hazard, prints the matching warning message
    // and plays the appropriate sound effect.
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
        if (warnings.includes("I smell a Wumpus!")) this.sound.playSound(SoundEventType.WARNING_WUMPUS);
        if (warnings.includes("Bats Nearby"))        this.sound.playSound(SoundEventType.WARNING_BAT);
        if (warnings.includes("I feel a draft"))     this.sound.playSound(SoundEventType.WARNING_PIT);
    }

    // ── Movement ──────────────────────────────────────────────────

    // Called when the player clicks the Move button.
    // Opens the direction picker so they can choose where to go.
    private onMoveClick(): void {
        if (this.gameOver) return;
        this.promptDirection("Move to which room?", dir => this.movePlayer(dir));
    }

    // Moves the player one room in the chosen direction, awards a coin
    // if the cave still has coins left, and checks what's in the new room.
    private async movePlayer(dirIndex: number): Promise<void> {
        const room      = this.map.getRoomLocation(MapObjectType.PLAYER);
        const connected = this.cave.getConnectedRooms(room);
        const target    = connected[dirIndex];
        if (!target) return;

        this.map.setRoomLocation(MapObjectType.PLAYER, target);
        this.player.incrementResource(PlayerResourceType.TURNS);

        // Try to collect a coin — returns false once the cave's 100-coin supply runs out
        const gotCoin = this.player.collectCoin();
        this.sound.playSound(SoundEventType.WALK);
        this.gfx.updateStatusMessage(`You move to room ${target}.${gotCoin ? " (+1 coin)" : " (no coins left in cave)"}`);

        // Show a random trivia fact every time the player moves through a tunnel
        this.gfx.updateStatusMessage(`Trivia: ${this.trivia.getHint()}`);

        this.refreshUI();
        await this.handleRoomEntry(target);
    }

    // Checks what's in the room the player just entered and triggers the
    // appropriate event: Wumpus fight, bat teleport, pit challenge, or just warnings.
    private async handleRoomEntry(room: number): Promise<void> {
        if (this.gameOver) return;

        // Wumpus is here — fight!
        if (room === this.map.getRoomLocation(MapObjectType.WUMPUS)) {
            await this.fightWumpus();
            return;
        }

        // A bat is here — it grabs the player and flies them somewhere random
        const bat1room = this.map.getRoomLocation(MapObjectType.BAT1);
        const bat2room = this.map.getRoomLocation(MapObjectType.BAT2);
        if (room === bat1room || room === bat2room) {
            await this.handleBat(room === bat1room ? MapObjectType.BAT1 : MapObjectType.BAT2);
            return;
        }

        // A pit is here — the player must answer trivia to escape
        const pit1room = this.map.getRoomLocation(MapObjectType.PIT1);
        const pit2room = this.map.getRoomLocation(MapObjectType.PIT2);
        if (room === pit1room || room === pit2room) {
            await this.handlePit();
            return;
        }

        // Room is safe — just show any nearby hazard warnings
        this.checkWarnings();
    }

    // ── Hazards ───────────────────────────────────────────────────

    // The bat picks the player up and drops them in a random different room,
    // then flies itself to another random room so it can be triggered again later.
    private async handleBat(batType: MapObjectType): Promise<void> {
        const total = this.cave.getRoomCount();

        // Pick a new room for the player that isn't where they already are
        let newPlayerRoom: number;
        do { newPlayerRoom = Math.floor(Math.random() * total) + 1; }
        while (newPlayerRoom === this.map.getRoomLocation(MapObjectType.PLAYER));

        // Pick a new room for the bat that isn't the same as the player's new room
        let newBatRoom: number;
        do { newBatRoom = Math.floor(Math.random() * total) + 1; }
        while (newBatRoom === newPlayerRoom);

        this.map.setRoomLocation(batType, newBatRoom);
        this.map.setRoomLocation(MapObjectType.PLAYER, newPlayerRoom);
        this.gfx.updateStatusMessage(`A bat grabs you and drops you in room ${newPlayerRoom}!`);
        this.refreshUI();

        // Check the new room for hazards — the player could land on a pit, Wumpus, etc.
        await this.handleRoomEntry(newPlayerRoom);
    }

    // The player fell in a pit. They must answer 2 out of 3 trivia questions
    // correctly to climb out. Fail → game over. Pass → back to the start room.
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

    // The player is in the same room as the Wumpus.
    // They must answer 3 out of 5 trivia questions correctly to wound it.
    // Win → Wumpus flees 2–4 rooms away. Lose → game over.
    private async fightWumpus(): Promise<void> {
        this.gfx.updateStatusMessage("The Wumpus is here! Answer 3 of 5 questions to wound it.");
        const result = await this.runTriviaChallenge(5, 3);

        if (result.outOfCoins) {
            await this.endGame(false, "You ran out of coins fighting the Wumpus. Game over.");
            return;
        }
        if (result.passed) {
            const fleeRoom = this.wumpusFlee();
            this.map.setRoomLocation(MapObjectType.WUMPUS, fleeRoom);
            this.gfx.setWumpusRoom(fleeRoom);
            this.gfx.updateStatusMessage(`You wounded the Wumpus! It flees to room ${fleeRoom}.`);
            this.refreshUI();
            this.checkWarnings();
        } else {
            await this.endGame(false, "The Wumpus beat you in a fight. Game over.");
        }
    }

    // Picks a room for the Wumpus to flee to after losing a fight.
    // Uses BFS (breadth-first search) to find all rooms 2–4 steps away,
    // then picks one at random, never choosing the player's current room.
    private wumpusFlee(): number {
        const playerRoom = this.map.getRoomLocation(MapObjectType.PLAYER);
        const startRoom  = this.map.getRoomLocation(MapObjectType.WUMPUS);

        // BFS: expand outward room by room, tracking distance
        const visited  = new Set<number>([startRoom]);
        let frontier   = [startRoom];
        const candidates: number[] = []; // all valid escape rooms (distance 2–4)

        for (let dist = 1; dist <= 4; dist++) {
            const next: number[] = [];
            for (const r of frontier) {
                for (const nb of this.cave.getConnectedRooms(r)) {
                    if (!visited.has(nb)) {
                        visited.add(nb);
                        next.push(nb);
                        // Only consider rooms that are at least 2 steps away
                        // and not the player's room
                        if (dist >= 2 && nb !== playerRoom) candidates.push(nb);
                    }
                }
            }
            frontier = next;
        }

        if (candidates.length > 0) {
            return candidates[Math.floor(Math.random() * candidates.length)];
        }

        // Fallback if the cave is very tightly connected: any room except the player's
        for (let r = 1; r <= this.cave.getRoomCount(); r++) {
            if (r !== playerRoom) return r;
        }
        return startRoom;
    }

    // Called after a missed arrow. The Wumpus is startled and always moves
    // exactly one room in a random direction.
    private moveWumpus(): void {
        const wRoom    = this.map.getRoomLocation(MapObjectType.WUMPUS);
        const neighbors = this.cave.getConnectedRooms(wRoom);
        if (neighbors.length > 0) {
            const newRoom = neighbors[Math.floor(Math.random() * neighbors.length)];
            this.map.setRoomLocation(MapObjectType.WUMPUS, newRoom);
            this.gfx.setWumpusRoom(newRoom);
            this.gfx.updateStatusMessage("You hear the Wumpus roar and move!");
        }
    }

    // ── Arrow ─────────────────────────────────────────────────────

    // Called when the player clicks Shoot Arrow.
    // Opens the direction picker, fires the arrow, and handles the result.
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
                // Hit! The player wins.
                this.player.setWumpusKilled();
                await this.endGame(true, "Your arrow flies true — you killed the Wumpus!");
            } else {
                // Miss. The Wumpus wakes up and moves.
                this.gfx.updateStatusMessage(`Your arrow misses. (${this.player.getResource(PlayerResourceType.ARROWS)} arrows left)`);
                this.moveWumpus();

                // After moving, the Wumpus might now be in the player's room
                if (this.map.getRoomLocation(MapObjectType.WUMPUS) === this.map.getRoomLocation(MapObjectType.PLAYER)) {
                    await this.fightWumpus();
                } else if (this.player.getResource(PlayerResourceType.ARROWS) <= 0) {
                    // No arrows left — player loses
                    await this.endGame(false, "You have no arrows left. Game over.");
                } else {
                    this.checkWarnings();
                }
            }
        });
    }

    // ── Purchase arrows ───────────────────────────────────────────

    // The player can spend coins on trivia to buy 2 extra arrows.
    // Requires at least 3 coins (one per question) and 2 correct answers out of 3.
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

    // The player can spend coins on trivia to reveal a random secret.
    // Requires at least 3 coins and 2 correct answers out of 3.
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

    // Randomly picks one of six possible secrets to reveal.
    // Some are useful (Wumpus location), some less so (your own room number).
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

    // Returns the set of all rooms reachable within n steps from the start room.
    // Used to check whether the Wumpus is "nearby" for the proximity secret.
    private roomsWithinN(start: number, n: number): Set<number> {
        const visited = new Set<number>();
        let frontier  = [start];
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

    // Runs a mini trivia challenge. Asks up to 'questionCount' questions one at a time,
    // deducting 1 coin before each question. Resolves with:
    //   passed:     true if the player got at least 'requiredCorrect' right
    //   outOfCoins: true if coins went negative mid-challenge (instant game-over path)
    //
    // If the question pool is exhausted, the slot is skipped with no coin charge.
    private runTriviaChallenge(
        questionCount: number,
        requiredCorrect: number,
    ): Promise<{ passed: boolean; outOfCoins: boolean }> {
        return new Promise(resolve => {
            let correct = 0;
            let asked   = 0;

            const ask = () => {
                // All questions asked — resolve based on how many were correct
                if (asked >= questionCount) {
                    resolve({ passed: correct >= requiredCorrect, outOfCoins: false });
                    return;
                }

                const hasQuestion = this.trivia.getRemainingCount() > 0;

                if (hasQuestion) {
                    // Deduct a coin before showing the question
                    this.player.decrementResource(PlayerResourceType.COINS);
                    this.refreshUI();

                    // Coins below zero = the player has gone into debt → game over
                    if (this.player.getResource(PlayerResourceType.COINS) < 0) {
                        this.gfx.updateStatusMessage("You have gone into debt — you're out of coins!");
                        resolve({ passed: false, outOfCoins: true });
                        return;
                    }
                } else {
                    // No questions left in the pool — skip this slot for free
                    this.gfx.updateStatusMessage("No trivia questions remaining — skipping question.");
                    ask();
                    return;
                }

                // Show the question and wait for the player to pick an answer
                const q = this.trivia.getNextQuestion();
                asked++;

                this.gfx.showTriviaModal(
                    q.question,
                    q.answers,
                    asked,           // current question number
                    questionCount,   // total questions in this challenge
                    correct,         // correct answers so far
                    requiredCorrect, // how many are needed to pass
                    answerIndex => {
                        if (answerIndex === q.correctAnswerIndex) {
                            correct++;
                            this.gfx.updateStatusMessage("Correct!");
                        } else {
                            this.gfx.updateStatusMessage(`Wrong. Answer: ${q.answers[q.correctAnswerIndex]}`);
                        }
                        ask(); // move on to the next question
                    }
                );
            };

            ask(); // kick off the first question
        });
    }

    // ── Direction picker ──────────────────────────────────────────

    // Looks up which rooms are reachable from the player's current position,
    // figures out the compass direction for each, and opens the picker UI.
    // 'onPick' is called with the index into the connected-rooms array.
    private promptDirection(label: string, onPick: (connectedIndex: number) => void): void {
        const room      = this.map.getRoomLocation(MapObjectType.PLAYER);
        const connected = this.cave.getConnectedRooms(room);
        const adj       = this.cave.getAdjacentRooms(room);

        // Match each connected room to its compass direction by finding it
        // in the full adjacency list (which is ordered N, NE, SE, S, SW, NW)
        const dirLabels = connected.map(cr => {
            const i = adj.indexOf(cr);
            return i >= 0 ? DIR_NAMES[i] : "?";
        });

        this.gfx.showDirectionPicker(label, connected, dirLabels, onPick);
    }

    // ── Quit to homepage ─────────────────────────────────────────

    // Immediately abandons the current game and returns to the high scores screen.
    // No score is saved, no game-over screen is shown, no particles play.
    private onQuitClick(): void {
        if (this.gameOver) return;
        this.gameOver = true;
        // Start music within this click gesture before navigating away
        this.gfx.unlockAndPlayIntroMusic();
        this.gfx.showHighScores(this.scores.getHighScores(), () => this.startSetup());
    }

    // ── Game over ─────────────────────────────────────────────────

    // Stops the game, plays the win/lose sound, shows the result screen,
    // and — if the player won — saves their score to the leaderboard.
    private async endGame(won: boolean, message: string): Promise<void> {
        this.gameOver = true;
        this.sound.playSound(won ? SoundEventType.WIN : SoundEventType.LOSE);
        const score = this.player.getScore();

        this.gfx.showGameOver(won, message, score, async () => {
            if (won) {
                // Save the score with the full N/G/A breakdown for the leaderboard
                await this.scores.addScore(
                    this.player.getPlayerName(),
                    score,
                    this.caveName,
                    this.player.getResource(PlayerResourceType.TURNS),
                    this.player.getResource(PlayerResourceType.COINS),
                    this.player.getResource(PlayerResourceType.ARROWS),
                );
            }
            // Reload scores (in case another game saved while we were playing)
            await this.scores.load();
            // Return to the high scores screen
            this.gfx.showHighScores(this.scores.getHighScores(), () => this.startSetup());
        });
    }
}
