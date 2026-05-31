// Player tracks everything about the human playing the game:
// their name, how many arrows/coins/turns they have, and whether
// they killed the Wumpus.

import type { IPlayer } from "./IPLayer";
import { PlayerResourceType } from "./IPLayer";

export class Player implements IPlayer {
    // The player's display name
    private name = "";

    // The three running counters shown in the UI
    private resources = {
        arrows: 0,  // arrows left to shoot
        coins:  0,  // coins currently held (spent on trivia)
        turns:  0,  // number of moves taken so far
    };

    // Flips to true when the player successfully kills the Wumpus
    private wumpusKilled = false;

    // Tracks total coins ever picked up from the cave floor.
    // Spending coins does NOT reduce this — once a coin leaves the cave it's gone.
    private coinsCollected = 0;

    // The cave only contains 100 coins total; no more can be earned after that
    private readonly MAX_COINS = 100;

    // ── Name ──────────────────────────────────────────────────────

    getPlayerName(): string {
        return this.name;
    }

    setPlayerName(name: string): void {
        this.name = name;
    }

    // ── Generic resource getters / setters ────────────────────────

    // Returns the current value of arrows, coins, or turns
    getResource(resource: PlayerResourceType): number {
        return this.resources[resource];
    }

    // Adds 'amount' (default 1) to a resource and returns the new value
    incrementResource(resource: PlayerResourceType, amount = 1): number {
        return (this.resources[resource] += amount);
    }

    // Subtracts 'amount' (default 1) from a resource and returns the new value.
    // Coins can go negative (debt) which triggers a game-over check elsewhere.
    decrementResource(resource: PlayerResourceType, amount = 1): number {
        return (this.resources[resource] -= amount);
    }

    // ── Coin collection ───────────────────────────────────────────

    // Called when the player walks into a new room.
    // Awards 1 coin if the cave's 100-coin supply hasn't been exhausted yet.
    // Returns true if a coin was actually awarded, false if the cave is empty.
    collectCoin(): boolean {
        if (this.coinsCollected >= this.MAX_COINS) return false;
        this.coinsCollected++;
        this.resources.coins++;
        return true;
    }

    // ── Wumpus kill ───────────────────────────────────────────────

    // Marks that the player has killed the Wumpus (used for score calculation)
    setWumpusKilled(): void {
        this.wumpusKilled = true;
    }

    // ── Score ─────────────────────────────────────────────────────

    // Calculates the final score using the spec formula:
    //   100 (kill bonus) − turns taken + coins held + (10 × arrows remaining)
    // If the Wumpus was never killed the kill bonus is 0.
    getScore(): number {
        const killBonus = this.wumpusKilled ? 100 : 0;
        return killBonus - this.resources.turns + this.resources.coins + 10 * this.resources.arrows;
    }
}
