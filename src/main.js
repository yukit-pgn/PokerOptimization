import payoutTable from "./config/payout-table.json";
import { RANKS, SUITS, cardId, classifyHand, optimizeDraw, validateHand } from "./lib/poker.js";
import "./styles.css";

const initialHand = [
  { rank: "A", suit: "S" },
  { rank: "K", suit: "S" },
  { rank: "Q", suit: "S" },
  { rank: "J", suit: "S" },
  { joker: true },
];

const suitLabels = { S: "♠", H: "♥", D: "♦", C: "♣" };
const cardInputs = document.querySelector("#card-inputs");
const form = document.querySelector("#hand-form");
const error = document.querySelector("#form-error");
const result = document.querySelector("#result");
const button = document.querySelector("#calculate-button");

function cardOptions() {
  const standardCards = SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));
  return [{ joker: true }, ...standardCards];
}

function labelForCard(card) {
  return card.joker ? "JOKER" : `${card.rank}${suitLabels[card.suit]}`;
}

function createSelect(index, selectedCard) {
  const label = document.createElement("label");
  label.className = "card-select";
  label.innerHTML = `<span>カード ${index + 1}</span>`;
  const select = document.createElement("select");
  select.name = `card-${index}`;
  select.dataset.index = String(index);

  for (const card of cardOptions()) {
    const option = document.createElement("option");
    option.value = cardId(card);
    option.textContent = labelForCard(card);
    option.selected = option.value === cardId(selectedCard);
    select.append(option);
  }
  label.append(select);
  return label;
}

function parseCard(value) {
  if (value === "JOKER") return { joker: true };
  return { rank: value.slice(0, -1), suit: value.slice(-1) };
}

function selectedHand() {
  return [...document.querySelectorAll(".card-select select")].map((select) => parseCard(select.value));
}

function renderCard(card, emphasis = "") {
  const color = card.suit === "H" || card.suit === "D" ? "red" : "black";
  return `<span class="playing-card ${card.joker ? "joker" : color} ${emphasis}">${labelForCard(card)}</span>`;
}

function renderResult(hand, optimization) {
  const { best } = optimization;
  const currentRole = classifyHand(hand);
  const kept = new Set(best.keepIndices);
  const cards = hand.map((card, index) => renderCard(card, kept.has(index) ? "keep" : "discard")).join("");
  const keptText = best.keptCards.length ? best.keptCards.map((card) => labelForCard(card)).join("、") : "なし";
  const discardedText = best.discardedCards.length ? best.discardedCards.map((card) => labelForCard(card)).join("、") : "なし（交換しない）";
  const winningOutcomes = Object.entries(best.outcomeCounts)
    .filter(([handType, count]) => count > 0 && (payoutTable.payouts[handType] ?? 0) > 0)
    .map(([handType, count]) => `<li>${roleLabel(handType)}: ${count.toLocaleString()}通り</li>`)
    .join("");

  result.innerHTML = `
    <h2>最適な交換</h2>
    <div class="recommendation">${cards}</div>
    <p class="legend"><span class="keep-dot"></span>保持　<span class="discard-dot"></span>交換</p>
    <dl class="summary">
      <div><dt>現在の役</dt><dd>${roleLabel(currentRole)}</dd></div>
      <div><dt>保持するカード</dt><dd>${keptText}</dd></div>
      <div><dt>交換するカード</dt><dd>${discardedText}</dd></div>
      <div><dt>期待値</dt><dd>${best.expectedValue.toFixed(4)} 倍</dd></div>
      <div><dt>抽選通り数</dt><dd>${best.outcomeCount.toLocaleString()}通り</dd></div>
    </dl>
    ${winningOutcomes ? `<details><summary>賞金が発生する役の通り数</summary><ul>${winningOutcomes}</ul></details>` : ""}
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

cardInputs.append(...initialHand.map(createSelect));

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const hand = selectedHand();
  error.textContent = "";
  result.hidden = true;
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
  // Let the loading label paint before the exhaustive calculation starts.
  window.setTimeout(() => {
    try {
      renderResult(hand, optimizeDraw(hand, payoutTable.payouts));
    } finally {
      button.disabled = false;
      button.textContent = "最適な交換を計算";
    }
  }, 0);
});
