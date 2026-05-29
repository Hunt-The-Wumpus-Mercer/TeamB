import type {ICave} from "./ICave"
import cave1 from './cave1.json';
import cave2 from './cave2.json';

export default class Cave implements ICave {

    private rooms: any = {};
    private caves: any = { 
        cave1: cave1,
        cave2: cave2,
    };
   
    /**
    * Loads cave data from one of the available cave files.
    * Rooms are numbered from 1..N.
    * A value of 0 means there is no adjacent room/connection for that side.
     */
    loadCave(caveName: string): void
    {
        this.rooms = this.caves[caveName];
      

    }

    /**
     * Returns the list of cave file paths that can be loaded.
     */
    getAvailableCaves(): string[]
    {
        return Object.keys(this.caves);
    }

    /**
     * Returns the number of rooms in the currently loaded cave.
     */
    getRoomCount(): number
    {
        return this.getAvailableCaves().length;
    }

    getRoom(roomNumber: number) : any {
        return this.rooms[roomNumber];
    }

    /**
     * Returns six adjacent room entries for the given room.
     * Each value is a room number in the range 1..N, or 0 when no adjacent room exists.
     */
    getAdjacentRooms(roomNumber: number): number[]
    {
        return this.getRoom(roomNumber).adjacent_rooms;
    }

    /**
     * Returns six connected room entries for the given room,
     * using 0 where no doorway connection exists.
     */
    getConnectedRooms(roomNumber: number): number[]
    {
        return this.getRoom(roomNumber).connected_rooms;
    }
}
