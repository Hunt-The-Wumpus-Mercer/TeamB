import {type ISoundManager} from "./isoundmanager"
import {SoundEventType} from "./isoundmanager"

export default class SoundManager implements ISoundManager {

    playSound(soundEventType: SoundEventType): void{
        let path = "";
        
        if(soundEventType == SoundEventType.WALK)
        {
            path = "src/components/sound/freesounds123-heavy-character-walk-363348.mp3";
        }
        else if(soundEventType == SoundEventType.SHOOT_ARROW)
        {
            path = "src/components/sound/djartmusic-arrow-twang_01-306041.mp3";
        }
        else if(soundEventType == SoundEventType.WIN)
        {
            path = "src/components/sound/mrstokes302-you-win-sfx-mrstokes302-442128.mp3";
        }
        else if(soundEventType == SoundEventType.LOSE)
        {
            path = "";
        }
        else if(soundEventType == SoundEventType.WARNING_BAT)
        {
            path = "src/components/sound/the-vampires-monster-bat-chirping-type-2-355965.mp3";
        }
        else if(soundEventType == SoundEventType.WARNING_PIT)
        {
            path = "";
        }
        else if(soundEventType == SoundEventType.WARNING_WUMPUS)
        {
            path = "src/components/sound/freesound_community-monster-roar-6985.mp3";
        }

        // Only play if a matching path was found
        if (path !== "") {
            let audio = new Audio(path);
            audio.play();
        }
    }
}


















