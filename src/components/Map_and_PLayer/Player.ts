import type { IPlayer } from "./IPLayer";
import { PlayerResourceType } from "./IPLayer";
export class Player implements IPlayer {
    private name = "";
    private resources = {
        arrows: 0,
        coins: 0,
        turns: 0,
    };

    private wumpusKilled = false;
    private coinsCollected = 0;
    private readonly MAX_COINS = 100;

    getPlayerName(): string {
        return this.name;
    }

    setPlayerName(name: string): void {
        this.name = name;
    }

    getResource(resource: PlayerResourceType): number {
        return this.resources[resource];
    }

    incrementResource(
        resource: PlayerResourceType,
        amount = 1
    ): number {
        return (this.resources[resource] += amount);
    }

    decrementResource(
        resource: PlayerResourceType,
        amount = 1
    ): number {
        return (this.resources[resource] -= amount);
    }

    collectCoin(): boolean {
        if (this.coinsCollected >= this.MAX_COINS) return false;
        this.coinsCollected++;
        this.resources.coins++;
        return true;
    }

    setWumpusKilled(): void {
        this.wumpusKilled = true;
    }

    getScore(): number {
        const killBonus = this.wumpusKilled ? 100 : 0;
        return (
            100 -
            this.resources.turns +
            this.resources.coins +
            10 * this.resources.arrows +
            killBonus
        );
    }
}