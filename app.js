const stackReference = [];
for (let i = 0; i < 4; i++) {
  stackReference.push({
    name: '+4',
    number: -1,
    color: ''
  },
  {
    name: '+col',
    number: -1,
    color: ''
  });
}
const colors = ['red', 'blue', 'green', 'yellow'];
for (const color of colors) {
  for (let a = 0; a < 2; a++) {
    for (let i = a; i < 10; i++) {
      stackReference.push({
        name: `${color}${i}`,
        number: i,
        color: color
      });
    }
    stackReference.push({
      name: `${color}+2`,
      number: -1,
      color: color
    },
    {
      name: `${color}Pass`,
      number: -1,
      color: color 
    },
    {
      name: `${color}Turn`,
      number: -1,
      color: color
    });
  }
}
shuffle(stackReference);
function randomCard() {
  return stackReference[Math.floor(Math.random() * stackReference.length)];
}

const game = new Vue({
  el: '#app',
  data: {
    state: 'main',
    gameId: '',
    gameData: {},
    host: false,
    playerId: 0,
    isPickingColor: false,
    canSkip: false
  },
  methods: {
    createGame: function() {

      const ref = firebase.database().ref('games').push();
      const key = ref.key;

      this.gameData.players = [
        {
          name: 'Guest 1',
          cards: stackReference.slice(0,7)
        }
      ];
      
      this.gameData.cardStack = 0;
      this.gameData.turn = 0;
      this.gameData.started = false;
      this.gameData.winner = '';
      this.host = true;
      const num = Math.floor(Math.random() * 9);
      const col = colors[Math.floor(Math.random() * 4)];
      this.gameData.currentCard = {
        name: `${col}${num}`,
        number: num,
        color: col
      }
      this.gameData.currentPlayer = 0;
      this.gameData.turnOrder = 1;

      ref.set(this.gameData).then(() => {
        this.gameId = key;
        this.state = 'lobby';
        window.history.replaceState(null, null, `?game=${this.gameId}`);
      });

      ref.on('value', handleGameUpdate);

    },
    startGame: function() {
      if (this.host && this.gameData.players.length > 1) {
        this.gameData.started = true;
        firebase.database().ref(`games/${this.gameId}/started`).set(true).then(() => {
          this.state = 'game';
        });
      }
    },
    changeName: function() {
      const newName = prompt('Enter a new name.', this.gameData.players[this.playerId].name);
      if (!newName.trim() || newName.length > 15) {
        alert('Invalid name.');
        return;
      }

      this.gameData.players[this.playerId].name = newName;
      updateSelfOnServer();
    },
    playCard: async function(index) {
      const card = this.gameData.players[this.playerId].cards[index];
      const removeCard = () => {
        this.gameData.players[this.playerId].cards.splice(index, 1);
        checkEndOfGame();
      }
      const currentCard = this.gameData.currentCard;

      console.log(currentCard.name, card.name);

      // If it's not our turn return
      if (this.gameData.currentPlayer !== this.playerId) return;

      // If we are not currently picking a color
      if (this.isPickingColor) return;
      
      // For number cards
      if (card.number !== -1) {
        if (currentCard.color === card.color || card.number === currentCard.number) {
          this.gameData.currentCard = card;
          removeCard();
          nextTurn();
          return;
        }
        return;
      }

      // +2
      if (card.name.includes('+2')) {
        if (card.color === currentCard.color || currentCard.name.includes('+2')) {
          this.gameData.currentCard = card;
          this.gameData.cardStack += 2;
          removeCard();
          nextTurn(1, true);
          return;
        }
      }

      // Pass
      if (card.name.includes('Pass')) {
        if (card.color === currentCard.color || currentCard.name.includes('Pass')) {
          this.gameData.currentCard = card;
          
          removeCard();
          nextTurn(2);
          return;
        }
      }

      // Uno Reverse
      if (card.name.includes('Turn')) {
        if (card.color === currentCard.color || currentCard.name.includes('Turn')) {
          this.gameData.currentCard = card;
          this.gameData.turnOrder *= -1;

          removeCard();
          nextTurn(this.gameData.players.length === 2 ? 0 : 1);
          return;
        }
      }

      // +4
      if (card.name.includes('+4')) {
        const col = await pickColor();
        game.isPickingColor = false;
        card.color = col;
        this.gameData.currentCard = card;
        this.gameData.cardStack += 4;
        removeCard();
        nextTurn(1, true);
        return;
      }

      // color change
      if (card.name.includes('+col')) {
        const col = await pickColor();
        game.isPickingColor = false;
        card.color = col;
        this.gameData.currentCard = card;
        removeCard();
        nextTurn();
        return;
      }

    },
    pickRandomCard: function() {
      if (this.gameData.currentPlayer !== this.playerId) return;
      if (this.canSkip) return;
      this.gameData.players[this.playerId].cards.push(randomCard());
      updateSelfOnServer();
      this.canSkip = true;
    },
    skipTurn: function() {
      if (this.canSkip) {
        nextTurn();
      }
    }
  },
  computed: {
    otherPlayers: function() {
      return this.gameData.players.filter((el, i) => i !== this.playerId);
    }
  }
});

window.addEventListener('load', () => {
  const params = getAllUrlParams();
  if (params.game) {
    firebase.database().ref('games').once('value', (snap) => {
      const games = snap.val();
      let gameExists = false;
      for (const game in games) {
        if (game === params.game) {
          gameExists = true;
        }
      }
      
      if (gameExists) {
        game.gameId = params.game;
        firebase.database().ref(`games/${params.game}`).once('value', (snap) => {
          game.gameData = snap.val();
          const playerIndex = game.gameData.players.length;
          
          /*if (playerIndex > 5) {
            alert('Game is full.');
            window.location.href = '127.0.0.1:5500';
            return;
          }*/

          if (game.gameData.started) {
            alert('Game has already started.');
            window.location.href = 'https://oskar-codes.github.io/uno-online';
            return;
          }

          game.state = 'lobby';
          game.playerId = playerIndex;
          const playerObj = {
            name: `Guest ${playerIndex + 1}`,
            cards: stackReference.slice(0,7)
          }

          game.gameData.players.push(playerObj);

          updateSelfOnServer().then(() => {
            firebase.database().ref(`games/${params.game}`).on('value', handleGameUpdate);
          });
        });
      }
    });
  }
});

function handleGameUpdate(snap) {
  const incomingGameData = snap.val();
  if (incomingGameData.started && !game.gameData.started) {
    game.state = 'game';
  }
  if (incomingGameData.winner) {
    alert(`${incomingGameData.winner} won the game!`);
    window.location.href = 'https://oskar-codes.github.io/uno-online';
  }
  game.gameData = incomingGameData;
}

function updateSelfOnServer() {
  return firebase.database().ref(`games/${game.gameId}/players/${game.playerId}`).set(game.gameData.players[game.playerId]);
}

function updateGameOnServer() {
  return firebase.database().ref(`games/${game.gameId}`).set(game.gameData);
}

function nextTurn(n = 1, addedCards) {

  game.canSkip = false;

  if (!addedCards) {
    for (let i = 0; i < game.gameData.cardStack; i++) {
      game.gameData.players[game.playerId].cards.push(randomCard());
    }
    game.gameData.cardStack = 0;
  }

  n *= game.gameData.turnOrder;

  const nPlayers = game.gameData.players.length;
  const dist = game.playerId + n;
  if (dist < 0) {
    game.gameData.currentPlayer = nPlayers + dist;
  } else {
    game.gameData.currentPlayer = (game.playerId + n) % nPlayers;
  }

  console.log(game.gameData.currentPlayer);

  updateGameOnServer();
}

function checkEndOfGame() {
  if (game.gameData.players[game.playerId].cards.length === 0 && game.gameData.cardStack === 0) {
    firebase.database().ref(`games/${game.gameId}/winner`).set(game.gameData.players[game.playerId].name);
  }
}

function pickColor() {
  game.isPickingColor = true;

  return new Promise(function(resolve, reject) {

    const buttons = document.querySelectorAll('.color-picker button');

    for (const button of buttons) {
      button.addEventListener('click', () => {
        resolve(button.getAttribute('class'));
      });
    }

  });
}

function getAllUrlParams(url) {
  let queryString = url ? url.split('?')[1] : window.location.search.slice(1);
  const obj = {};
  if (queryString) {
    queryString = queryString.split('#')[0];
    const arr = queryString.split('&');
    for (var i = 0; i < arr.length; i++) {
      const a = arr[i].split('=');
      const paramName = a[0];
      const paramValue = typeof (a[1]) === 'undefined' ? true : a[1];
      if (paramName.match(/\[(\d+)?\]$/)) {
        let key = paramName.replace(/\[(\d+)?\]/, '');
        if (!obj[key]) obj[key] = [];
        if (paramName.match(/\[\d+\]$/)) {
          var index = /\[(\d+)\]/.exec(paramName)[1];
          obj[key][index] = paramValue;
        } else {
          obj[key].push(paramValue);
        }
      } else {
        if (!obj[paramName]) {
          obj[paramName] = paramValue;
        } else if (obj[paramName] && typeof obj[paramName] === 'string'){
          obj[paramName] = [obj[paramName]];
          obj[paramName].push(paramValue);
        } else {
          obj[paramName].push(paramValue);
        }
      }
    }
  }
  return obj;
}

function shuffle(array) {
  let currentIndex = array.length, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
}
