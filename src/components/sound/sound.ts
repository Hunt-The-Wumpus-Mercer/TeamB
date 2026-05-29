import {type ISoundManager} from "./isoundmanager"
import {SoundEventType} from "./isoundmanager"

export default class SoundManager implements ISoundManager {

    playSound(soundEventType: SoundEventType): void{
        let path = "";
        
        if(soundEventType == SoundEventType.WALK)
        {
            path = "";
        }
        else if(soundEventType == SoundEventType.SHOOT_ARROW)
        {
            path = "";
        }
        else if(soundEventType == SoundEventType.WIN)
        {
            path = "";
        }
        else if(soundEventType == SoundEventType.LOSE)
        {
            path = "";
        }
        else if(soundEventType == SoundEventType.WARNING_BAT)
        {
            path = "";
        }
        else if(soundEventType == SoundEventType.WARNING_PIT)
        {
            path = "";
        }
        else if(soundEventType == SoundEventType.WARNING_WUMPUS)
        {
            path = "";
        }

        // Only play if a matching path was found
        if (path !== "") {
            let audio = new Audio(path);
            audio.play();
        }
    }
}


















