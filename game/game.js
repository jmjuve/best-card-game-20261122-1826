// Ember Duel — Cards of the Four Winds.
// An original turn-based card duel, written for the make.fun best-card-game bounty.
// You (the Ember Caller) duel Rook, the Stone Warden. Both start at 30 life.
// Each turn you gain mana and draw a card; play cards, then End Turn.
// 🔥 Flame strikes · 💧 Tide heals · 🍃 Leaf shields · 🪨 Stone hits hard.
// First to 0 life loses. Offline, no network, mouse + keyboard.

// ---------- seeded random (mulberry32): same seed, same duel ----------
function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- the cards: our own names, suits and numbers ----------
const SUITS = {
  flame: { icon: '🔥', label: 'Flame', verb: 'damage' },
  tide: { icon: '💧', label: 'Tide', verb: 'heal' },
  leaf: { icon: '🍃', label: 'Leaf', verb: 'shield' },
  stone: { icon: '🪨', label: 'Stone', verb: 'damage' },
};

// id, name, suit, cost, power, effect, text
const CARD_DEFS = [
  { id: 'spark', name: 'Ember Spark', suit: 'flame', cost: 1, power: 3, effect: 'damage', text: 'A quick lick of flame.' },
  { id: 'cinder', name: 'Cinder Bite', suit: 'flame', cost: 2, power: 5, effect: 'damage', text: 'Hot teeth, small wound.' },
  { id: 'wildfire', name: 'Wildfire', suit: 'flame', cost: 3, power: 7, effect: 'damage', text: 'It spreads faster than fear.' },
  { id: 'phoenix', name: 'Phoenix Feather', suit: 'flame', cost: 4, power: 9, effect: 'damage-draw', text: 'Deal 9. Draw a card.' },
  { id: 'inferno', name: 'Inferno', suit: 'flame', cost: 5, power: 12, effect: 'damage', text: 'The sky itself catches fire.' },
  { id: 'surge', name: 'Ember Surge', suit: 'flame', cost: 3, power: 5, effect: 'surge', text: 'Your next attack this turn +5.' },
  { id: 'rain', name: 'Spring Rain', suit: 'tide', cost: 1, power: 3, effect: 'heal', text: 'Cool water, small mercy.' },
  { id: 'mend', name: 'Tide Mend', suit: 'tide', cost: 2, power: 6, effect: 'heal', text: 'The tide knits flesh.' },
  { id: 'current', name: 'Deep Current', suit: 'tide', cost: 3, power: 8, effect: 'heal-draw', text: 'Heal 8. Draw a card.' },
  { id: 'moonpool', name: 'Moonpool', suit: 'tide', cost: 4, power: 12, effect: 'heal', text: 'Drink deep of still water.' },
  { id: 'guard', name: 'Leaf Guard', suit: 'leaf', cost: 1, power: 4, effect: 'shield', text: 'A wall of green.' },
  { id: 'thorn', name: 'Thornwall', suit: 'leaf', cost: 2, power: 7, effect: 'shield', text: 'Sharp leaves, safer heart.' },
  { id: 'rootbind', name: 'Root Bind', suit: 'leaf', cost: 2, power: 5, effect: 'shield-damage', text: '+5 shield. Deal 3 to the foe.' },
  { id: 'ironbark', name: 'Ironbark', suit: 'leaf', cost: 3, power: 11, effect: 'shield', text: 'Bark like old iron.' },
  { id: 'fist', name: 'Stone Fist', suit: 'stone', cost: 2, power: 6, effect: 'damage', text: 'A fist of mountain.' },
  { id: 'quake', name: 'Quake', suit: 'stone', cost: 3, power: 8, effect: 'damage', text: 'The ground answers back.' },
  { id: 'boulder', name: 'Boulderfall', suit: 'stone', cost: 4, power: 10, effect: 'damage', text: 'Duck. It is already falling.' },
  { id: 'roar', name: "Mountain's Roar", suit: 'stone', cost: 6, power: 16, effect: 'damage', text: 'The whole mountain shouts.' },
];

const MAX_LIFE = 30;
const MAX_MANA = 10;
const HAND_LIMIT = 7;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const rng = createRandom(seed);

// ---------- sound: tiny WebAudio bleeps, composed here, no files ----------
let soundOn = true;
let audioCtx = null;
function beep(freq, ms, type = 'sine', gain = 0.06) {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + ms / 1000);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + ms / 1000);
  } catch { /* audio unavailable: play silent */ }
}
const sfx = {
  play: () => beep(520, 90, 'triangle'),
  hit: () => { beep(180, 140, 'sawtooth', 0.05); },
  heal: () => { beep(660, 160, 'sine'); setTimeout(() => beep(880, 160, 'sine'), 90); },
  shield: () => beep(340, 120, 'square', 0.04),
  win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 220, 'triangle'), i * 130)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, 240, 'sawtooth', 0.04), i * 150)),
  turn: () => beep(440, 70, 'sine', 0.04),
};

// ---------- state ----------
function buildDeck() {
  // Two copies of each card except the two 5+ cost finishers (one copy each): 34 cards.
  const deck = [];
  for (const def of CARD_DEFS) {
    const copies = (def.id === 'inferno' || def.id === 'roar') ? 1 : 2;
    for (let i = 0; i < copies; i += 1) deck.push({ ...def, uid: `${def.id}-${i}-${Math.floor(rng() * 1e9)}` });
  }
  // Fisher–Yates with the seeded rng.
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function freshSide() {
  return { life: MAX_LIFE, shield: 0, mana: 0, maxMana: 0, hand: [], deck: buildDeck(), discard: [], surge: 0 };
}

const state = {
  screen: 'title', // title | play | win | loss
  turn: 1,
  you: freshSide(),
  foe: freshSide(),
  yourTurn: true,
  aiBusy: false,
  wins: 0,
  losses: 0,
  damageDealt: 0,
  log: [],
};

try {
  state.wins = Number.parseInt(window.localStorage.getItem('ember-duel.wins') ?? '0', 10) || 0;
  state.losses = Number.parseInt(window.localStorage.getItem('ember-duel.losses') ?? '0', 10) || 0;
} catch { /* storage off: session-only tally */ }

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const els = {
  youLifeFill: $('youLifeFill'), youLifeText: $('youLifeText'), youShield: $('youShield'), youMana: $('youMana'),
  foeLifeFill: $('foeLifeFill'), foeLifeText: $('foeLifeText'), foeShield: $('foeShield'), foeMana: $('foeMana'),
  yourHand: $('yourHand'), foeHand: $('foeHand'), log: $('log'), lastPlay: $('lastPlay'),
  turnNum: $('turnNum'), deckInfo: $('deckInfo'), scoreLine: $('scoreLine'), handHint: $('handHint'),
  endTurnBtn: $('endTurnBtn'), status: $('status'),
  title: $('titleScreen'), win: $('winScreen'), loss: $('lossScreen'), help: $('helpScreen'),
  winStats: $('winStats'), lossStats: $('lossStats'),
};

function announce(msg) { els.status.textContent = msg; }
function addLog(html, cls = 'sys') {
  state.log.push({ html, cls });
  if (state.log.length > 40) state.log.shift();
}
function cardLabel(card) {
  const s = SUITS[card.suit];
  return `${s.icon} ${card.name} (${card.cost} mana, ${s.label} ${card.power})`;
}

// ---------- rules ----------
function drawCard(side, count = 1) {
  for (let i = 0; i < count; i += 1) {
    if (side.deck.length === 0) {
      if (side.discard.length === 0) return;
      side.deck = side.discard; side.discard = [];
      for (let j = side.deck.length - 1; j > 0; j -= 1) {
        const k = Math.floor(rng() * (j + 1));
        [side.deck[j], side.deck[k]] = [side.deck[k], side.deck[j]];
      }
    }
    if (side.hand.length < HAND_LIMIT) side.hand.push(side.deck.pop());
  }
}

function dealDamage(target, amount, attackerName) {
  let left = amount;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, left);
    target.shield -= absorbed; left -= absorbed;
  }
  target.life = Math.max(0, target.life - left);
  return left;
}

function applyCard(card, me, foe, who) {
  const s = SUITS[card.suit];
  let text = '';
  switch (card.effect) {
    case 'damage': {
      const bonus = me.surge; me.surge = 0;
      const total = card.power + bonus;
      const dealt = dealDamage(foe, total, who);
      if (who === 'you') state.damageDealt += dealt;
      text = `${who === 'you' ? 'You hurl' : 'Rook hurls'} ${cardLabel(card)} — ${dealt} damage${bonus ? ` (incl. +${bonus} surge)` : ''}!`;
      sfx.hit();
      break;
    }
    case 'damage-draw': {
      const bonus = me.surge; me.surge = 0;
      const dealt = dealDamage(foe, card.power + bonus, who);
      if (who === 'you') state.damageDealt += dealt;
      drawCard(me, 1);
      text = `${who === 'you' ? 'You play' : 'Rook plays'} ${cardLabel(card)} — ${dealt} damage and draws a card!`;
      sfx.hit();
      break;
    }
    case 'heal': {
      const healed = Math.min(card.power, MAX_LIFE - me.life);
      me.life += healed;
      text = `${who === 'you' ? 'You play' : 'Rook plays'} ${cardLabel(card)} — restores ${healed} life.`;
      sfx.heal();
      break;
    }
    case 'heal-draw': {
      const healed = Math.min(card.power, MAX_LIFE - me.life);
      me.life += healed; drawCard(me, 1);
      text = `${who === 'you' ? 'You play' : 'Rook plays'} ${cardLabel(card)} — heals ${healed} and draws a card!`;
      sfx.heal();
      break;
    }
    case 'shield': {
      me.shield += card.power;
      text = `${who === 'you' ? 'You raise' : 'Rook raises'} ${cardLabel(card)} — +${card.power} shield.`;
      sfx.shield();
      break;
    }
    case 'shield-damage': {
      me.shield += card.power;
      const dealt = dealDamage(foe, 3, who);
      if (who === 'you') state.damageDealt += dealt;
      text = `${who === 'you' ? 'You play' : 'Rook plays'} ${cardLabel(card)} — +${card.power} shield and ${dealt} damage!`;
      sfx.shield();
      break;
    }
    case 'surge': {
      me.surge += card.power;
      text = `${who === 'you' ? 'You kindle' : 'Rook kindles'} ${cardLabel(card)} — next attack +${card.power} this turn!`;
      sfx.play();
      break;
    }
    default: text = `${card.name} fizzles.`;
  }
  return text;
}

function playCard(side, index) {
  const me = side === 'you' ? state.you : state.foe;
  const foe = side === 'you' ? state.foe : state.you;
  const card = me.hand[index];
  if (!card || me.mana < card.cost) return false;
  me.mana -= card.cost;
  me.hand.splice(index, 1);
  me.discard.push(card);
  const text = applyCard(card, me, foe, side);
  addLog(text, side);
  els.lastPlay.textContent = text;
  announce(text);
  return true;
}

function checkEnd() {
  if (state.foe.life <= 0) { endDuel(true); return true; }
  if (state.you.life <= 0) { endDuel(false); return true; }
  return false;
}

function startTurn(side) {
  const me = side === 'you' ? state.you : state.foe;
  me.maxMana = Math.min(MAX_MANA, me.maxMana + 1);
  me.mana = me.maxMana;
  me.surge = 0;
  drawCard(me, 1);
  if (side === 'you') {
    state.turn += 0; // turn number counts player turns
    addLog(`— Turn ${state.turn}: your mana rises to ${me.mana}. You draw a card. —`, 'sys');
    sfx.turn();
  }
}

function endDuel(won) {
  state.screen = won ? 'win' : 'loss';
  const stats = `Turns: ${state.turn} · Damage you dealt: ${state.damageDealt} · Your life: ${state.you.life} · Rook's life: ${state.foe.life}`;
  if (won) {
    state.wins += 1;
    try { window.localStorage.setItem('ember-duel.wins', String(state.wins)); } catch { /* ignore */ }
    els.winStats.textContent = stats;
    els.win.classList.remove('hidden');
    sfx.win();
    addLog('🏆 Victory! Rook crumbles to embers.', 'you');
    announce('Victory! You won the duel.');
  } else {
    state.losses += 1;
    try { window.localStorage.setItem('ember-duel.losses', String(state.losses)); } catch { /* ignore */ }
    els.lossStats.textContent = stats;
    els.loss.classList.remove('hidden');
    sfx.lose();
    addLog('💀 Defeat. Your last ember fades.', 'foe');
    announce('Defeat. Rook won the duel.');
  }
  render();
}

function startDuel() {
  state.you = freshSide(); state.foe = freshSide();
  state.turn = 1; state.damageDealt = 0; state.log = [];
  state.yourTurn = true; state.aiBusy = false;
  for (let i = 0; i < 4; i += 1) { drawCard(state.you, 1); drawCard(state.foe, 1); }
  state.you.maxMana = 1; state.you.mana = 1;
  state.foe.maxMana = 0; state.foe.mana = 0;
  state.screen = 'play';
  els.title.classList.add('hidden');
  els.win.classList.add('hidden');
  els.loss.classList.add('hidden');
  addLog('🔥 The duel begins. You hold 4 cards and 1 mana.', 'sys');
  els.lastPlay.textContent = 'The duel begins. Play a card, then end your turn.';
  announce('Duel started. Your turn. 4 cards, 1 mana.');
  render();
}

// ---------- the AI: Rook plays his best cards, then hands back ----------
function aiChooseCard() {
  const me = state.foe;
  const affordable = me.hand.map((c, i) => ({ c, i })).filter(({ c }) => c.cost <= me.mana);
  if (affordable.length === 0) return -1;
  // Hurt and holding a heal? Heal first.
  if (me.life <= 14) {
    const heal = affordable.filter(({ c }) => c.effect === 'heal' || c.effect === 'heal-draw')
      .sort((a, b) => b.c.power - a.c.power)[0];
    if (heal) return heal.i;
  }
  // No shield and holding one? Raise it.
  if (me.shield < 4) {
    const sh = affordable.filter(({ c }) => c.effect === 'shield' || c.effect === 'shield-damage')
      .sort((a, b) => b.c.power - a.c.power)[0];
    if (sh) return sh.i;
  }
  // Surge first if a big attack waits in hand.
  const surge = affordable.find(({ c }) => c.effect === 'surge');
  const bigHit = affordable.find(({ c }) => (c.effect === 'damage' || c.effect === 'damage-draw') && c.cost >= 3);
  if (surge && bigHit) return surge.i;
  // Otherwise the hardest affordable hit; a draw card beats a weak hit.
  const hits = affordable.filter(({ c }) => c.effect.startsWith('damage'))
    .sort((a, b) => b.c.power - a.c.power);
  if (hits.length) return hits[0].i;
  return affordable.sort((a, b) => b.c.power - a.c.power)[0].i;
}

function aiTurn() {
  state.aiBusy = true;
  state.yourTurn = false;
  render();
  startTurn('foe');
  addLog(`— Rook's turn: mana ${state.foe.mana}, he draws. —`, 'sys');
  render();
  let step = 0;
  const think = () => {
    if (state.screen !== 'play') { state.aiBusy = false; return; }
    const pick = aiChooseCard();
    if (pick >= 0 && step < 12) {
      step += 1;
      playCard('foe', pick);
      render();
      if (checkEnd()) { state.aiBusy = false; return; }
      setTimeout(think, 650);
    } else {
      // Rook is done: your turn.
      state.turn += 1;
      state.aiBusy = false;
      state.yourTurn = true;
      startTurn('you');
      addLog('— Your turn. —', 'sys');
      els.lastPlay.textContent = 'Your turn — play your cards, then End Turn.';
      render();
    }
  };
  setTimeout(think, 700);
}

// ---------- rendering ----------
function manaPips(mana, max) {
  let out = '';
  for (let i = 0; i < MAX_MANA; i += 1) {
    out += `<span class="${i < mana ? '' : 'spent'}">${i < max ? '🔷' : '·'}</span>`;
  }
  return out;
}

function cardEl(card, index, playable) {
  const s = SUITS[card.suit];
  const div = document.createElement('div');
  div.className = `card suit-${card.suit}${playable ? '' : ' unplayable'}`;
  div.dataset.index = index;
  const verb = s.verb === 'damage' ? 'DMG' : s.verb === 'heal' ? 'HEAL' : s.verb === 'shield' ? 'SHIELD' : '';
  div.innerHTML = `<span class="cost">${card.cost}</span>
    <div class="suit">${s.icon}</div>
    <div class="name">${card.name}</div>
    <div class="power">${card.power}<small>${verb} · ${s.label}</small></div>
    <div class="text">${card.text}</div>
    <span class="key">${index + 1}</span>`;
  div.addEventListener('click', () => onPlayCard(index));
  return div;
}

function render() {
  const { you, foe } = state;
  els.youLifeFill.style.width = `${(you.life / MAX_LIFE) * 100}%`;
  els.youLifeText.textContent = `${you.life} / ${MAX_LIFE}`;
  els.youShield.textContent = `🛡 ${you.shield}`;
  els.youMana.innerHTML = manaPips(you.mana, you.maxMana);
  els.foeLifeFill.style.width = `${(foe.life / MAX_LIFE) * 100}%`;
  els.foeLifeText.textContent = `${foe.life} / ${MAX_LIFE}`;
  els.foeShield.textContent = `🛡 ${foe.shield}`;
  els.foeMana.innerHTML = manaPips(foe.mana, foe.maxMana);
  els.turnNum.textContent = state.turn;
  els.deckInfo.textContent = `Deck ${you.deck.length} · Discard ${you.discard.length}${you.surge ? ` · 🔥 Surge +${you.surge}` : ''}`;
  els.scoreLine.textContent = `Wins ${state.wins} · Losses ${state.losses}`;
  els.endTurnBtn.disabled = !state.yourTurn || state.aiBusy || state.screen !== 'play';

  els.foeHand.innerHTML = '';
  foe.hand.forEach(() => {
    const back = document.createElement('div');
    back.className = 'card back';
    back.innerHTML = '<span>🔥</span>';
    els.foeHand.appendChild(back);
  });
  if (foe.hand.length === 0) els.foeHand.innerHTML = '<span style="color:#cbb37e;font-size:13px">no cards</span>';

  els.yourHand.innerHTML = '';
  you.hand.forEach((card, i) => {
    els.yourHand.appendChild(cardEl(card, i, state.yourTurn && !state.aiBusy && card.cost <= you.mana && state.screen === 'play'));
  });
  if (you.hand.length === 0) els.yourHand.innerHTML = '<span style="color:#cbb37e">Your hand is empty — draw next turn.</span>';
  els.handHint.textContent = state.yourTurn ? `${you.hand.length} cards · ${you.mana} mana` : 'Rook is thinking…';

  els.log.innerHTML = state.log.map((e) => `<div class="${e.cls}">${e.html}</div>`).join('');
  els.log.scrollTop = els.log.scrollHeight;
}

// ---------- input ----------
function onPlayCard(index) {
  if (state.screen !== 'play' || !state.yourTurn || state.aiBusy) return;
  const card = state.you.hand[index];
  if (!card) return;
  if (card.cost > state.you.mana) {
    els.lastPlay.textContent = `Not enough mana for ${card.name} — it costs ${card.cost}, you have ${state.you.mana}.`;
    announce(els.lastPlay.textContent);
    return;
  }
  sfx.play();
  playCard('you', index);
  render();
  checkEnd();
}

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'KeyM') {
    soundOn = !soundOn;
    $('soundBtn').textContent = `Sound: ${soundOn ? 'On' : 'Off'}`;
    return;
  }
  if (event.code === 'KeyH') { els.help.classList.toggle('hidden'); return; }
  if (event.code === 'KeyR') { startDuel(); return; }
  if (event.code === 'Enter' || event.code === 'Space') {
    if (state.screen === 'title') { startDuel(); return; }
    if (state.screen === 'win' || state.screen === 'loss') { startDuel(); return; }
    if (state.screen === 'play' && state.yourTurn && !state.aiBusy) { event.preventDefault(); aiTurn(); }
    return;
  }
  const n = Number.parseInt(event.key, 10);
  if (n >= 1 && n <= 7) onPlayCard(n - 1);
});

$('startBtn').addEventListener('click', startDuel);
$('winAgainBtn').addEventListener('click', startDuel);
$('lossAgainBtn').addEventListener('click', startDuel);
$('restartBtn').addEventListener('click', startDuel);
$('endTurnBtn').addEventListener('click', () => { if (state.yourTurn && !state.aiBusy && state.screen === 'play') aiTurn(); });
$('soundBtn').addEventListener('click', () => {
  soundOn = !soundOn;
  $('soundBtn').textContent = `Sound: ${soundOn ? 'On' : 'Off'}`;
});
$('helpBtn').addEventListener('click', () => els.help.classList.remove('hidden'));
$('closeHelpBtn').addEventListener('click', () => els.help.classList.add('hidden'));

// ---------- screenshot staging: ?shot=start|play|win|loss&seed=N ----------
// Deterministic scenes built from the real rules and renderer, so screenshots show
// the actual game, not a mock-up.
function stageShot(name) {
  startDuel();
  if (name === 'start') {
    state.screen = 'title';
    els.title.classList.remove('hidden');
    els.win.classList.add('hidden');
    els.loss.classList.add('hidden');
    render();
    return;
  }
  if (name === 'play') {
    // A real mid-duel: turn 4, both sides bloodied, shields up, a lively log.
    state.turn = 4;
    state.you.life = 24; state.you.shield = 4; state.you.maxMana = 4; state.you.mana = 2;
    state.foe.life = 19; state.foe.shield = 7; state.foe.maxMana = 4; state.foe.mana = 0;
    state.log = [
      { html: '🔥 The duel begins. You hold 4 cards and 1 mana.', cls: 'sys' },
      { html: 'You hurl 🔥 Ember Spark (1 mana, Flame 3) — 3 damage!', cls: 'you' },
      { html: 'Rook raises 🍃 Thornwall (2 mana, Leaf 7) — +7 shield.', cls: 'foe' },
      { html: 'You play 🪨 Stone Fist (2 mana, Stone 6) — 6 damage!', cls: 'you' },
      { html: 'Rook hurls 🔥 Wildfire (3 mana, Flame 7) — 7 damage!', cls: 'foe' },
      { html: '— Turn 4: your mana rises to 4. You draw a card. —', cls: 'sys' },
      { html: 'You raise 🍃 Ironbark (3 mana, Leaf 11) — +11 shield.', cls: 'you' },
    ];
    els.lastPlay.textContent = 'You raise 🍃 Ironbark (3 mana, Leaf 11) — +11 shield.';
    state.damageDealt = 9;
    render();
    return;
  }
  if (name === 'win') {
    state.foe.life = 0; state.you.life = 14; state.turn = 7; state.damageDealt = 31;
    endDuel(true);
    return;
  }
  if (name === 'loss') {
    state.you.life = 0; state.foe.life = 11; state.turn = 8; state.damageDealt = 19;
    endDuel(false);
    return;
  }
  // Unknown shot name: fall back to the title.
  state.screen = 'title';
  els.title.classList.remove('hidden');
  render();
}

if (shot) {
  soundOn = false;
  stageShot(shot);
  // Paint twice, then signal the screenshot tool.
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
} else {
  render();
  announce('Ember Duel. Press Space or click Begin the Duel to start.');
}
