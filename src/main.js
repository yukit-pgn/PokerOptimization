import payoutTable from "./config/payout-table.json";
import { RANKS, SUITS, cardId, classifyHand, optimizeDraw, validateHand } from "./lib/poker.js";
import "./styles.css";

const suitLabels = { S: "♠", H: "♥", D: "♦", C: "♣" };
const form = document.querySelector("#hand-form");
const error = document.querySelector("#form-error");
const result = document.querySelector("#result");
const button = document.querySelector("#calculate-button");
const selectedHandElement = document.querySelector("#selected-hand");
const cardTable = document.querySelector("#card-table");
let hand = [];

function labelForCard(card) {
  return card.joker ? "JOKER" : `${card.rank}${suitLabels[card.suit]}`;
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
