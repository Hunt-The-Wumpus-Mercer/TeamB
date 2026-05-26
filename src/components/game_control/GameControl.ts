import type { IGameControl } from "./IGameControl"

export default class GameControl implements IGameControl {
        /**
     * Initializes all game dependencies and renders the game UI.
     */
    init(containerSelector: string): Promise<void> {
        console.log("init function called");
        return new Promise();
    }

    movePlayer(caveRoomDirection: CaveRoomDirections): Promise<string> {

    }
    
    shootArrow(caveRoomDirection: CaveRoomDirections): Promise<string> {

    }
    
    purchaseArrow(): Promise<string> {

    }

    purchaseSecret(): Promise<string> {

    }
    
    viewHighScores(): Promise<string> {

    }
    
    
}