/**
 * Calculates high/low consecutive-win probabilities for a 52-card deck.
 *
 * Rules:
 * - Cards are not returned to the deck.
 * - A same-rank draw is discarded and redrawn.
 * - High or low is chosen by the larger count of remaining cards.
 * - A tied choice uses High (the game is symmetric in that case).
 *
 * Usage:
 *   node scripts/calculate-high-low-probabilities.mjs
 *   node scripts/calculate-high-low-probabilities.mjs --trials=100000000
 */

const MAX_STREAK = 6;
const EXACT_THROUGH = 5;
const DEFAULT_TRIALS = 30_000_000;
const trialsArgument = process.argv.find((argument) => argument.startsWith("--trials="));
const trials = Number(trialsArgument?.slice("--trials=".length) ?? DEFAULT_TRIALS);

if (!Number.isInteger(trials) || trials <= 0) {
  throw new Error("--trials must be a positive integer.");
}

function stateKey(counts, currentRank, remainingWins) {
  return `${remainingWins}|${currentRank}|${counts.join("")}`;
}

function chosenRanks(counts, currentRank) {
  const higher = [];
  const lower = [];
  let highCount = 0;
  let lowCount = 0;
  for (let rank = 0; rank < 13; rank += 1) {
    if (rank > currentRank) {
      higher.push(rank);
      highCount += counts[rank];
    }
    if (rank < currentRank) {
      lower.push(rank);
      lowCount += counts[rank];
    }
  }
  return highCount >= lowCount ? higher : lower;
}

function calculateExactProbabilities() {
  const memo = new Map();

  function winProbability(counts, currentRank, remainingWins) {
    if (remainingWins === 0) return 1;
    const key = stateKey(counts, currentRank, remainingWins);
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const totalCards = counts.reduce((total, count) => total + count, 0);
    const sameRankCards = counts[currentRank];
    const targetRanks = chosenRanks(counts, currentRank);
    let result = 0;
    let tiePrefixProbability = 1;

    // Enumerate zero or more same-rank redraws, then a winning non-tie draw.
    for (let tieCount = 0; tieCount <= sameRankCards; tieCount += 1) {
      const cardsBeforeNonTieDraw = totalCards - tieCount;
      for (const nextRank of targetRanks) {
        if (counts[nextRank] === 0) continue;
        const nextCounts = counts.slice();
        nextCounts[currentRank] -= tieCount;
        nextCounts[nextRank] -= 1;
        result += tiePrefixProbability
          * (counts[nextRank] / cardsBeforeNonTieDraw)
          * winProbability(nextCounts, nextRank, remainingWins - 1);
      }
      if (tieCount < sameRankCards) {
        tiePrefixProbability *= (sameRankCards - tieCount) / cardsBeforeNonTieDraw;
      }
    }

    memo.set(key, result);
    return result;
  }

  const probabilities = {};
  for (let wins = 1; wins <= EXACT_THROUGH; wins += 1) {
    let probability = 0;
    for (let initialRank = 0; initialRank < 13; initialRank += 1) {
      const counts = Array(13).fill(4);
      counts[initialRank] -= 1;
      probability += (4 / 52) * winProbability(counts, initialRank, wins);
    }
    probabilities[wins] = probability;
  }
  return probabilities;
}

function simulateProbabilities() {
  const successes = new Uint32Array(MAX_STREAK + 1);
  let seed = 0x9e3779b9;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };

  function drawRank(counts, totalCards) {
    let cardIndex = Math.floor(random() * totalCards);
    for (let rank = 0; rank < 13; rank += 1) {
      if (cardIndex < counts[rank]) return rank;
      cardIndex -= counts[rank];
    }
    throw new Error("Unable to draw a rank.");
  }

  for (let trial = 0; trial < trials; trial += 1) {
    const counts = new Int8Array(13);
    counts.fill(4);
    let totalCards = 52;
    let currentRank = drawRank(counts, totalCards);
    counts[currentRank] -= 1;
    totalCards -= 1;

    for (let wins = 1; wins <= MAX_STREAK; wins += 1) {
      const targets = chosenRanks(counts, currentRank);
      let nextRank;
      do {
        nextRank = drawRank(counts, totalCards);
        counts[nextRank] -= 1;
        totalCards -= 1;
      } while (nextRank === currentRank);

      if (!targets.includes(nextRank)) break;
      successes[wins] += 1;
      currentRank = nextRank;
    }
  }

  return Object.fromEntries(
    Array.from({ length: MAX_STREAK }, (_, index) => [index + 1, successes[index + 1] / trials]),
  );
}

console.log("Calculating exact probabilities for 1-5 consecutive wins...");
const exact = calculateExactProbabilities();
console.log(`Simulating ${trials.toLocaleString()} games for 6 consecutive wins...`);
const simulated = simulateProbabilities();
const probabilities = Object.fromEntries(
  Array.from({ length: MAX_STREAK }, (_, index) => {
    const wins = index + 1;
    return [String(wins), Number((wins <= EXACT_THROUGH ? exact[wins] : simulated[wins]).toFixed(10))];
  }),
);

console.log(JSON.stringify({ highLow: { winProbabilityByStreak: probabilities } }, null, 2));
