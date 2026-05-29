import type {IHighScores} from "./IHighScores"
import HSGraphics from './HighScoresGraphics.html?raw';
import $ from 'jquery';

export interface HighScoreEntry {
    name: string;
    score: number;
}

export default class HighScores implements IHighScores {
    private scores: HighScoreEntry[] = []; //scores = Array holding current high scores
    private readonly maxEntries = 10;
    private readonly storageKey = "wumpusHighScores";

    private $container!: JQuery; //main wrapper element
    private $leaderboard!: JQuery; //specific inner <div> where scores are appended

    /**
    * Loads high scores from storage into memory.
    */
    async load() : Promise<void> {
        try {
            //ensures that it is running in a window that exists and supports local storage
            if (typeof window !== "undefined" && window.localStorage) {
                //takes the new score data using the storageKey, and parses it into the scores array
                const storedScores = localStorage.getItem(this.storageKey);
                if (storedScores) {
                    this.scores = JSON.parse(storedScores);
                    return;
                }
            }
            this.scores = [];
        } catch (error) {
            //error is logged if data cannot be parsed, browser isn't supported, or storage corrupted
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
        //sorts array in descending order (ie, if b.score - a.score is positive, that means a is in a higher spot than b)
        this.scores.sort((a, b) => b.score - a.score);
        //ensures that it only keeps track of the top 10 scores
        if (this.scores.length > this.maxEntries){
            this.scores = this.scores.slice(0, this.maxEntries);
        }
        await this.save();
    }
    
    private async save(): Promise<void> {
        try{
            if (typeof window != "undefined" && window.localStorage) {
                //converting array into a single JSON string 
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
    
    showHS($container: JQuery): void {
        this.$container = $container;
        this.$container.hide();

        this.$container.html(HSGraphics);
        //when [data-role="openLeaderboard"] gets clicked from the container, trigger the onLeaderboardClick method
        this.$container.on('click', '[data-role="openLeaderboard"]', (e) => this.onLeaderboardClick(e));
        //searching for the element assigned to hold the scores slot in the updated list
        this.$leaderboard = this.$container.find('[data-slot="leaderboard"]');
        
        this.$leaderboard.empty();

        // looping through the high scores to display each one on the leaderboard
        for (let i = 0; i < this.scores.length; i++) {
            const $currentScore = $('<div>', {
                class: 'leaderboard entry',
                text: '${i + 1}. ${entry.name} - ${entry.score} pts'
                //Current score is the score at the place of i in the scores array. We need to display this score.
            });
            this.$leaderboard.append($currentScore);
        }
        this.$container.show();
    }

    /** 
     * Ensures the container remains available
     */
    private onLeaderboardClick(e: JQuery.ClickEvent): void {
        this.$container.show();
    }

}
