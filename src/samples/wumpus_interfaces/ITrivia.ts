export type QuestionPrompt = {
    question: string;
    answers: string[];
    correctAnswerIndex: number;
};

export interface ITrivia {
    /**
     * Loads trivia questions from the configured data source.
     */
    initialize(): Promise<void>;

    /**
     * Returns one random remaining question, shuffles answer order,
     * and removes that question from the remaining pool.
     */
    getNextQuestion(): QuestionPrompt;

    /**
     * Returns a hint from one remaining trivia entry without consuming a question.
     */
    getHint(): string;
}