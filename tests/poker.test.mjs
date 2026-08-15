import assert from "node:assert/strict";
import { classifyHand, optimizeDraw } from "../src/lib/poker.js";

const payouts = {
  five_of_a_kind: 140,
  royal_flush: 200,
  straight_flush: 60,
  four_of_a_kind: 30,
  full_house: 16,
  flush: 14,
  straight: 8,
  three_of_a_kind: 4,
  two_pair: 4,
};
const card = (rank, suit) => ({ rank, suit });
const joker = { joker: true };

assert.equal(classifyHand([card("A", "S"), card("A", "H"), card("A", "D"), card("A", "C"), joker]), "five_of_a_kind");
assert.equal(classifyHand([card("10", "S"), card("J", "S"), card("Q", "S"), card("K", "S"), joker]), "royal_flush");
assert.equal(classifyHand([card("2", "S"), card("2", "H"), card("7", "D"), card("9", "C"), card("K", "S")]), "one_pair");

const madeFiveKind = [card("A", "S"), card("A", "H"), card("A", "D"), card("A", "C"), joker];
const result = optimizeDraw(madeFiveKind, payouts);
assert.deepEqual(result.best.keepIndices, [0, 1, 2, 3, 4]);
assert.equal(result.best.expectedValue, 140);
assert.equal(result.best.outcomeCount, 1);

console.log("poker tests passed");
