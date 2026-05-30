export type HighScoreEntry = {
    name: string;
    score: number;
    cave: string;
};

export interface IHighScores {
    load(): Promise<void>;
    addScore(name: string, score: number, cave: string): Promise<void>;
    getHighScores(): HighScoreEntry[];
}
