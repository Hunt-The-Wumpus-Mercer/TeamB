import type { ICave } from "./ICave";
import type { IMap } from "./IMap";

export interface IMapHelper {
    /**
    * Initializes the helper with cave and map dependencies,
    * including random map object placement.
     */
    initialize(cave: ICave, map: IMap): void;

    /**
     * Returns hazards in the player's current room.
     * Hazard names are "wumpus", "bat", and "pit".
     * If wumpus is present, it appears first in the result.
     */
    getHazardsInPlayerRoom(): string[];

    /**
     * Returns warning messages for hazards in rooms adjacent to the player.
     * Warning messages are unique and may include multiple entries.
     */
    getWarningsNearPlayer(): string[];

    /**
     * Moves the wumpus after a missed shot to a room up to two moves away.
     * Returns the new room number.
     */
    moveWumpusAfterMiss(): number;

    /**
     * Returns a secret fact about current map state.
     */
    getSecret(): string;

    /**
     * Moves the player to a random room after a bat encounter.
     * Returns the new room number.
     */
    movePlayerAfterBatEncounter(excludedRooms?: number[]): number;
}
