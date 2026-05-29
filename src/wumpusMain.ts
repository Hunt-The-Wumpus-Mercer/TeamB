
import $ from "jquery";
import "./style.css";
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
const container = $('#WumpusGameContainer');
void gameControl.init(container);

