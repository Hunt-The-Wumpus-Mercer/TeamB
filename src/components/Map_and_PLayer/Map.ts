
import { type IMap, MapObjectType } from "./IMap";

export default class Map implements IMap {
    player = 0;
    bat1 = 0;
    bat2 = 0;
    pit1=0;
    pit2 = 0;
    wumpus = 0;

    /**
         * Returns the room location for the requested map object.
         */
        getRoomLocation(type: MapObjectType): number{
            if(type === MapObjectType.PLAYER){
                return this.player;
            }
            else if(type === MapObjectType.BAT1){
                return this.bat1;
            }
            else if(type === MapObjectType.BAT2){
                return this.bat2;
            }else if(type === MapObjectType.PIT1){
                return this.pit1;
            }else if(type === MapObjectType.PIT2){
                return this.pit2;
            }else {
                return this.wumpus;
            }
        }
        /**
         * Sets the room location for the requested map object.
         */
        setRoomLocation(type: MapObjectType, roomNumber: number): void{
            
            if(type === MapObjectType.PLAYER){
                this.player=roomNumber;
            }
            else if(type === MapObjectType.BAT1){
                this.bat1 = roomNumber;
            }
            else if(type === MapObjectType.BAT2){
                this.bat2 = roomNumber;
            }else if(type === MapObjectType.PIT1){
                this.pit1 = roomNumber;
            }else if(type === MapObjectType.PIT2){
                this.pit2 = roomNumber;
            }else {
                this.wumpus = roomNumber;
            }
        }
}