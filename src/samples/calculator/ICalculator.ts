export default interface ICalculator {

    /**
     * Adds two numbers together
     * @param num1 The first number.
     * @param num2 The second number.
     * @returns The total sum.
     */
    add(num1: number, num2: number) : number;

    /**
     * Subtracts one number from another number
     * @param num1 The number being subtracted from.
     * @param num2 The amount to subtract.
     * @returns The difference between the numbers.
     */
    subtract(num1: number, num2: number) : number;
}