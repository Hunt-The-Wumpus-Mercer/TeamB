// This is what will get returned when a caller calls showColorPIcker
export type ColorPickerResult = {
    selected_color: string;
};

// define the different color picker tile sizes
export const ColorPickerTileSize = {
    SMALL: 'small',
    LARGE: 'large'
};
// this lets us use ColorPickerTileSize as a variable type
export type ColorPickerTileSize = (typeof ColorPickerTileSize)[keyof typeof ColorPickerTileSize];

// define the interface for our color picker
export interface IColorPicker {

    /**
     * This initializes the color picker. It should be called only once
     * @param $container the ui container into which we should draw the color picker
     */
    init($container: JQuery): void;

    /**
     * This will cause the color picker to display in the container. When the user has selected
     * a color tile, the method will return with their selected color.
     * @param numColorsToShow the number of color tiles that the picker will display
     * @param tileSize how large the tiles should be 
     */
    showColorPicker(numColorsToShow: number, tileSize: ColorPickerTileSize): Promise<ColorPickerResult>;
}