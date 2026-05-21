import type { CaveRoomDirections } from "./CaveRoomDirections";
import type { TriviaChallengeResult } from "./ITriviaGraphics";

export interface IGameControl {
    /**
     * Initializes all game dependencies and renders the game UI.
     */
    init(containerSelector: string): Promise<void>;

    /**
     * Runs a trivia challenge and returns the challenge outcome.
     */
    runTriviaChallenge(questionCount: number, requiredCorrectAnswers: number): Promise<TriviaChallengeResult>;

    /**
     * Attempts to move the player one room in the specified direction.
     */
    movePlayer(caveRoomDirection: CaveRoomDirections): Promise<string>;

    /**
     * Shoots an arrow through the selected doorway direction.
     */
    shootArrow(caveRoomDirection: CaveRoomDirections): Promise<string>;

    /**
     * Attempts to buy arrows by completing a trivia challenge.
     */
    purchaseArrow(): Promise<string>;

    /**
     * Attempts to buy a secret by completing a trivia challenge.
     */
    purchaseSecret(): Promise<string>;

    /**
     * Displays the high scores.
     */
    viewHighScores(): Promise<string>;
}
