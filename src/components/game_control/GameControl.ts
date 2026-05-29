import type { IGameControl } from "./IGameControl"
import type {CaveRoomDirections} from "../shared/CaveRoomDirections"

export default class GameControl implements IGameControl {
    // this stores the UI container 
     private $container!: JQuery;
       
    public init($container: JQuery): void {

        // save the container we've been given so we can use it in other methods
        this.$container = $container;
        console.log("sweet");
        

        var test = this.$container.find("test");
        console.log("test is");
        console.log(test);
        test.html("blah!");
    }
    



    movePlayer(caveRoomDirection: CaveRoomDirections):void {

    }
    
    shootArrow(caveRoomDirection: CaveRoomDirections):void {

    }
    
    purchaseArrow():void {

    }

    purchaseSecret():void {

    }
    
    viewHighScores():void {

    }
    
    
}