const CASHOUT_THRESHOLD = 10_000;

export function effectivePayout(handType, basePayout, winProbabilityByStreak) {
  if (basePayout <= 0 || handType === "royal_flush" || basePayout >= CASHOUT_THRESHOLD) {
    return basePayout;
  }

  const rounds = Math.ceil(Math.log2(CASHOUT_THRESHOLD / basePayout));
  const cashout = basePayout * 2 ** rounds;
  const winProbability = winProbabilityByStreak[String(rounds)];
  if (typeof winProbability !== "number") {
    throw new Error(`Missing high/low probability for ${rounds} consecutive wins.`);
  }
  return cashout * winProbability;
}
