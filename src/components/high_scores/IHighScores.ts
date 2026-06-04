export type HighScoreEntry = {
    name: string;
    score: number;
    cave: string;
    turns: number;
    coins: number;
    arrows: number;
    difficulty?: 'easy' | 'normal' | 'hard';
};

export interface IHighScores {
    load(): Promise<void>;
    addScore(name: string, score: number, cave: string, turns: number, coins: number, arrows: number, difficulty?: 'easy' | 'normal' | 'hard'): Promise<void>;
    getHighScores(): HighScoreEntry[];
}
