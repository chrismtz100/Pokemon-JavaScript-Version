// ============================================================
// DOM REFERENCES
// ============================================================
const teamPreviewContainer = document.querySelector("#team-preview");
const searchForm           = document.querySelector("#pokemon-data");
const searchText           = document.querySelector("#search");

// ============================================================
// GAME STATE
// ============================================================
const gameState = {
  mode: "1player",           // "1player" | "2player"
  phase: "teamSelect",       // "teamSelect" | "battle" | "gameOver"
  selectedMove: { p1: null, p2: null },
  isAnimating: false
};

// ============================================================
// PLAYER OBJECTS
// ============================================================
const player1 = {
  name: "Player 1",
  team: [],
  activeIndex: 0,
  faintedCount: 0,
  side: "left"
};
const player2 = {
  name: "Player 2",
  team: [],
  activeIndex: 0,
  faintedCount: 0,
  side: "right"
};

// ============================================================
// POKEMON CLASS
// ============================================================
class Pokemon {
  constructor() {
    this.id         = 0;
    this.name       = "";
    this.sprite     = "";       // front-facing sprite URL
    this.backSprite = "";       // back-facing sprite URL
    this.types      = [];       // e.g. ["fire"] or ["fire", "flying"]
    this.level      = 50;       // all Pokemon fight at level 50
    this.currentHp  = 0;        // HP remaining during battle
    this.isKO       = false;
    this.stats      = { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 };
    this.moves      = [];       // max 4: { id, name, power, pp, currentPp, type, category, accuracy }
  }
}

// ============================================================
// TYPE EFFECTIVENESS CHART (Gen 6+, includes Fairy)
// Rows = attacking move type, keys = defending Pokemon type
// Values: 2 = super effective, 0.5 = not very effective, 0 = immune
// Omitted entries default to 1 (neutral)
// ============================================================
const TYPE_CHART = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice:      { water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:      { fire: 0.5, grass: 2, fighting: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
};

function getTypeEffectiveness(moveType, defenderTypes) {
  let multiplier = 1;
  const chart = TYPE_CHART[moveType];
  if (!chart) return 1;
  for (const defType of defenderTypes) {
    if (chart[defType] !== undefined) {
      multiplier *= chart[defType];
    }
  }
  return multiplier;
}

// ============================================================
// DAMAGE CALCULATION (Gen 5+ formula)
// ============================================================
function calculateDamage(attacker, move, defender) {
  const level = attacker.level;
  const power = move.power;

  const A = move.category === "physical" ? attacker.stats.attack   : attacker.stats.spAttack;
  const D = move.category === "physical" ? defender.stats.defense  : defender.stats.spDefense;

  const baseDmg = Math.floor(
    (Math.floor((2 * level / 5 + 2) * power * A / D) / 50) + 2
  );

  const stab            = attacker.types.includes(move.type) ? 1.5 : 1.0;
  const typeMultiplier  = getTypeEffectiveness(move.type, defender.types);
  const isCritical      = Math.random() < (1 / 16);
  const critMultiplier  = isCritical ? 1.5 : 1.0;
  const randomFactor    = 0.85 + Math.random() * 0.15;

  // Immunity: type multiplier 0 means the move does nothing
  if (typeMultiplier === 0) {
    return { damage: 0, isCritical: false, typeMultiplier: 0 };
  }

  const finalDamage = Math.floor(baseDmg * stab * typeMultiplier * critMultiplier * randomFactor);
  return { damage: Math.max(1, finalDamage), isCritical, typeMultiplier };
}

function accuracyCheck(move) {
  return move.accuracy === null || move.accuracy === undefined || Math.random() * 100 <= move.accuracy;
}

// ============================================================
// CPU AI — picks a random move with remaining PP
// ============================================================
function cpuSelectMove(pokemon) {
  const usable = pokemon.moves.filter(m => m.currentPp > 0);
  if (usable.length === 0) {
    return { id: 0, name: "struggle", power: 50, pp: 1, currentPp: 1, type: "normal", category: "physical", accuracy: 100 };
  }
  return usable[Math.floor(Math.random() * usable.length)];
}

// ============================================================
// DATA HELPERS
// ============================================================
function findFirstLivePokemon(player) {
  return player.team.findIndex(p => !p.isKO);
}

function isTeamDefeated(player) {
  return player.team.every(p => p.isKO);
}

// ============================================================
// TEAM GENERATION
// ============================================================
async function generateRandomTeam(player) {
  player.team = [];
  player.activeIndex = 0;
  player.faintedCount = 0;

  setButtonsEnabled(false);

  // Show loading state in team preview
  const previewContainer = document.getElementById("team-preview");
  const loadingMsg = document.createElement("div");
  loadingMsg.id = `loading-${player.side}`;
  loadingMsg.className = "loading-message";
  loadingMsg.textContent = `Generating ${player.name}'s team...`;
  previewContainer.appendChild(loadingMsg);

  const fetchPromises = [];
  for (let i = 0; i < 6; i++) {
    const randomId = Math.floor(Math.random() * 898) + 1;
    fetchPromises.push(fetchSinglePokemon(randomId, player));
  }

  await Promise.all(fetchPromises);

  // Remove loading message
  const loadingEl = document.getElementById(`loading-${player.side}`);
  if (loadingEl) loadingEl.remove();

  renderTeamPreview(player);
  setButtonsEnabled(true);
  updateBattleReadiness();
}

async function fetchSinglePokemon(pokemonId, player) {
  const url = `https://pokeapi.co/api/v2/pokemon/${pokemonId}`;
  try {
    const res = await axios.get(url);
    await addPokemonToTeam(res.data, player);
  } catch (err) {
    console.error(`Failed to fetch Pokemon #${pokemonId}:`, err);
    // Retry once with a different random ID
    const retryId = Math.floor(Math.random() * 898) + 1;
    try {
      const retryRes = await axios.get(`https://pokeapi.co/api/v2/pokemon/${retryId}`);
      await addPokemonToTeam(retryRes.data, player);
    } catch (retryErr) {
      console.error(`Retry fetch also failed for Pokemon slot:`, retryErr);
    }
  }
}

async function addPokemonToTeam(pokemonData, player) {
  const newPokemon = new Pokemon();

  newPokemon.id         = pokemonData.id;
  newPokemon.name       = pokemonData.name;
  newPokemon.sprite     = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonData.id}.png`;
  newPokemon.backSprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${pokemonData.id}.png`;
  newPokemon.types      = pokemonData.types.map(t => t.type.name);

  const s = pokemonData.stats;
  newPokemon.stats = {
    hp:        s[0].base_stat,
    attack:    s[1].base_stat,
    defense:   s[2].base_stat,
    spAttack:  s[3].base_stat,
    spDefense: s[4].base_stat,
    speed:     s[5].base_stat
  };
  newPokemon.currentHp = newPokemon.stats.hp;

  // Pick moves from this Pokemon's actual learnable move pool
  // Prioritize damaging moves (physical/special with power > 0), fill with status if needed
  const learnableMoves = [...pokemonData.moves]; // copy so we can splice
  const MAX_ATTEMPTS   = Math.min(learnableMoves.length, 50);
  let attemptsLeft     = MAX_ATTEMPTS;

  while (newPokemon.moves.length < 4 && attemptsLeft > 0 && learnableMoves.length > 0) {
    attemptsLeft--;
    const randomIndex = Math.floor(Math.random() * learnableMoves.length);
    const moveEntry   = learnableMoves.splice(randomIndex, 1)[0];
    const moveUrl     = moveEntry.move.url;

    try {
      const res      = await axios.get(moveUrl);
      const moveData = res.data;
      const category = moveData.damage_class.name; // "physical" | "special" | "status"
      const power    = moveData.power;

      const isDamagingMove = (category === "physical" || category === "special") && power !== null && power > 0;
      const isStatusMove   = category === "status";

      // Always prefer damaging moves; accept status only to fill remaining slots
      if (isDamagingMove || (isStatusMove && newPokemon.moves.length < 4)) {
        newPokemon.moves.push({
          id:        moveData.id,
          name:      moveData.name,
          power:     power || 0,
          pp:        moveData.pp,
          currentPp: moveData.pp,
          type:      moveData.type.name,
          category,
          accuracy:  moveData.accuracy
        });
      }
    } catch (err) {
      console.warn(`Move fetch failed: ${moveUrl}`, err);
      // Silently skip — don't block the whole team for one bad move
    }
  }

  // Fallback: if no moves found, give Tackle
  if (newPokemon.moves.length === 0) {
    newPokemon.moves.push({
      id: 33, name: "tackle", power: 40, pp: 35, currentPp: 35,
      type: "normal", category: "physical", accuracy: 100
    });
  }

  player.team.push(newPokemon);
}

// ============================================================
// TEAM PREVIEW (setup screen)
// ============================================================
function renderTeamPreview(player) {
  const container = document.getElementById("team-preview");

  // Remove any existing section for this player
  const existing = container.querySelector(`[data-side="${player.side}"]`);
  if (existing) existing.remove();

  const section = document.createElement("div");
  section.dataset.side = player.side;
  section.className = "team-preview-section";

  const heading = document.createElement("h3");
  heading.textContent = `${player.name}'s Team`;
  section.appendChild(heading);

  for (const poke of player.team) {
    const card = document.createElement("div");
    card.className = "team-card";
    const typeLabels = poke.types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join(" ");
    card.innerHTML = `
      <img src="${poke.sprite}" width="80" alt="${poke.name}" />
      <div class="card-name">${poke.name.toUpperCase()}</div>
      <div class="card-types">${typeLabels}</div>
      <div class="card-hp">HP: ${poke.stats.hp}</div>
    `;
    section.appendChild(card);
  }

  container.appendChild(section);
}

// ============================================================
// POKEMON SEARCH (unchanged behavior, clean variable names)
// ============================================================
async function searchPokemon(searchQuery) {
  const url = `https://pokeapi.co/api/v2/pokedex/national/`;
  try {
    const res     = await axios.get(url);
    const matches = res.data.pokemon_entries.filter(obj => deepSearch(obj, searchQuery));
    if (matches.length !== 0) {
      const pokemonId = matches[0].entry_number;
      await fetchSinglePokemonForDisplay(pokemonId);
    } else {
      console.log("Search failed. Pokemon not found.");
    }
  } catch (err) {
    console.error("Search error:", err);
  }
}

// Fetches and displays a single Pokemon by ID (for search results)
async function fetchSinglePokemonForDisplay(pokemonId) {
  const url = `https://pokeapi.co/api/v2/pokemon/${pokemonId}`;
  try {
    const res = await axios.get(url);
    showSearchResult(res.data);
  } catch (err) {
    console.error(`Failed to fetch Pokemon #${pokemonId}:`, err);
  }
}

function showSearchResult(pokemonData) {
  const container = document.getElementById("team-preview");
  const card = document.createElement("div");
  card.className = "team-card";
  card.innerHTML = `
    <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonData.id}.png" width="80" />
    <div class="card-name">${pokemonData.id}. ${pokemonData.name.toUpperCase()}</div>
  `;
  container.appendChild(card);
}

function deepSearch(obj, searchQuery) {
  for (const key in obj) {
    const value = obj[key];
    if (typeof value === "object") {
      return deepSearch(value, searchQuery);
    }
    if (typeof value === "string" && value.toLowerCase().indexOf(searchQuery.toLowerCase()) > -1) {
      return obj;
    }
  }
}

// ============================================================
// BATTLE UI — SETUP HELPERS
// ============================================================
function setButtonsEnabled(enabled) {
  const genP1  = document.getElementById("btn-gen-p1");
  const genP2  = document.getElementById("btn-gen-p2");
  const battle = document.getElementById("btn-battle");
  if (genP1)  genP1.disabled  = !enabled;
  if (genP2)  genP2.disabled  = !enabled;
  if (battle) battle.disabled = !enabled;
}

function updateBattleReadiness() {
  const btn = document.getElementById("btn-battle");
  if (btn) {
    btn.disabled = !(player1.team.length === 6 && player2.team.length === 6);
  }
}

function toggleMode() {
  gameState.mode = gameState.mode === "1player" ? "2player" : "1player";
  const btn = document.getElementById("btn-mode-toggle");
  if (btn) {
    btn.textContent = gameState.mode === "1player"
      ? "Mode: 1 Player (vs CPU)"
      : "Mode: 2 Players";
  }
}

// ============================================================
// BATTLE — START / RESET
// ============================================================
function startBattle() {
  if (player1.team.length < 6 || player2.team.length < 6) {
    alert("Both teams must be generated before battling!");
    return;
  }

  gameState.phase         = "battle";
  gameState.isAnimating   = false;
  gameState.selectedMove  = { p1: null, p2: null };
  player1.activeIndex     = 0;
  player2.activeIndex     = 0;

  document.getElementById("setup-screen").style.display  = "none";
  document.getElementById("battle-screen").style.display = "block";

  renderTeamIcons(player1);
  renderTeamIcons(player2);
  updateActivePokemonSprite(player1);
  updateActivePokemonSprite(player2);
  updateHpBar(player1);
  updateHpBar(player2);
  showBattlePrompt();
}

function resetGame() {
  player1.team         = []; player1.activeIndex = 0; player1.faintedCount = 0;
  player2.team         = []; player2.activeIndex = 0; player2.faintedCount = 0;
  gameState.phase      = "teamSelect";
  gameState.isAnimating = false;
  gameState.selectedMove = { p1: null, p2: null };

  document.getElementById("battle-screen").style.display = "none";
  document.getElementById("setup-screen").style.display  = "block";
  document.getElementById("btn-play-again").style.display = "none";
  document.getElementById("team-preview").innerHTML       = "";
  document.getElementById("battle-log-list").innerHTML    = "";
  document.getElementById("battle-log-text").textContent  = "";

  const battleBtn = document.getElementById("btn-battle");
  if (battleBtn) battleBtn.disabled = true;
}

// ============================================================
// BATTLE UI — RENDER FUNCTIONS
// ============================================================
function renderTeamIcons(player) {
  const containerId = player === player1 ? "p1-team-icons" : "p2-team-icons";
  const container   = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  for (const poke of player.team) {
    const iconUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-viii/icons/${poke.id}.png`;
    const img = document.createElement("img");
    img.src       = iconUrl;
    img.className = "team-icon" + (poke.isKO ? " fainted" : "");
    img.title     = poke.name;
    container.appendChild(img);
  }
}

function updateActivePokemonSprite(player) {
  const activePoke = player.team[player.activeIndex];
  if (!activePoke) return;

  if (player === player1) {
    const spriteEl = document.getElementById("p1-sprite");
    const nameEl   = document.getElementById("p1-name");
    if (spriteEl) spriteEl.src = activePoke.backSprite;
    if (nameEl)   nameEl.textContent = activePoke.name.toUpperCase();
  } else {
    const spriteEl = document.getElementById("p2-sprite");
    const nameEl   = document.getElementById("p2-name");
    if (spriteEl) spriteEl.src = activePoke.sprite;
    if (nameEl)   nameEl.textContent = activePoke.name.toUpperCase();
  }
}

function updateHpBar(player) {
  const activePoke = player.team[player.activeIndex];
  if (!activePoke) return;

  const hpPercent = Math.max(0, (activePoke.currentHp / activePoke.stats.hp) * 100);
  const barId     = player === player1 ? "p1-hp-bar"  : "p2-hp-bar";
  const textId    = player === player1 ? "p1-hp-text" : "p2-hp-text";

  const bar = document.getElementById(barId);
  if (bar) {
    bar.style.width = `${hpPercent}%`;
    bar.className   = "hp-bar " + (hpPercent > 50 ? "hp-green" : hpPercent > 25 ? "hp-yellow" : "hp-red");
  }

  const text = document.getElementById(textId);
  if (text) {
    text.textContent = `${activePoke.currentHp}/${activePoke.stats.hp}`;
  }
}

function updateMoveButtons(player) {
  const activePoke = player.team[player.activeIndex];
  if (!activePoke) return;

  for (let i = 0; i < 4; i++) {
    const btn = document.getElementById(`move-${i}`);
    if (!btn) continue;

    if (i < activePoke.moves.length) {
      const move   = activePoke.moves[i];
      btn.textContent   = `${move.name.toUpperCase()} [${move.type.toUpperCase()}]  PP: ${move.currentPp}/${move.pp}`;
      btn.disabled      = move.currentPp === 0;
      btn.dataset.index = i;
      btn.className     = `move-btn type-${move.type}`;
    } else {
      btn.textContent = "---";
      btn.disabled    = true;
      btn.className   = "move-btn";
    }
  }

  // If all PP is 0, add Struggle as the only option
  const allExhausted = activePoke.moves.every(m => m.currentPp === 0);
  if (allExhausted) {
    const btn0 = document.getElementById("move-0");
    if (btn0) {
      btn0.textContent = "STRUGGLE [NORMAL]  PP: --";
      btn0.disabled    = false;
      btn0.dataset.struggle = "true";
      btn0.className   = "move-btn type-normal";
    }
    for (let i = 1; i < 4; i++) {
      const btn = document.getElementById(`move-${i}`);
      if (btn) { btn.textContent = "---"; btn.disabled = true; }
    }
  }
}

function appendBattleLog(message) {
  const logText = document.getElementById("battle-log-text");
  if (logText) logText.textContent = message;

  const logList = document.getElementById("battle-log-list");
  if (logList) {
    const li = document.createElement("li");
    li.textContent = message;
    logList.prepend(li); // newest entry at top
  }
}

function showBattlePrompt() {
  const activePoke = player1.team[player1.activeIndex];
  if (activePoke) {
    appendBattleLog(`What will ${activePoke.name.toUpperCase()} do?`);
  }
  updateMoveButtons(player1);
}

function disableMoveButtons() {
  for (let i = 0; i < 4; i++) {
    const btn = document.getElementById(`move-${i}`);
    if (btn) btn.disabled = true;
  }
}

function showPlayAgainButton() {
  const btn = document.getElementById("btn-play-again");
  if (btn) btn.style.display = "block";
}

// ============================================================
// PLAYER MOVE SELECTION
// ============================================================
function playerSelectMove(moveIndex) {
  if (gameState.isAnimating) return;
  if (gameState.phase !== "battle") return;

  const activePoke = player1.team[player1.activeIndex];
  if (!activePoke) return;

  // Handle Struggle case
  const btn0 = document.getElementById("move-0");
  const isStruggle = moveIndex === 0 && btn0 && btn0.dataset.struggle === "true";

  let selectedMove;
  if (isStruggle) {
    selectedMove = { id: 0, name: "struggle", power: 50, pp: 1, currentPp: 1, type: "normal", category: "physical", accuracy: 100 };
  } else {
    if (moveIndex >= activePoke.moves.length) return;
    selectedMove = activePoke.moves[moveIndex];
    if (selectedMove.currentPp === 0) return;
  }

  gameState.selectedMove.p1 = selectedMove;

  // Opponent picks a move (CPU or Player 2)
  const opponentPoke = player2.team[player2.activeIndex];
  gameState.selectedMove.p2 = cpuSelectMove(opponentPoke);

  executeTurn(gameState.selectedMove.p1, gameState.selectedMove.p2);
}

// ============================================================
// BATTLE ENGINE — TURN EXECUTION
// ============================================================
function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeTurn(p1Move, p2Move) {
  gameState.isAnimating = true;
  disableMoveButtons();

  const poke1 = player1.team[player1.activeIndex];
  const poke2 = player2.team[player2.activeIndex];

  // Determine turn order by Speed stat; ties broken randomly
  const p1GoesFirst = poke1.stats.speed > poke2.stats.speed
    || (poke1.stats.speed === poke2.stats.speed && Math.random() < 0.5);

  let first, second, firstMove, secondMove, attackingFirst, attackingSecond;

  if (p1GoesFirst) {
    [first, second]               = [poke1, poke2];
    [firstMove, secondMove]       = [p1Move, p2Move];
    [attackingFirst, attackingSecond] = [player1, player2];
  } else {
    [first, second]               = [poke2, poke1];
    [firstMove, secondMove]       = [p2Move, p1Move];
    [attackingFirst, attackingSecond] = [player2, player1];
  }

  // First Pokemon attacks
  await resolveAttack(first, firstMove, second, attackingFirst, attackingSecond);

  // Second Pokemon attacks only if it hasn't fainted
  if (!second.isKO) {
    await resolveAttack(second, secondMove, first, attackingSecond, attackingFirst);
  }

  // Handle any Pokemon that fainted this turn
  await handleFaintedPokemon(player1);
  await handleFaintedPokemon(player2);

  // Check win condition
  if (isTeamDefeated(player1)) {
    endBattle(player2);
    return;
  }
  if (isTeamDefeated(player2)) {
    endBattle(player1);
    return;
  }

  // Ready for next turn
  gameState.isAnimating = false;
  gameState.selectedMove = { p1: null, p2: null };
  showBattlePrompt();
}

async function resolveAttack(attacker, move, defender, attackingPlayer, defendingPlayer) {
  // Deduct PP (skip for Struggle)
  if (move.id !== 0) {
    const moveInList = attacker.moves.find(m => m.id === move.id);
    if (moveInList && moveInList.currentPp > 0) {
      moveInList.currentPp--;
    }
  }

  appendBattleLog(`${attacker.name.toUpperCase()} used ${move.name.toUpperCase()}!`);
  await pause(900);

  // Accuracy check
  if (!accuracyCheck(move)) {
    appendBattleLog(`${attacker.name.toUpperCase()}'s attack missed!`);
    await pause(700);
    return;
  }

  // Status moves — log placeholder, no damage
  if (move.category === "status" || move.power === 0) {
    appendBattleLog(`(${move.name.toUpperCase()} — status effect not yet implemented.)`);
    await pause(700);
    return;
  }

  const { damage, isCritical, typeMultiplier } = calculateDamage(attacker, move, defender);

  if (typeMultiplier === 0) {
    appendBattleLog(`It doesn't affect ${defender.name.toUpperCase()}...`);
    await pause(800);
    return;
  }

  if (isCritical) {
    appendBattleLog("A critical hit!");
    await pause(500);
  }

  if (typeMultiplier >= 2) {
    appendBattleLog("It's super effective!");
    await pause(500);
  } else if (typeMultiplier > 0 && typeMultiplier < 1) {
    appendBattleLog("It's not very effective...");
    await pause(500);
  }

  defender.currentHp = Math.max(0, defender.currentHp - damage);
  updateHpBar(defendingPlayer);
  appendBattleLog(`${defender.name.toUpperCase()} took ${damage} damage! (${defender.currentHp}/${defender.stats.hp} HP)`);
  await pause(700);

  if (defender.currentHp <= 0) {
    defender.isKO = true;
    renderTeamIcons(defendingPlayer);
    appendBattleLog(`${defender.name.toUpperCase()} fainted!`);
    await pause(900);
  }
}

async function handleFaintedPokemon(player) {
  const activePoke = player.team[player.activeIndex];
  if (!activePoke || !activePoke.isKO) return;

  const nextIndex = findFirstLivePokemon(player);
  if (nextIndex === -1) return; // all fainted — win condition handled by caller

  player.activeIndex = nextIndex;
  const nextPoke = player.team[nextIndex];
  appendBattleLog(`${player.name} sent out ${nextPoke.name.toUpperCase()}!`);
  await pause(700);

  updateActivePokemonSprite(player);
  updateHpBar(player);
  renderTeamIcons(player);
}

function endBattle(winner) {
  gameState.phase = "gameOver";
  appendBattleLog(`${winner.name} wins the battle!`);
  disableMoveButtons();
  showPlayAgainButton();
}

// ============================================================
// BUTTON HANDLERS (HTML onclick targets)
// ============================================================
function Gen1Button() {
  generateRandomTeam(player1);
  document.getElementById("team-preview").style.display = "flex";
}

function Gen2Button() {
  generateRandomTeam(player2);
  document.getElementById("team-preview").style.display = "flex";
}

// ============================================================
// SEARCH FORM EVENT LISTENER
// ============================================================
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  document.getElementById("team-preview").innerHTML = "";
  const input = searchText.value.trim();
  if (input.length > 0) {
    searchPokemon(input);
  }
});
