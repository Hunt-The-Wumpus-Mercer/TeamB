import GameControl from "./components/game_control/GameControl";

const app = document.getElementById("app")!;
const game = new GameControl();
void game.init(app);
