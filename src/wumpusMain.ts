// Entry point for the game.
// Finds the <div id="app"> element in index.html, creates the main game
// controller, and kicks off initialisation.
import GameControl from "./components/game_control/GameControl";

const app = document.getElementById("app")!;
const game = new GameControl();
void game.init(app);
