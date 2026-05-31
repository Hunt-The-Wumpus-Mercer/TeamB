// Map keeps track of which room every game entity is currently in.
// Entities are: the player, the Wumpus, two bats, and two bottomless pits.
// Room numbers are positive integers (1–30). 0 means "not placed yet".

import { type IMap, MapObjectType } from "./IMap";

export default class Map implements IMap {
    // Current room number for each entity
    player = 0;
    bat1   = 0;
    bat2   = 0;
    pit1   = 0;
    pit2   = 0;
    wumpus = 0;

    // Returns the room number where the requested entity currently lives
    getRoomLocation(type: MapObjectType): number {
        if (type === MapObjectType.PLAYER) return this.player;
        if (type === MapObjectType.BAT1)   return this.bat1;
        if (type === MapObjectType.BAT2)   return this.bat2;
        if (type === MapObjectType.PIT1)   return this.pit1;
        if (type === MapObjectType.PIT2)   return this.pit2;
        return this.wumpus; // WUMPUS
    }

    // Moves the requested entity to a new room number
    setRoomLocation(type: MapObjectType, roomNumber: number): void {
        if (type === MapObjectType.PLAYER) { this.player = roomNumber; return; }
        if (type === MapObjectType.BAT1)   { this.bat1   = roomNumber; return; }
        if (type === MapObjectType.BAT2)   { this.bat2   = roomNumber; return; }
        if (type === MapObjectType.PIT1)   { this.pit1   = roomNumber; return; }
        if (type === MapObjectType.PIT2)   { this.pit2   = roomNumber; return; }
        this.wumpus = roomNumber; // WUMPUS
    }
}
