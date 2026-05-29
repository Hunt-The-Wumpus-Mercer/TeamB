import type IGraphics from "./IGraphics"

export default class Graphics implements IGraphics {
    initialize(): void;
    /** Updates the displayed player name. */
    updatePlayerName(name: string): void;
    /** Updates the displayed arrow count. */
    updateArrowCount(arrows: number): void;
    /** Updates the displayed coin count. */
    updateCoinCount(coins: number): void;
    /** Updates the displayed turn count. */
    updateTurnCount(turns: number): void;
    /** Updates the currently displayed room number. */
    updateCurrentRoom(roomNumber: number): void;
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
