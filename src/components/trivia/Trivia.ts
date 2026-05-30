import type { ITrivia, QuestionPrompt } from "./ITrivia";
import Questions from './Trivia.json';

export default class trivia implements ITrivia {

    private remainingQuestions: QuestionPrompt[] = [];

    initialize(): void {
        this.remainingQuestions = (Questions as any[]).map(q => ({
            question: q.question,
            answers: [...q.answers],
            correctAnswerIndex: Number(q.correctAnswerIndex)
        }));


    }

    getNextQuestion(): QuestionPrompt {

        if (this.remainingQuestions.length === 0) {
            throw new Error("No questions left in the pool. Call initialize() to reset.");
        }

        const randomIndex = Math.floor(Math.random() * this.remainingQuestions.length);
        const targetQuestion = this.remainingQuestions[randomIndex];

        this.remainingQuestions.splice(randomIndex, 1);

        const correctAnswerText = targetQuestion.answers[targetQuestion.correctAnswerIndex];

        const shuffledAnswers = [...targetQuestion.answers];
        for (let i = shuffledAnswers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledAnswers[i], shuffledAnswers[j]] = [shuffledAnswers[j], shuffledAnswers[i]];
        }

        const newCorrectIndex = shuffledAnswers.indexOf(correctAnswerText);

        return {
            question: targetQuestion.question,
            answers: shuffledAnswers,
            correctAnswerIndex: newCorrectIndex
        };

    }

    getRemainingCount(): number {
        return this.remainingQuestions.length;
    }

    getHint(): string {
        if (this.remainingQuestions.length === 0) return "No trivia left!";
        const q = this.remainingQuestions[Math.floor(Math.random() * this.remainingQuestions.length)];
        return `Q: ${q.question}  —  A: ${q.answers[q.correctAnswerIndex]}`;
    }
    
}