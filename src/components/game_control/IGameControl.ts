import type { CaveRoomDirections } from "../shared/CaveRoomDirections"
//import type { TriviaChallengeResult } from "./ITriviaGraphics";

export interface IGameControl {
    /**
     * Initializes all game dependencies and renders the game UI.
     */
    init(containerSelector: JQuery): void;

    /**
     * Runs a trivia challenge and returns the challenge outcome.
     */
   // runTriviaChallenge(questionCount: number, requiredCorrectAnswers: number): Promise<TriviaChallengeResult>;

    /**
     * Attempts to move the player one room in the specified direction.
     */
    movePlayer(caveRoomDirection: CaveRoomDirections): void;
    /**
     * Shoots an arrow through the selected doorway direction.
     */
    shootArrow(caveRoomDirection: CaveRoomDirections):void;

    /**
     * Attempts to buy arrows by completing a trivia challenge.
     */
    purchaseArrow():void;

    /**
     * Attempts to buy a secret by completing a trivia challenge.
     */
    purchaseSecret():void;

    /**
     * Displays the high scores.
     */
    viewHighScores():void;
}
