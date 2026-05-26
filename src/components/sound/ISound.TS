/**
 * Supported one-shot sound events used by game logic.
 */
export const SoundEventType = {
    WALK: "walk",
    SHOOT_ARROW: "shoot_arrow",
    WIN: "win",
    LOSE: "lose",
    WARNING_BAT: "warning_bat",
    WARNING_PIT: "warning_pit",
    WARNING_WUMPUS: "warning_wumpus",
    
} as const;

export type SoundEventType = (typeof SoundEventType)[keyof typeof SoundEventType];

export interface ISoundManager {
    /**
     * Plays one sound for the specified event type.
     */
    playSound(soundEventType: SoundEventType): void;
}
