export type HighScoreEntry = {
    name: string;
    score: number;
    cave: string;
    turns: number;
    coins: number;
    arrows: number;
};

export interface IHighScores {
    load(): Promise<void>;
    addScore(name: string, score: number, cave: string, turns: number, coins: number, arrows: number): Promise<void>;
    getHighScores(): HighScoreEntry[];
}
