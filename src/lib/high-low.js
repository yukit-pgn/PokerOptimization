const RANK_COUNT = 13;
const TIE_REDRAW_OUTCOMES = RANK_COUNT - 1;
const CASHOUT_THRESHOLD = 10_000;
const probabilityCache = new Map([[0, 1]]);

function winningRanks(rank) {
  const higher = Array.from({ length: RANK_COUNT - rank }, (_, index) => rank + index + 1);
  const lower = Array.from({ length: rank - 1 }, (_, index) => index + 1);
  return higher.length >= lower.length ? higher : lower;
}

/** Returns the chance of winning a fixed number of optimal high/low rounds. */
export function highLowWinProbability(rounds) {
  if (probabilityCache.has(rounds)) return probabilityCache.get(rounds);

  let probabilities = Array(RANK_COUNT + 1).fill(1);
  for (let round = 1; round <= rounds; round += 1) {
    const next = Array(RANK_COUNT + 1).fill(0);
    for (let rank = 1; rank <= RANK_COUNT; rank += 1) {
      next[rank] = winningRanks(rank).reduce(
        (total, nextRank) => total + probabilities[nextRank] / TIE_REDRAW_OUTCOMES,
        0,
      );
    }
    probabilities = next;
  }

  const probability = probabilities.slice(1).reduce((total, value) => total + value, 0) / RANK_COUNT;
  probabilityCache.set(rounds, probability);
  return probability;
}

export function effectivePayout(handType, basePayout) {
  if (basePayout <= 0 || handType === "royal_flush" || basePayout >= CASHOUT_THRESHOLD) {
    return basePayout;
  }

  const rounds = Math.ceil(Math.log2(CASHOUT_THRESHOLD / basePayout));
  const cashout = basePayout * 2 ** rounds;
  return cashout * highLowWinProbability(rounds);
}
