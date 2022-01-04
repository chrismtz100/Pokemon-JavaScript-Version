
const kanto = document.querySelector(".kanto");
const johto = document.querySelector(".johto");
const hoenn = document.querySelector(".hoenn");
const sinnoh = document.querySelector(".sinnoh");
const unova = document.querySelector(".unova");
const kalos = document.querySelector(".kalos");
const alola = document.querySelector(".alola");
const galar = document.querySelector(".galar");

const pokeInfo = document.querySelector(".pokemon-info");
const displayPokemon = document.querySelector(".container");

const Player1 = {
  Name: "Player 1",
  Character: "",
  Team: [],
  Side: "left",
  Fainted: 0
};
const Player2 = {
  Name: "Player 2",
  Character: "",
  Team: [],
  Side: "right",
  Fainted: 0
};
class Pokemon {
  constructor() {
    //classification
    this.Id = 0;
    this.Name = "";
    this.Sprite = "";
    this.IsFirst = false;
    this.KO = false;
    //stats
    this.Stats = [];
    //moves
    this.Moves = [];
  }
}

function BATTLE(ps1, ps2) {
  //display random pokemon to battle from Team. 
  while(ps1.Fainted <= 6 || ps2.Fainted <= 6) {
    let poke1 = findNonFaintedPokemon(ps1);
    let poke2 = findNonFaintedPokemon(ps2);

    
  }

}

function findNonFaintedPokemon(player) {
  let randomPokemon = 0;
  do {
    randomPokemon = Math.floor(Math.random() * player.Team.length) + 1;
  } while (player.Team[randomPokemon].KO !== true);
  return randomPokemon;
}
//collect data from res.data and add pokemon to player's team.
async function addPokemonToTeam(pokemon, player) {
  let pokeball = new Pokemon();
  //get pokemon classification.
  pokeball.Id = pokemon.id;
  pokeball.Name = pokemon.name;

  //get pokemon stats. 
  const pokemonStats = {
    Hp: pokemon.stats[0].base_stat,
    Attack: pokemon.stats[1].base_stat,
    Defense: pokemon.stats[2].base_stat,
    SpAttack: pokemon.stats[3].base_stat,
    SpDefense: pokemon.stats[4].base_stat,
    Speed: pokemon.stats[5].base_stat
  };
  pokeball.Stats.push(pokemonStats);

  //get pokemon moves.
  while(pokeball.Moves.length < 4) {
    let randomMoveId = Math.floor(Math.random() * pokemon.moves.length) + 1;
    const url = `https://pokeapi.co/api/v2/move/${randomMoveId}`;
    try {
      const res = await axios.get(url);
      if (res.data.damage_class.name === "physical") {
        const pokemonAttack = {
          id: res.data.id,
          power: res.data.power,
          name: res.data.name,
          pp: res.data.pp,
          type: res.data.type.name,
          accuracy: res.data.accuracy
        };
        pokeball.Moves.push(pokemonAttack);
      }
    } catch (err) {
      alert(err);
    }
  }
  player.Team.push(pokeball); //push API Pokemon ID only
}

//Generate a team at random of 6 pokemon and store in Player.Team
function generateRandomTeam(player) {
  console.log(`generateRandomTeam(${player})`);
  player.Team = [];
  for (let i = 0; i < 6; i++) {
    let randomPokemonID = Math.floor(Math.random() * 898) + 1;
    getPokemonFromRange(randomPokemonID, randomPokemonID, player);
  }
  console.log(player.Team);
}

//Gets Kanto Pokemon data from range. START and END are arguments.
async function getPokemonFromRange(start, end, player) {
  console.log(`getPokemonFromRange(${start}, ${end}, ${player})`);
  searchText.value = "";
  for (let i = start; i <= end; i++) {
    const url = `https://pokeapi.co/api/v2/pokemon/${i}`;
    try {
      const res = await axios.get(url);
      //player.Team.push(res.data); //push API all Pokemon data
      addPokemonToTeam(res.data, player);
      showPokemon(res.data, player);
    } catch (err) {
      alert(err);
    }
  }
}

//Displays Pokemon with response data.id
function showPokemon(pokemon, player) {
  console.log(`showPokemon(${pokemon}, ${player})`);
  const pokemonDiv = document.createElement("div");
  if (player.Side === "left") {//player 1 is on the left side
    pokemonDiv.innerHTML = `<img style="transform: scaleX(-1);" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png" width = "250px"/><h3> ${pokemon.id}. ${pokemon.name} </h3>`;
    displayPokemon.appendChild(pokemonDiv);
  } else { //player 2 is on the right side
    pokemonDiv.innerHTML = `<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png" width = "250px"/><h3> ${pokemon.id}. ${pokemon.name} </h3>`;
    displayPokemon.appendChild(pokemonDiv);
  }
  
}

//Start PLAY sequence
function PLAY(player1, player2) {
  console.log(`PLAY(${player1}, ${player2})`);
  //display teams
  displayPokemonTeamIcons(player1);
  displayPokemonTeamIcons(player2);
  //select starter to begin battle with
  //Implement later
  //selectStarter();
  //begin PLAY phase
  //BATTLE(player1, player2)
  //player attack selection

  //resolve attack

  //calculate hp
}
async function displayPokemonTeamIcons(player) {
  console.log(`displayPokemonTeamIcons(${player})`);
  searchText.value = "";

  const pokemonDiv = document.createElement("div");
  for (let i = 0; i < player.Team.length; i++) {
    const url = `https://pokeapi.co/api/v2/pokemon/${player.Team[i].Id}`;
    try {
      console.log(player.Team[i].id);
      const res = await axios.get(url);
      let iconIMG = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-viii/icons/${res.data.id}.png`
      
      if (player.Side === "left") {
        
        pokemonDiv.innerHTML += `<img style="border: 5px solid; transform: scaleX(-1);" src="${iconIMG}" width="250px" />`;
        pokemonDiv.innerHTML += `<br />`
        
      } else {
        pokemonDiv.innerHTML += `<img style="border: 5px solid;" src="${iconIMG}" width="250px" />`;
        pokemonDiv.innerHTML += `<br />`
        //displayPokemon.appendChild(pokemonDiv);
      }
    } catch (err) {
      alert(err);
    }
    
  }
  displayPokemon.appendChild(pokemonDiv);
}
//Searches for a Pokemon in all Pokemon
async function searchPokemon(findme) {
  console.log(`searchPokemon(${findme})`);
  const url = `https://pokeapi.co/api/v2/pokedex/national/`; //using national dex for pokemon lookup
  try {
    const res = await axios.get(url);
    let pokeball = res.data.pokemon_entries.filter(function (obj) { return searchObj(obj, findme) }); //returns either object of a pokemon OR an empty array pokemon not found.
    if (pokeball.length !== 0) { //If object: "found" is larger than 0, then pokemon was found.
      console.log("Search Successful.");
      let pokemonID = pokeball[0].entry_number; //object uses national pokedex to return object with ID and name. 
      getPokemonFromRange(pokemonID, pokemonID); //uses function to lookup pokemon by ID. 
    } else {
      console.log("Search Failed. Try Again.");
    }
  } catch (err) {
    alert(err);
  }
}
function searchObj(obj, findme) {
  console.log(`searchObj(${obj}, ${findme})`);
  for (let key in obj) {
    let value = obj[key]; //set value EQUAL to a key value of itself.
    if (typeof value === 'object') { //if value is type object, then recusrively call searchObj to go deeper into object values.
      return searchObj(value, findme); //call searchObj
    }

    //HERE: at this point, the value is now equal to 1 of 3 things: 
    //Pokemon Name, 
    //Pokemon ID, 
    //Pokemon Sprite URL

    //We now check if the value is equal to the "findme" value. 
    if (typeof value === 'string' && value.toLowerCase().indexOf(findme.toLowerCase()) > -1) {
      return obj;
    }
  }
}

function Gen1Button() { //Generate P1 Team
  //getPokemonFromRange(1, 151);
  generateRandomTeam(Player1);
  displayPokemon.style.display = 'flex';
}
function Gen2Button() { //Generate P2 Team
  //getPokemonFromRange(152, 251);\
  generateRandomTeam(Player2);
  displayPokemon.style.display = 'flex';
}
function Gen3Button() {
  //getPokemonFromRange(252, 386);
  PLAY(Player1, Player2)
  displayPokemon.style.display = 'flex';
}
function Gen4Button() {
  BATTLE(Player1, Player2)
  displayPokemon.style.display = 'flex';
}
function Gen5Button() {
  getPokemonFromRange(494, 649);
  displayPokemon.style.display = 'flex';
}
function Gen6Button() {
  getPokemonFromRange(650, 721);
  displayPokemon.style.display = 'flex';
}
function Gen7Button() {
  getPokemonFromRange(722, 809);
  displayPokemon.style.display = 'flex';
}
function Gen8Button() {
  getPokemonFromRange(810, 898);
  displayPokemon.style.display = 'flex';
}
const searchForm = document.querySelector("#pokemon-data");
const searchText = document.querySelector("#search");



searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  displayPokemon.innerHTML = "";
  const input = searchText.value;
  if (input.length > 0) {
    searchPokemon(input);
  }
})
