/** Core evaluator and one-draw optimizer for 53-card Joker Poker. */

export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
export const SUITS = ["S", "H", "D", "C"];

export const HAND_TYPES = [
  "five_of_a_kind",
  "royal_flush",
  "straight_flush",
  "four_of_a_kind",
  "full_house",
  "flush",
  "straight",
  "three_of_a_kind",
  "two_pair",
  "one_pair",
  "no_win",
];

const HAND_STRENGTH = new Map(HAND_TYPES.map((handType, index) => [handType, HAND_TYPES.length - index]));
const RANK_VALUES = new Map(RANKS.map((rank, index) => [rank, index + 2]));
const STRAIGHT_SETS = [
  new Set([2, 3, 4, 5, 14]),
  ...Array.from({ length: 9 }, (_, index) => new Set(Array.from({ length: 5 }, (_, offset) => index + offset + 2))),
];
const ROYAL_SET = new Set([10, 11, 12, 13, 14]);

export function createDeck() {
  return [
    ...SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit }))),
    { joker: true },
  ];
}

export function cardId(card) {
  return card.joker ? "JOKER" : `${card.rank}${card.suit}`;
}

function isStandardCard(card) {
  return card && !card.joker && RANK_VALUES.has(card.rank) && SUITS.includes(card.suit);
}

export function validateHand(hand) {
  if (!Array.isArray(hand) || hand.length !== 5) {
    throw new Error("A hand must contain exactly five cards.");
  }

  const ids = new Set();
  let jokerCount = 0;
  for (const card of hand) {
    if (card?.joker) jokerCount += 1;
    else if (!isStandardCard(card)) throw new Error("Each card must be a valid standard card or the joker.");

    const id = cardId(card);
    if (ids.has(id)) throw new Error(`Duplicate card: ${id}`);
    ids.add(id);
  }
  if (jokerCount > 1) throw new Error("Only one joker is available.");
}

function classifyStandardHand(cards) {
  const values = cards.map((card) => RANK_VALUES.get(card.rank)).sort((a, b) => a - b);
  const rankCounts = new Map();
  for (const value of values) rankCounts.set(value, (rankCounts.get(value) ?? 0) + 1);
  const counts = [...rankCounts.values()].sort((a, b) => b - a);
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const uniqueValues = [...rankCounts.keys()].sort((a, b) => a - b);
  const straight = uniqueValues.length === 5 &&
    (uniqueValues[4] - uniqueValues[0] === 4 || uniqueValues.join(",") === "2,3,4,5,14");
  const royal = flush && uniqueValues.join(",") === "10,11,12,13,14";

  if (counts[0] === 5) return "five_of_a_kind";
  if (royal) return "royal_flush";
  if (straight && flush) return "straight_flush";
  if (counts[0] === 4) return "four_of_a_kind";
  if (counts[0] === 3 && counts[1] === 2) return "full_house";
  if (flush) return "flush";
  if (straight) return "straight";
  if (counts[0] === 3) return "three_of_a_kind";
  if (counts[0] === 2 && counts[1] === 2) return "two_pair";
  if (counts[0] === 2) return "one_pair";
  return "no_win";
}

function canCompleteStraight(values) {
  return values.size === 4 && STRAIGHT_SETS.some((straight) => [...values].every((value) => straight.has(value)));
}

/** Finds the strongest role the joker can complete, including five of a kind. */
function classifyHandUnchecked(hand) {
  const jokerIndex = hand.findIndex((card) => card.joker);
  if (jokerIndex === -1) return classifyStandardHand(hand);

  const standardCards = hand.filter((card) => !card.joker);
  const rankCounts = new Map();
  for (const card of standardCards) {
    const value = RANK_VALUES.get(card.rank);
    rankCounts.set(value, (rankCounts.get(value) ?? 0) + 1);
  }
  const counts = [...rankCounts.values()].sort((a, b) => b - a);
  const values = new Set(rankCounts.keys());
  const sameSuit = standardCards.every((card) => card.suit === standardCards[0].suit);
  const completesRoyal = sameSuit && [...values].every((value) => ROYAL_SET.has(value));
  const completesStraight = canCompleteStraight(values);

  if (counts[0] === 4) return "five_of_a_kind";
  if (completesRoyal) return "royal_flush";
  if (sameSuit && completesStraight) return "straight_flush";
  if (counts[0] === 3) return "four_of_a_kind";
  if ((counts[0] === 3 && counts[1] === 1) || (counts[0] === 2 && counts[1] === 2)) return "full_house";
  if (sameSuit) return "flush";
  if (completesStraight) return "straight";
  if (counts[0] === 2) return "three_of_a_kind";
  return "one_pair";
}

export function classifyHand(hand) {
  validateHand(hand);
  return classifyHandUnchecked(hand);
}

export function evaluateHand(hand, payouts) {
  const handType = classifyHand(hand);
  return { handType, payout: payouts[handType] ?? 0 };
}

function* combinations(cards, size, start = 0, selected = []) {
  if (selected.length === size) {
    yield selected;
    return;
  }
  const remaining = size - selected.length;
  for (let index = start; index <= cards.length - remaining; index += 1) {
    yield* combinations(cards, size, index + 1, [...selected, cards[index]]);
  }
}

function compareOptions(left, right) {
  const difference = right.expectedValue - left.expectedValue;
  if (Math.abs(difference) > Number.EPSILON) return difference;
  return left.drawCount - right.drawCount;
}

/**
 * Evaluates every possible keep/discard decision for a single draw.
 * Discarded cards are excluded from the draw deck, so all draws use the 48
 * cards not in the original hand.
 */
export function optimizeDraw(hand, payouts, payoutForHand = (handType) => payouts[handType] ?? 0) {
  validateHand(hand);
  const dealtIds = new Set(hand.map(cardId));
  const drawDeck = createDeck().filter((card) => !dealtIds.has(cardId(card)));
  const options = [];

  for (let mask = 0; mask < 2 ** hand.length; mask += 1) {
    const keepIndices = hand.flatMap((_, index) => (mask & (1 << index) ? [index] : []));
    const discardIndices = hand.flatMap((_, index) => (mask & (1 << index) ? [] : [index]));
    const keptCards = keepIndices.map((index) => hand[index]);
    const outcomeCounts = Object.fromEntries(HAND_TYPES.map((handType) => [handType, 0]));
    let totalPayout = 0;
    let outcomeCount = 0;

    for (const drawnCards of combinations(drawDeck, discardIndices.length)) {
      const handType = classifyHandUnchecked([...keptCards, ...drawnCards]);
      totalPayout += payoutForHand(handType);
      outcomeCounts[handType] += 1;
      outcomeCount += 1;
    }

    options.push({
      keepIndices,
      discardIndices,
      keptCards,
      discardedCards: discardIndices.map((index) => hand[index]),
      drawCount: discardIndices.length,
      outcomeCount,
      totalPayout,
      expectedValue: totalPayout / outcomeCount,
      outcomeCounts,
    });
  }

  options.sort(compareOptions);
  const highestExpectedValue = options[0].expectedValue;
  return {
    best: options[0],
    bestOptions: options.filter((option) => Math.abs(option.expectedValue - highestExpectedValue) <= Number.EPSILON),
    options,
  };
}
