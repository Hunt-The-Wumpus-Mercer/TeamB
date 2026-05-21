# Hunt the Wumpus

Welcome! In this project you'll build the classic "Hunt the Wumpus" game using TypeScript.

## Getting Started

1. Your Codespace will automatically install everything you need
2. Click the **Run and Debug** icon in the left sidebar (or press `Ctrl+Shift+D` or `Command+Shift+D`)
3. Click the green **Play** button at the top to start the dev server and open your game in the browser

Have fun coding!!

## TypeScript Samples

There are a couple of samples provided to help you understand how to get started with TypeScript:
- `src/samples/calculator` - incomplete project showing how to define an interface in one file (ICalculator.ts) and implement it in a class (Calculator.ts).
- `src/samples/colorPicker` - runnable project showing how to build a user interface for the web and react to what a user clicks on, returning results via a "Promise".  This is the default project that will be run when you first click the **Play** button.  Follow the instructions below to switch this from the colorPicker to the (currently empty) Wumpus user interface instead.

## Your Wumpus project

Put code for each of your objects into the `src/components` folder.  You can reference your objects from `wumpusMain.ts` to get your code running.

## Switching Between Wumpus and ColorPicker

By default, the project runs the ColorPicker sample. To run the Wumpus game instead:

1. Open `index.html`.
2. Comment out the ColorPicker script tag:
	```html
	<!-- <script type="module" src="/src/colorPickerMain.ts"></script> -->
	```
3. Uncomment the Wumpus script tag:
	```html
	<script type="module" src="/src/wumpusMain.ts"></script>
	```
4. Save and reload the page.

## Sample Wumpus Interfaces

Sample interfaces for the Wumpus project are provided in the `src/samples/wumpus_interfaces` folder. If you need a starting point or get stuck, it's perfectly fine to copy these interfaces into your own project files to save time or help you move forward.  You are not required to use anything from the `wumpus_interfaces` folder; you are welcome to ignore or change the interfaces as you desire.

## Team Roles
* TBD: list team members and their objects here