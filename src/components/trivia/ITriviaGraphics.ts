import type { ITrivia } from "./ITrivia";

export type TriviaChallengeResult = {
    /** True when required correct answers were achieved. */
    isCorrect: boolean;
    /** Number of questions that were shown and answered in this challenge. */
    numberOfQuestionsAsked: number;
};

export interface ITriviaGraphics {
    /**
     * Presents a trivia challenge and returns the final outcome.
     */
    runChallenge(
        trivia: ITrivia,
        questionCount: number,
        requiredCorrectAnswers: number,
    ): Promise<TriviaChallengeResult>;

    /**
     * Closes the trivia challenge UI if it is currently open.
     */
    close(): void;
}
