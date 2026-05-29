import type IGraphics from "./IGraphics"
import type { IGameControl } from "../game_control/IGameControl";
import { CaveRoomDirections } from "../shared/CaveRoomDirections";

export default class Graphics implements IGraphics {
    private gameControl: IGameControl | null;
    private northBox = new Image();

    constructor(gc: IGameControl) 
    {
        this.gameControl = gc;

        this.northBox.src = 'https://i.pinimg.com/originals/e8/0c/f3/e80cf36f4eb13dca261438a58d39b390.gif';
        this.northBox.addEventListener('click', () => this.northBoxClicked());
        document.body.append(this.northBox);
    }

    /**
     * Initializes all game dependencies and renders the game UI.
     */
    init(containerSelector: string): Promise<void>
    {

    }

    private northBoxClicked(): void 
    
        console.log('North');
        this.gameControl?.movePlayer(CaveRoomDirections.NORTH);
    }

    /** Updates the displayed player name. */
    updatePlayerName(name: string): void 
    {

    }

    /** Updates the displayed arrow count. */
    updateArrowCount(arrows: number): void 
    {

    }

    /** Updates the displayed coin count. */
    updateCoinCount(coins: number): void 
    {

    }

    /** Updates the displayed turn count. */
    updateTurnCount(turns: number): void 
    {

    }

    /** Updates the currently displayed room number. */
    updateCurrentRoom(roomNumber: number): void
    {

    }
    /** Updates doorway visibility/state from adjacent room data. */
    updateRoomExits(adjacentRooms: number[]): void;
    /** Updates nearby hazard warnings shown to the player. */
    updateWarnings(warnings: string[]): void;
    /** Updates the main status text area. */
    updateStatusMessage(message: string): void;
    /** Updates the secret/hint display area. */
    updateSecret(secret: string): void;
    /** Forces a full UI redraw from current graphics state. */
    updateScreen(): void;
}
