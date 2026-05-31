// Trivia manages the pool of questions used throughout the game.
// Questions are loaded from Trivia.json (Simpsons and teen-slang themed).
// Each question is used at most once per game — the pool shrinks as
// questions are asked and never repeats until the game resets.

import type { ITrivia, QuestionPrompt } from "./ITrivia";
import Questions from './Trivia.json';

export default class trivia implements ITrivia {

    // The questions still available to be asked this game
    private remainingQuestions: QuestionPrompt[] = [];

    // Loads all questions from the JSON file into the pool.
    // Call this once at the start of each new game to reset the pool.
    initialize(): void {
        this.remainingQuestions = (Questions as any[]).map(q => ({
            question:           q.question,
            answers:            [...q.answers],       // copy so the original isn't mutated
            correctAnswerIndex: Number(q.correctAnswerIndex),
        }));
    }

    // Picks a random question from the pool, removes it so it can't be asked again,
    // shuffles the answer order (so the correct answer isn't always option A),
    // and returns the question ready to display.
    getNextQuestion(): QuestionPrompt {
        if (this.remainingQuestions.length === 0) {
            throw new Error("No questions left in the pool. Call initialize() to reset.");
        }

        // Pick a random question and remove it from the pool
        const randomIndex   = Math.floor(Math.random() * this.remainingQuestions.length);
        const targetQuestion = this.remainingQuestions[randomIndex];
        this.remainingQuestions.splice(randomIndex, 1);

        // Remember which answer text is correct before we shuffle
        const correctAnswerText = targetQuestion.answers[targetQuestion.correctAnswerIndex];

        // Shuffle the answers using the Fisher-Yates algorithm
        const shuffledAnswers = [...targetQuestion.answers];
        for (let i = shuffledAnswers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledAnswers[i], shuffledAnswers[j]] = [shuffledAnswers[j], shuffledAnswers[i]];
        }

        // Find where the correct answer landed after shuffling
        const newCorrectIndex = shuffledAnswers.indexOf(correctAnswerText);

        return {
            question:           targetQuestion.question,
            answers:            shuffledAnswers,
            correctAnswerIndex: newCorrectIndex,
        };
    }

    // How many questions are still left in the pool
    getRemainingCount(): number {
        return this.remainingQuestions.length;
    }

    // Returns a random Q&A fact from the remaining pool without removing the question.
    // Used as a fun trivia snippet shown to the player when they move rooms,
    // and also as one of the possible "secrets" they can purchase.
    getHint(): string {
        if (this.remainingQuestions.length === 0) return "No trivia left!";
        const q = this.remainingQuestions[Math.floor(Math.random() * this.remainingQuestions.length)];
        return `Q: ${q.question}  —  A: ${q.answers[q.correctAnswerIndex]}`;
    }
}
