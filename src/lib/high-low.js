const CASHOUT_THRESHOLD = 10_000;

export function effectivePayout(handType, basePayout, winProbabilityByStreak, maximumPayout = null) {
  if (basePayout <= 0 || (maximumPayout !== null && basePayout >= maximumPayout)) {
    return 0;
  }
  if (handType === "royal_flush" || basePayout >= CASHOUT_THRESHOLD) {
    return basePayout;
  }

  let rounds = 0;
  let cashout = basePayout;
  while (
    cashout < CASHOUT_THRESHOLD
    && (maximumPayout === null || cashout * 2 < maximumPayout)
  ) {
    cashout *= 2;
    rounds += 1;
  }
  if (rounds === 0) return cashout;

  const winProbability = winProbabilityByStreak[String(rounds)];
  if (typeof winProbability !== "number") {
    throw new Error(`Missing high/low probability for ${rounds} consecutive wins.`);
  }
  return cashout * winProbability;
}
