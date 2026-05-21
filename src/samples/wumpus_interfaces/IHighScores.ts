export type HighScoreEntry = {
    name: string;
    score: number;
};

export interface IHighScores {
    /**
     * Loads high scores from storage into memory.
     */
    load(): Promise<void>;

    /**
     * Adds a score, keeps the list sorted, and persists the updated results.
     */
    addScore(name: string, score: number): Promise<void>;

    /**
     * Returns the current high score list.
     */
    getHighScores(): HighScoreEntry[];
}