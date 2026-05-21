import { ColorPickerTileSize, type ColorPickerResult, type IColorPicker } from "./IColorPicker";
import './ColorPicker.css';
import uiTemplate from './ColorPicker.html?raw';
import $ from 'jquery';
import ColorData from './ColorData.json';

type ColorDefinition = {
    name: string,
    rgb: string
}

export class ColorPicker implements IColorPicker {

    // this stores the UI container from the app into which we will draw the ColorPicker UI
    private $container!: JQuery;

    // this stored the spot where we want to add our color tiles
    private $colorTiles!: JQuery;

    // this is what we'll call to complete the promise
    private completeThePromise?: (result: ColorPickerResult) => void;

    // this gets called to initialize the ColorPicker
    public init($container: JQuery): void {

        // save the container we've been given so we can use it in other methods
        this.$container = $container;

        // start with the picker hidden
        this.$container.hide();

        // load our html into the container
        this.$container.html(uiTemplate);

        // When a user 'clicks' on anything with the 'color-option' data-role,
        // we want to call onColorClick and provide it with the click 'event'.
        this.$container.on('click', '[data-role="color-option"]', (e) => this.onColorTileClick(e));

        // find and store the element where we'll draw our colors
        this.$colorTiles = this.$container.find('[data-slot="color-tiles"]');
    }

    public showColorPicker(numColorsToShow: number, tileSize: ColorPickerTileSize): Promise<ColorPickerResult> {
    
        const colorsToShow = this.getColorsToShow(numColorsToShow);

        // clear any color tiles that may have been added previously
        this.$colorTiles.empty();

        // for each color we want to show
        for (const color of colorsToShow) {
            const tileSizeInPixels = tileSize === ColorPickerTileSize.LARGE ? '50px' : '20px';

            // create the color tile
            const $colorTile = $('<div>', {
                class: 'color-picker-tile',
                'data-role': "color-option",
                'data-color': color.name,
                css: {
                    'background-color': color.rgb,
                    'width': tileSizeInPixels,
                    'height': tileSizeInPixels
                }
            });

            // add the color tile
            this.$colorTiles.append($colorTile);
        }

        // we're now ready to show the picker
        this.$container.show();

        // We'll now return a 'promise' to the caller, which essentially waits for the user to pick a color.
        // When the user does pick a color, we will complete the promise, and the caller will receive the result.
        return new Promise((completeThePromise) => {
            this.completeThePromise = completeThePromise;
        })
    }

    private getColorsToShow(numColorsToShow: number): Array<ColorDefinition> {
        const colorsToShow: Array<ColorDefinition> = [];

        // get the colors data from our json file
        const colors = ColorData.colors;

        // make sure that the numColorsToShow isn't too large. If it is, throw an error.
        if (numColorsToShow > colors.length) {
            throw new Error("numColorsToShow must be less than " + colors.length);
        }

        // Pick random number between 0 and colors.length for the starting color.
        // This isn't really required, just showing that it's possible to make choices about the UI.
        const startingColorIndex = Math.floor(Math.random() * colors.length);

        // for each color we've been asked to show...
        for (let i = 0; i < numColorsToShow; i++) {
            // Determine the index into our color options based on the starting index and where we are in our loop.
            // Make sure that we our index "wraps" around in case it gets too large.
            const index = (startingColorIndex + i) % colors.length;
            const color = colors[index];
            colorsToShow.push(color);
        }
        return colorsToShow;
    }

    // This gets called when the user taps on a color tile
    private onColorTileClick(e: JQuery.ClickEvent): void {
        // get the 'target' of the event (in this case, the button that was pressed)
        const $btn = $(e.currentTarget);

        // get the color from the button (from the data-color attribute)
        const color = $btn.data('color');

        // now that the user has selected a color, we can hide the color picker
        this.$container.hide();

        // and finally, we call our done method with the selected color, which will complete the promise
        this.done({ selected_color: color })
    }

    private done(result: ColorPickerResult): void {
        // if we still have a promise to complete, then complete it with the result
        if (this.completeThePromise) {
            this.completeThePromise(result);

            // we will now set the completeThePromise to undefined so we don't try calling it again
            this.completeThePromise = undefined;
        }
    }
}