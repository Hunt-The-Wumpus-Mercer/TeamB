// HighScores saves and loads the top 10 scores to the browser's localStorage
// so they persist between sessions.  Each entry stores the player's name,
// their score, the cave they played, and the breakdown values N/G/A.

import type { IHighScores, HighScoreEntry } from "./IHighScores";

export default class HighScores implements IHighScores {
    // The current list held in memory (up to 10 entries, sorted best-first)
    private scores: HighScoreEntry[] = [];

    // We never keep more than 10 scores
    private readonly maxEntries = 10;

    // The key used to store/retrieve scores in localStorage
    private readonly storageKey = "wumpusHighScores";

    // Reads the saved scores from localStorage into memory.
    // Old entries that were saved before the cave/turns/coins/arrows
    // fields existed are silently discarded so stale data doesn't appear.
    async load(): Promise<void> {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed: HighScoreEntry[] = JSON.parse(stored);
                // Keep only entries that have the full set of fields
                this.scores = parsed.filter(e => e.cave != null && e.turns != null);
            } else {
                this.scores = [];
            }
        } catch {
            // If parsing fails for any reason, start with an empty list
            this.scores = [];
        }
    }

    // Adds a new score, re-sorts the list highest-first, trims to 10,
    // and saves the result back to localStorage.
    // If the new score is lower than all 10 existing scores it will be
    // pushed off the end during the trim and effectively discarded.
    async addScore(name: string, score: number, cave: string, turns: number, coins: number, arrows: number): Promise<void> {
        this.scores.push({ name: name.trim(), score, cave, turns, coins, arrows });

        // Sort descending — higher score = better rank
        this.scores.sort((a, b) => b.score - a.score);

        // Keep only the top 10
        if (this.scores.length > this.maxEntries) {
            this.scores = this.scores.slice(0, this.maxEntries);
        }

        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.scores));
        } catch {
            // localStorage might be unavailable (private browsing, quota exceeded)
            // — silently continue so the game isn't broken
        }
    }

    // Returns a copy of the current score list so callers can't accidentally
    // mutate the internal array
    getHighScores(): HighScoreEntry[] {
        return [...this.scores];
    }
}
