// SoundManager plays one-shot sound effects for game events.
// Each event type maps to an MP3 file in this folder.
// Using import.meta.url tells Vite to bundle the files and give us
// the correct URL even after the filenames are hashed for production.

import { type ISoundManager, SoundEventType } from "./ISound";

// Build a lookup table of event name → audio file URL at startup.
// Vite resolves each 'new URL(...)' call and includes the file in the bundle.
const SOUND_URLS: Record<string, string> = {
    [SoundEventType.WALK]:           new URL('./freesounds123-heavy-character-walk-363348.mp3',       import.meta.url).href,
    [SoundEventType.SHOOT_ARROW]:    new URL('./djartmusic-arrow-twang_01-306041.mp3',                import.meta.url).href,
    [SoundEventType.WIN]:            new URL('./mrstokes302-you-win-sfx-mrstokes302-442128.mp3',      import.meta.url).href,
    [SoundEventType.LOSE]:           new URL('./u_l5xum8z250-losing-horn-313723.mp3',                 import.meta.url).href,
    [SoundEventType.WARNING_BAT]:    new URL('./the-vampires-monster-bat-chirping-type-2-355965.mp3', import.meta.url).href,
    [SoundEventType.WARNING_PIT]:    new URL('./dragon-studio-thud-sound-effect-405470.mp3',          import.meta.url).href,
    [SoundEventType.WARNING_WUMPUS]: new URL('./freesound_community-monster-roar-6985.mp3',           import.meta.url).href,
};

export default class SoundManager implements ISoundManager {
    // Creates a fresh Audio element for the given event and plays it immediately.
    // Creating a new element each time means overlapping sounds don't cut each other off.
    // The .catch() silently swallows any "autoplay blocked" errors from the browser.
    playSound(soundEventType: SoundEventType): void {
        const url = SOUND_URLS[soundEventType];
        if (!url) return;
        const audio = new Audio(url);
        audio.play().catch(() => {});
    }
}
