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

    setWumpusKilled(): void {
        this.wumpusKilled = true;
    }

    getScore(): number {
        return (
            this.resources.coins +
            this.resources.arrows -
            this.resources.turns +
            (this.wumpusKilled ? 50 : 0)
        );
    }
}