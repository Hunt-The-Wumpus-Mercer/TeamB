
import $ from "jquery";
import "./style.css";
import { ColorPickerTileSize, type IColorPicker } from "./samples/colorPicker/IColorPicker";
import { ColorPicker } from "./samples/colorPicker/ColorPicker";

const $app = $("#app");
$app.html(`
	<div>
		<h1>Color Picker Sample</h1>

		Selected Color: <span data-role="selected_color"></span>
		<div>
			<button data-action="open_color_picker">Open Color Picker</button>
		</div>
		<div id="ColorPickerContainer"></div>
	</div>
`);

const colorPicker: IColorPicker = new ColorPicker();
const colorPickerContainer = $('#ColorPickerContainer');
colorPicker.init(colorPickerContainer);

const $colorPickerButton = $app.find('[data-action="open_color_picker"]');
const $selectedColorText = $app.find('[data-role="selected_color"]');
const savedSelectedColor = localStorage.getItem('selectedColor') ?? 'Not yet selected';
$selectedColorText.text(savedSelectedColor);

$colorPickerButton.on('click', async () => {
	$colorPickerButton.hide();
	const colorResult = await colorPicker.showColorPicker(5, ColorPickerTileSize.LARGE);
	const newSelectedColor = colorResult.selected_color;
	localStorage.setItem('selectedColor', newSelectedColor)
	$selectedColorText.text(newSelectedColor);
	$colorPickerButton.show();
});
