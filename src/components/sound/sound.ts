import {type ISoundManager} from "./isoundmanager"
import {SoundEventType} from "./isoundmanager"

export default class SoundManager implements ISoundManager {

    playSound(soundEventType: SoundEventType): void{
        let path = "";
        
        if(soundEventType == SoundEventType.WALK)
        {
            path = "sound/u_3x9ga8wevj-walking-sound-effect-272246.mp3";
        }
        else if(soundEventType == SoundEventType.SHOOT_ARROW)
        {
            path = "src/components/sound/djartmusic-arrow-swish_03-306040.mp3";
        }
        else if(soundEventType == SoundEventType.WIN)
        {
            path = "src/components/sound/mrstokes302-you-win-sfx-mrstokes302-442128.mp3";
        }
        else if(soundEventType == SoundEventType.LOSE)
        {
            path = "src/components/sound/mrstokes302-you-lose-sfx-mrstokes302-528744.mp3";
        }
        else if(soundEventType == SoundEventType.WARNING_BAT)
        {
            path = "src/components/sound/dragon-studio-bird-wings-463212.mp3";
        }
        else if(soundEventType == SoundEventType.WARNING_PIT)
        {
            path = "src/components/sound/dragon-studio-droplets-in-a-cave-482871.mp3";
        }
        else if(soundEventType == SoundEventType.WARNING_WUMPUS)
        {
            path = "src/components/sound/dragon-studio-monster-growl-376892.mp3";
        }

        // Only play if a matching path was found
        if (path !== "") {
            let audio = new Audio(path);
            audio.play();
        }
    }
}


















