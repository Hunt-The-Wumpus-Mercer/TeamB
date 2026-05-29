import type {IHighScores} from "./IHighScores"
import HSGraphics from './HighScoresGraphics.html?raw';
import $ from 'jquery';

export interface HighScoreEntry {
    name: string;
    score: number;
}

export default class HighScores implements IHighScores {
    private scores: HighScoreEntry[] = [];
    private readonly maxEntries = 10;
    private readonly storageKey = "wumpusHighScores";

    /**
    * Loads high scores from storage into memory.
    */
    async load() : Promise<void> {
        try {
            if (typeof window !== "undefined" && window.localStorage) {
                const storedScores = localStorage.getItem(this.storageKey);
                if (storedScores) {
                    this.scores = JSON.parse(storedScores);
                    return;
                }
            }
            this.scores = [];
        } catch (error) {
            console.error("Failed to load high scores: ", error);
            this.scores = [];
        }
    }

    /**
        * Adds a score, keeps the list sorted, and persists the updated results.
        */
    async addScore(name: string, score: number): Promise<void> {
        const cleanName = name.trim(); 
        const newEntry: HighScoreEntry = {
            name: cleanName,
            score: score
        };
        this.scores.push(newEntry);
        this.scores.sort((a, b) => b.score - a.score);
        if (this.scores.length > this.maxEntries){
            this.scores = this.scores.slice(0, this.maxEntries);
        }
        await this.save();
    }
    
    private async save(): Promise<void> {
        try{
            if (typeof window != "undefined" && window.localStorage) {
                localStorage.setItem(this.storageKey, JSON.stringify(this.scores));
            }
        } catch (error) {
            console.error("Failed to save high scores: ", error);
        }
    }

    /**
    * Returns the current high score list.
    */
    getHighScores(): HighScoreEntry[] {
        return [...this.scores];
    }

    /** 
     * Displaying high scores
     */
    private $container!: JQuery;
    private $colorTiles!: JQuery;
    showHS($container: JQuery): void {
        this.$container = $container;
        this.$container.hide();

        this.$container.html(HSGraphics);
        this.$container.on('click', '[data-role="openLeaderboard"]', (e) => this.onLeaderboardClick(e));

        this.$container.show();

    }

}
