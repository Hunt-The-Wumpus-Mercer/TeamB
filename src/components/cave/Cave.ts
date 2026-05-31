// Cave loads and stores the layout of a single cave.
// Each cave is a JSON file describing 30 hexagonal rooms.
// Every room lists:
//   connected_rooms — rooms the player can actually walk into from here
//   adjacent_rooms  — all 6 neighbouring hex cells (some may have no door)

import type { ICave } from "./ICave";
import cave1 from './cave1.json';
import cave2 from './cave2.json';
import cave3 from './cave3.json';
import cave4 from './cave4.json';
import cave5 from './cave5.json';

export default class Cave implements ICave {

    // Holds the room data for whichever cave is currently loaded
    private rooms: any = {};

    // All five cave layouts, keyed by name
    private caves: any = { cave1, cave2, cave3, cave4, cave5 };

    // Switches the active cave — loads all room data from the chosen file
    loadCave(caveName: string): void {
        this.rooms = this.caves[caveName];
    }

    // Returns the list of cave names the player can choose from
    getAvailableCaves(): string[] {
        return Object.keys(this.caves);
    }

    // Returns how many rooms the currently loaded cave has (always 30)
    getRoomCount(): number {
        return Object.keys(this.rooms).length;
    }

    // Returns the raw data object for a single room
    getRoom(roomNumber: number): any {
        return this.rooms[roomNumber];
    }

    // Returns the 6 neighbouring hex cells for a room.
    // These are used to draw the map — they include walls with no door.
    getAdjacentRooms(roomNumber: number): number[] {
        return this.getRoom(roomNumber).adjacent_rooms;
    }

    // Returns only the rooms the player can actually move into from here.
    // This is a subset of the adjacent rooms — only the ones with open doors.
    getConnectedRooms(roomNumber: number): number[] {
        return this.getRoom(roomNumber).connected_rooms;
    }
}
