import {beforeEach, expect, test} from 'vitest'
import type ICalculator from './ICalculator'
import Calculator from './Calculator'

// this variable will hold the calculator object that we will be testing
let calculator : ICalculator;

// Any code inside beforeEach will run before each of the tests.
// We will use it to CREATE an instance of our calculator implementation that we will 
// be testing and store it in our calculator variable so that it's available in 
// each of our tests
beforeEach(() => {
    calculator = new Calculator();
})

test('add 2 positive numbers', () => {
    const result = calculator.add(1, 2);
    expect(result).toBe(3);
})

test('add a negative number with a positive number', () => {
    const result = calculator.add(-4, 5);
    expect(result).toBe(1);
})

test('add 2 negative numbers', () => {
    const result = calculator.add(-4, -5);
    expect(result).toBe(-9);
})

test('subtract 2 positive numbers, the first larger than the second', () => {
    const result = calculator.subtract(10, 5);
    expect(result).toBe(5);
})

test('subtract 2 positive numbers, the first smaller than the second', () => {
    const result = calculator.subtract(4, 6);
    expect(result).toBe(-2);
})

test('subtract 2 negative numbers', () => {
    const result = calculator.subtract(-4, -5);
    expect(result).toBe(1);
})