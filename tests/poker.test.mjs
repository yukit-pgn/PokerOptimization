import assert from "node:assert/strict";
import payoutTable from "../src/config/payout-table.json" with { type: "json" };
import { effectivePayout } from "../src/lib/high-low.js";
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

assert.equal(
  effectivePayout("four_of_a_kind", 200, payoutTable.highLow.winProbabilityByStreak),
  12800 * payoutTable.highLow.winProbabilityByStreak["6"],
);
assert.equal(effectivePayout("royal_flush", 200, payoutTable.highLow.winProbabilityByStreak), 200);

console.log("poker tests passed");
