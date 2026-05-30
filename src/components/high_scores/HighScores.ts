import type { IHighScores, HighScoreEntry } from "./IHighScores";

export default class HighScores implements IHighScores {
    private scores: HighScoreEntry[] = [];
    private readonly maxEntries = 10;
    private readonly storageKey = "wumpusHighScores";

    async load(): Promise<void> {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed: HighScoreEntry[] = JSON.parse(stored);
                // Drop any entries that predate the cave field
                this.scores = parsed.filter(e => e.cave != null);
            } else {
                this.scores = [];
            }
        } catch {
            this.scores = [];
        }
    }

    async addScore(name: string, score: number, cave: string): Promise<void> {
        this.scores.push({ name: name.trim(), score, cave });
        this.scores.sort((a, b) => b.score - a.score);
        if (this.scores.length > this.maxEntries) {
            this.scores = this.scores.slice(0, this.maxEntries);
        }
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.scores));
        } catch {
            // storage unavailable — silently continue
        }
    }

    getHighScores(): HighScoreEntry[] {
        return [...this.scores];
    }
}
