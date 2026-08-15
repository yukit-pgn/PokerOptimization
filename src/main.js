import payoutTable from "./config/payout-table.json";
import { effectivePayout } from "./lib/high-low.js";
import { RANKS, SUITS, cardId, optimizeDraw, validateHand } from "./lib/poker.js";
import "./styles.css";

const suitLabels = { S: "♠", H: "♥", D: "♦", C: "♣" };
const form = document.querySelector("#hand-form");
const error = document.querySelector("#form-error");
const result = document.querySelector("#result");
const button = document.querySelector("#calculate-button");
const selectedHandElement = document.querySelector("#selected-hand");
const cardTable = document.querySelector("#card-table");
const resetHandButton = document.querySelector("#reset-hand");
const useHighLowCheckbox = document.querySelector("#use-high-low");
let hand = [];

function labelForCard(card) {
  return card.joker ? "JOKER" : `${card.rank}${suitLabels[card.suit]}`;
}

function renderCard(card, emphasis = "") {
  const color = card.suit === "H" || card.suit === "D" ? "red" : "black";
  return `<span class="playing-card ${card.joker ? "joker" : color} ${emphasis}">${labelForCard(card)}</span>`;
}

function renderDecisionCards(cards, keepIndices) {
  const kept = new Set(keepIndices);
  return cards.map((card, index) => {
    const keep = kept.has(index);
    return `<div class="decision-card">${renderCard(card, keep ? "keep" : "discard")}<span class="decision-label ${keep ? "keep" : "discard"}">${keep ? "保持" : "交換"}</span></div>`;
  }).join("");
}

function renderResult(hand, optimization, payoutForHand, showHighLowPayouts) {
  const { best } = optimization;
  const cards = renderDecisionCards(hand, best.keepIndices);
  const bestWinRate = (winningOutcomeCount(best.outcomeCounts, payoutForHand) / best.outcomeCount) * 100;
  const winningOutcomes = Object.entries(best.outcomeCounts)
    .filter(([handType, count]) => count > 0 && payoutForHand(handType) > 0)
    .map(([handType, count]) => {
      const probability = (count / best.outcomeCount) * 100;
      const contribution = (count / best.outcomeCount) * payoutForHand(handType);
      return `<li><strong>${roleLabel(handType)}</strong><span>${count.toLocaleString()}通り</span><span>確率 ${probability.toFixed(4)}%</span><span>期待値 ${contribution.toFixed(4)}</span></li>`;
    })
    .join("");
  const alternativeOptions = optimization.options.slice(1).map((option) => {
    const difference = option.expectedValue - best.expectedValue;
    const formattedDifference = `${difference >= 0 ? "+" : ""}${difference.toFixed(4)}`;
    const winRate = (winningOutcomeCount(option.outcomeCounts, payoutForHand) / option.outcomeCount) * 100;
    return `
      <article class="alternative-option">
        <div class="recommendation alternative-cards">${renderDecisionCards(hand, option.keepIndices)}</div>
        <p>期待値 <strong>${option.expectedValue.toFixed(4)}</strong> <span class="difference">(${formattedDifference})</span>　成功率 <strong>${winRate.toFixed(4)}%</strong></p>
      </article>
    `;
  }).join("");
  const highLowPayouts = Object.entries(payoutTable.payouts)
    .filter(([, basePayout]) => basePayout > 0)
    .map(([handType, basePayout]) => `
      <div><dt>${roleLabel(handType)}</dt><dd>${highLowPayoutForHand(handType).toFixed(4)}${handType === "royal_flush" ? " <small>（ハイ＆ローなし）</small>" : ""}</dd>
    </div>
    `)
    .join("");
  const highLowPayoutSection = showHighLowPayouts ? `
    <section class="high-low-payouts">
      <h2>ハイ＆ロー後の役別賞金期待値</h2>
      <dl>${highLowPayouts}</dl>
    </section>
  ` : "";

  result.innerHTML = `
    <section class="optimal-result">
      <h2>最適な交換</h2>
      <div class="recommendation">${cards}</div>
      <dl class="summary">
        <div><dt>期待値</dt><dd>${best.expectedValue.toFixed(4)}</dd></div>
        <div><dt>成功率</dt><dd>${bestWinRate.toFixed(4)}%</dd></div>
        <div><dt>抽選通り数</dt><dd>${best.outcomeCount.toLocaleString()}通り</dd></div>
      </dl>
      ${winningOutcomes ? `<details><summary>賞金が発生する役の内訳</summary><ul class="outcome-list">${winningOutcomes}</ul></details>` : ""}
      <details class="alternatives"><summary>ほかの交換パターンの期待値を確認</summary><div class="alternative-options">${alternativeOptions}</div></details>
    </section>
    ${highLowPayoutSection}
  `;
  result.hidden = false;
}

function roleLabel(handType) {
  return {
    five_of_a_kind: "ファイブカード",
    royal_flush: "ロイヤルストレートフラッシュ",
    straight_flush: "ストレートフラッシュ",
    four_of_a_kind: "フォーカード",
    full_house: "フルハウス",
    flush: "フラッシュ",
    straight: "ストレート",
    three_of_a_kind: "スリーカード",
    two_pair: "ツーペア",
    one_pair: "ワンペア（賞金なし）",
    no_win: "役なし",
  }[handType];
}

function winningOutcomeCount(outcomeCounts, payoutForHand) {
  return Object.entries(outcomeCounts).reduce(
    (total, [handType, count]) => total + (payoutForHand(handType) > 0 ? count : 0),
    0,
  );
}

function basePayoutForHand(handType) {
  return payoutTable.payouts[handType] ?? 0;
}

function highLowPayoutForHand(handType) {
  return effectivePayout(
    handType,
    payoutTable.payouts[handType] ?? 0,
    payoutTable.highLow.winProbabilityByStreak,
  );
}

function renderSelection() {
  selectedHandElement.innerHTML = "";
  if (hand.length === 0) {
    selectedHandElement.innerHTML = '<p class="empty-hand">まだカードが選ばれていません。</p>';
  } else {
    hand.forEach((card) => {
      const item = document.createElement("div");
      item.className = "selected-card";
      item.innerHTML = `${renderCard(card)}<button type="button" class="remove-card" aria-label="${labelForCard(card)}を手札から外す">×</button>`;
      item.querySelector("button").addEventListener("click", () => {
        hand = hand.filter((itemCard) => cardId(itemCard) !== cardId(card));
        error.textContent = "";
        result.hidden = true;
        renderSelection();
        renderCardTable();
      });
      selectedHandElement.append(item);
    });
  }
  resetHandButton.disabled = hand.length === 0;
}

function addToHand(card) {
  if (hand.length === 5) {
    error.textContent = "手札は5枚までです。カード右上の×で外してから選択してください。";
    return;
  }
  if (hand.some((item) => cardId(item) === cardId(card))) return;
  hand = [...hand, card];
  error.textContent = "";
  result.hidden = true;
  renderSelection();
  renderCardTable();
}

function renderCardTable() {
  cardTable.innerHTML = "";
  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      const card = { rank, suit };
      const cardButton = document.createElement("button");
      cardButton.type = "button";
      cardButton.className = `table-card ${suit === "H" || suit === "D" ? "red" : "black"}`;
      cardButton.textContent = labelForCard(card);
      cardButton.title = labelForCard(card);
      cardButton.disabled = hand.length === 5 || hand.some((item) => cardId(item) === cardId(card));
      cardButton.addEventListener("click", () => addToHand(card));
      cardTable.append(cardButton);
    });
  });

  const joker = { joker: true };
  const jokerCardButton = document.createElement("button");
  jokerCardButton.type = "button";
  jokerCardButton.className = "table-card joker-button";
  jokerCardButton.textContent = "JOKER";
  jokerCardButton.disabled = hand.length === 5 || hand.some((item) => item.joker);
  jokerCardButton.addEventListener("click", () => addToHand(joker));
  cardTable.append(jokerCardButton);
}

renderSelection();
renderCardTable();

resetHandButton.addEventListener("click", () => {
  hand = [];
  error.textContent = "";
  result.hidden = true;
  renderSelection();
  renderCardTable();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  error.textContent = "";
  result.hidden = true;
  if (hand.length !== 5) {
    error.textContent = "手札を5枚選んでください。";
    return;
  }
  try {
    validateHand(hand);
  } catch (validationError) {
    error.textContent = validationError.message === "Only one joker is available."
      ? "ジョーカーは1枚だけ選べます。"
      : "同じカードは重複して選べません。";
    return;
  }

  button.disabled = true;
  button.textContent = "計算中…";
  const useHighLow = useHighLowCheckbox.checked;
  const payoutForHand = useHighLow ? highLowPayoutForHand : basePayoutForHand;
  // Let the loading label paint before the exhaustive calculation starts.
  window.setTimeout(() => {
    try {
      renderResult(hand, optimizeDraw(hand, payoutTable.payouts, payoutForHand), payoutForHand, useHighLow);
    } finally {
      button.disabled = false;
      button.textContent = "最適な交換を計算";
    }
  }, 0);
});
