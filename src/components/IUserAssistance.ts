export const UserAssistanceTipType = {
    SHOOT_AN_ARROW: "shoot_an_arrow",
    MOVE_ROOM: "move_room",
} as const;

export type UserAssistanceTipType = (typeof UserAssistanceTipType)[keyof typeof UserAssistanceTipType];

export interface IUserAssistance {
    /**
     * Displays the tutorial/startup UI and collects player name and cave choice.
     */
    showInstructions(
        onComplete: (playerName: string, caveChoice: string) => void,
        availableCaves: string[],
    ): void;

    /** Displays a contextual tip UI. */
    showTip(tipType: UserAssistanceTipType): void;

    /** Displays the debug menu UI. */
    showDebugMenu(): void;
}


