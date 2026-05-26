import type { IHighScores } from "./IHighScores";

export interface IHighScoreGraphics {
    /**
     * Opens the high score modal.
     * Optionally highlights one score by name/score and runs a callback when closed.
     */
    show(highScores: IHighScores, playerName?: string, playerScore?: number, onClose?: () => void): void;

    /**
     * Closes the high score modal if it is open.
     */
    close(): void;
}
