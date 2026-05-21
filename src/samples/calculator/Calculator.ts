import type ICalculator from "./ICalculator"

export default class Calculator implements ICalculator {
    add(num1: number, num2: number) : number {
        return num1 + num2;
    }

    subtract(num1: number, num2: number) : number {
        return num1 - num2;
    }
}