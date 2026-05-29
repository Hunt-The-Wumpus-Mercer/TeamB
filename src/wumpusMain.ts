
import $ from "jquery";
import "./style.css";
//import { Graphics } from "./components/Graphics/Graphics";
import  GameControl  from "./components/game_control/GameControl";

const $app = $("#app");
$app.html(`
	<div>
		<h1>Hunt the Wumpus</h1>
		<div id="WumpusGameContainer"></div>
		<div id="test"></div>
	</div>
`);

const gameControl = new GameControl();

void gameControl.init("#WumpusGameContainer");

