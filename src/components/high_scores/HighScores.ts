import type {IHighScores} from "./IHighScores"

export default class HighScores implements IHighScores {
    load() : Promise<void> {}
        /**
        * Loads high scores from storage into memory.
        */
    addScore(name: string, score: number) : Promise<void> {}
        /**
        * Adds a score, keeps the list sorted, and persists the updated results.
        */

    getHighScores(): HighScoreEntry[] {}
        /**
         * Returns the current high score list.
         */
}
