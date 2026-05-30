import { type ISoundManager, SoundEventType } from "./ISound";

// Resolve asset URLs at build time so Vite can hash/bundle them correctly
const SOUND_URLS: Record<string, string> = {
    [SoundEventType.WALK]:            new URL('./freesounds123-heavy-character-walk-363348.mp3',       import.meta.url).href,
    [SoundEventType.SHOOT_ARROW]:     new URL('./djartmusic-arrow-twang_01-306041.mp3',                import.meta.url).href,
    [SoundEventType.WIN]:             new URL('./mrstokes302-you-win-sfx-mrstokes302-442128.mp3',      import.meta.url).href,
    [SoundEventType.LOSE]:            new URL('./u_l5xum8z250-losing-horn-313723.mp3',                 import.meta.url).href,
    [SoundEventType.WARNING_BAT]:     new URL('./the-vampires-monster-bat-chirping-type-2-355965.mp3', import.meta.url).href,
    [SoundEventType.WARNING_PIT]:     new URL('./dragon-studio-thud-sound-effect-405470.mp3',          import.meta.url).href,
    [SoundEventType.WARNING_WUMPUS]:  new URL('./freesound_community-monster-roar-6985.mp3',           import.meta.url).href,
};

export default class SoundManager implements ISoundManager {
    playSound(soundEventType: SoundEventType): void {
        const url = SOUND_URLS[soundEventType];
        if (!url) return;
        const audio = new Audio(url);
        // Silently ignore autoplay-policy rejections (browser blocks audio before first interaction)
        audio.play().catch(() => {});
    }
}
