import React from 'react';
import './App.css';
import {apiKey, authDomain, databaseURL, projectId, storageBucket, appId, measurementId} from "./firebaseCredentials";
const Firebase = require('firebase/app');
require('firebase/database');
const uuidv4 = require('uuid/v4');

const starterGameState = {
  onlinePlayers: {},
  readyPlayers: {},
  draftStarted: false,
}

const starterDraftState = {
  draftOrder: {}, // FB doesn't store lists natively.
  currentDraftPosition: "",
}

const draftRounds = 8; // must be even for snake

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

class FirebaseManager {
  constructor() {
    const firebaseConfig = {
        apiKey: apiKey,
        authDomain: authDomain,
        databaseURL: databaseURL,
        projectId: projectId,
        storageBucket: storageBucket,
        appId: appId,
        measurementId: measurementId,
      };
    
      Firebase.initializeApp(firebaseConfig);
  }

  createNewGame(players) {
    const id = uuidv4();
    Firebase.database().ref("/games/" + id + "/players").set({...players});

    const populatedGameState = {...starterGameState};
    for (let idx in players) {
      populatedGameState.onlinePlayers[idx] = false;
      populatedGameState.readyPlayers[idx] = false;
    }

    Firebase.database().ref("/games/" + id + "/gameState").set({...populatedGameState});
    
    return (id);
  }

  checkGameId(gameId, successCallback, failureCallback) {
    Firebase.database().ref("/games/" + gameId).once('value').then(function(snapshot) {
      if (snapshot.exists()) {
        successCallback();
      } else {
        failureCallback();
      }
    });
  }

  pullGameUsers(gameId, callback) {
    Firebase.database()
      .ref("/games/" + gameId + "/players").once('value')
      .then((snapshot) => callback(snapshot.val()));
  }

  subscribeToGameState(gameId, callback) {
    Firebase.database().ref("/games/" + gameId + "/gameState").on('value', (snapshot) => {
      callback(snapshot.val());
    })
  }

  playerIsOnline(gameId, playerIdx) {
    Firebase.database()
      .ref("/games/" + gameId + "/gameState/onlinePlayers/" + playerIdx)
      .set(true);
  }

  playerIsReady(gameId, playerIdx) {
    Firebase.database()
      .ref("/games/" + gameId + "/gameState/readyPlayers/" + playerIdx)
      .set(true);
  }

  startDraft(gameId, numPlayers) {
    let forward = [];
    for (let i = 0; i < numPlayers; i++) {
      forward.push(i);
    };

    forward = shuffle(forward);
    let backward = [...forward].reverse();

    let draftOrder = [];
    for (let i = 0; i < draftRounds / 2; i++) {
      draftOrder = draftOrder.concat(forward);
      draftOrder = draftOrder.concat(backward);
    }

    const draftState = {...starterDraftState};
    draftState.draftOrder = draftOrder;
    draftState.currentDraftPosition = 0;

    Firebase.database()
      .ref("/games/" + gameId + "/gameState/draftStarted")
      .set(true);

    Firebase.database()
      .ref("/games/" + gameId + "/draftState/")
      .set({...draftState});
  }

  subscribeToDraftState(gameId, callback) {
    Firebase.database().ref("/games/" + gameId + "/draftState").on('value', (snapshot) => {
      callback(snapshot.val());
    })
  }
}

class OnboardingPage extends React.Component {
  render() {
    return (
      <div>
        <h1>Welcome to Fantasy Elections: Democratic Primaries 2020</h1>
        <PlayerEntry 
          players={this.props.players}
          addNewPlayerHandler={() => this.props.addNewPlayerHandler()}
          changePlayerNameHandler={(idx, value) => this.props.changePlayerNameHandler(idx, value)}
        />
        <button 
          onClick={() => this.props.createNewGameHandler()}
          style={{margin:"50px 0"}}
        >
          Create Game
        </button>
        <GameIdSubmission 
          joinGameHandler={(gameId) => this.props.joinGameHandler(gameId)}
        />
      </div>
    );
  }
}

class PlayerEntry extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const playerFields = [];

    for (let playerIdx in this.props.players) {
      const field = 
        <textarea 
          style={{border: "1px solid black", width:"100%"}}
          value={this.props.players[playerIdx]}
          onChange={event => {this.props.changePlayerNameHandler(playerIdx, event.target.value)}}
          key={playerIdx}
        />;
      playerFields.push(field);
    }

    return(
      <div>
        {playerFields}
        <div 
          onClick={this.props.addNewPlayerHandler} 
        >
          Add new Player
        </div>
      </div>
    );
  }
}

class GameIdSubmission extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      value: "",
    }
  }

  render() {
    const button = 
      this.state.value === "" 
        ? null 
        : <button onClick={() => this.props.joinGameHandler(this.state.value)}>Join Game</button>;
    return (
      <div>
        <textarea 
          placeholder="Enter Game ID to join an existing game"
          style={{border: "1px solid black", width:"100%"}}
          value={this.state.value}
          onChange={event => {this.setState({value: event.target.value})}}
        />
        {button}
      </div>
    );
  }
}

class PlayerSelector extends React.Component {

  render() {
    const availablePlayers = {};
    for (let idx in this.props.players) {
      if (!this.props.readyPlayers[idx]) {
        availablePlayers[idx] = this.props.players[idx];
      }
    }
    
    const playerSelectors = [];
    for (let playerIdx in availablePlayers) {
      const entry = 
        <div 
          key={playerIdx}
          style={{border:"1px solid black", background:"light-gray", margin:"10px 0px"}}
          onClick={() => this.props.playerSelectedHandler(playerIdx)}
        >
          {this.props.players[playerIdx]}
        </div>
      playerSelectors.push(entry);
    }

    return (playerSelectors);
  }
}

class PreDraft extends React.Component {

  render() {
    // If no player has been selected, pick a player
    if (this.props.selfIdx === "") {
      return (
        <div>
          <h1>Welcome to the game</h1>
          <h3>Your Game ID is {this.props.gameId}</h3>
          <PlayerSelector 
            players={this.props.players}
            readyPlayers={this.props.gameState.readyPlayers}
            playerSelectedHandler={(playerIdx) => this.props.playerSelectedHandler(playerIdx)}
          />
        </div>
      );
     // Once a player is picked, wait for the user to confirm they're ready 
    } else if (!this.props.gameState.readyPlayers[this.props.selfIdx]) {
      return (
        <div>
          <h1> Welcome to the draft {this.props.selfName}. Get ready to beat Trump</h1>
          <button onClick={() => this.props.playerReadyHandler()}>Ready</button>
        </div>
      );
    } else {
      const notReady = [];

      for (let idx in this.props.players) {
        if (!this.props.gameState.readyPlayers[idx]) {
          notReady.push(<li key={idx}>{this.props.players[idx]}</li>);
        }
      }

      // If we're still waiting on players to join, show a holding screen
      if (notReady.length != 0) {
        return (
          <div>
            <h1>{this.props.selfName}, you have entered the draft, which will start once everyone joins.</h1>
            <h2>Still missing:</h2>
            <ul>
              {notReady}
            </ul>
          </div>
        );
      // Everyone is ready, so start the draft!
      } else {
        return (
          <div>
            <Draft 
              draftState={this.props.draftState}
              players={this.props.players}
              selfIdx={this.props.selfIdx}
            />
          </div>
        );
      }
    }
  }
}

class Draft extends React.Component {

  render() {
    let component;

    if (this.props.draftState.draftOrder[this.props.draftState.currentDraftPosition] == this.props.selfIdx) {
      component = <div><h1>It your turn!</h1></div>;
    } else {
      component = <div><h1>It {this.props.players[this.props.draftState.currentDraftPosition]} turn</h1></div>;
    }

    return(component);
  }
}

class App extends React.Component {
  constructor(props) {
    super(props);

    this.addNewPlayer = this.addNewPlayer.bind(this);
    this.changePlayerName = this.changePlayerName.bind(this);
    this.createNewGame = this.createNewGame.bind(this);
    this.checkAndSetGameId = this.checkAndSetGameId.bind(this);
    this.playerSelectedHandler = this.playerSelectedHandler.bind(this);

    this.state = {
      gameId: "",
      gameState: {...starterGameState},
      players: {
        0: "",
        1: "",
      },
      firebaseManager: new FirebaseManager(),
      dbConnectionStarted: false,
      dbDraftConnectionStarted: false,
      draftState: {...starterDraftState},
      selfIdx: "",
      selfName: "",
    }
  }

  componentDidUpdate() {
    // None of this matters if we haven't gotten into a game yet
    if (this.state.gameId === "") {
      return;
    }

    if (!this.state.dbConnectionStarted) {
      this.startDBConnection(); 
    }

    let allReady = true && this.state.gameState.readyPlayers.length > 0;
    for (let idx in this.state.gameState.readyPlayers) {
      allReady = allReady && this.state.gameState.readyPlayers[idx];
    }

    if (allReady) {
      this.state.firebaseManager.startDraft(this.state.gameId, this.state.players.length);
    }

    if (this.state.gameState.draftStarted && !this.state.dbDraftConnectionStarted) {
      this.state.firebaseManager.subscribeToDraftState(this.state.gameId, (newDraftState) => {
        this.setState({draftState: {...newDraftState}, dbDraftConnectionStarted: true});
      });
    }
  }
 
  checkAndSetGameId(gameId) {
    this.state.firebaseManager.checkGameId(
      gameId,
      () => this.setState({gameId: gameId}),
      () => alert("Game ID not valid")
    );
  }

  addNewPlayer() {
    const newPlayerIndex = Object.keys(this.state.players).length;
    const newPlayers = {...this.state.players};
    newPlayers[newPlayerIndex] = "";
    this.setState({players: newPlayers});
  }

  changePlayerName(idx, value) {
    const newPlayers = {...this.state.players};
    newPlayers[idx] = value;
    this.setState({players: newPlayers});
  }

  createNewGame() {
    const gameId = this.state.firebaseManager.createNewGame(this.state.players);
    this.setState({gameId: gameId});
  }

  startDBConnection() {
    if (this.state.dbConnectionStarted) {
      return;
    }

    // Get users from firebase
    this.state.firebaseManager.pullGameUsers(this.state.gameId, (players) => {
      this.setState({players: players})
    })

    // Connect FB listeners with React state
    this.state.firebaseManager.subscribeToGameState(this.state.gameId, (newGameState) => {
      this.setState({gameState: {...newGameState}});
    });

    this.setState({dbConnectionStarted: true});
  }

  playerSelectedHandler(playerIdx) {
    this.setState({selfIdx: playerIdx, selfName: this.state.players[playerIdx]});
    this.state.firebaseManager.playerIsOnline(this.state.gameId, playerIdx);
  }

  playerReadyHandler() {
    this.state.firebaseManager.playerIsReady(this.state.gameId, this.state.selfIdx);
  }

  render() {
    let component; 

    if (this.state.gameId === "") {
      component = 
        <OnboardingPage 
          addNewPlayerHandler={() => this.addNewPlayer()}
          changePlayerNameHandler={(idx, value) => this.changePlayerName(idx, value)}
          createNewGameHandler={() => this.createNewGame()}
          joinGameHandler={(gameId) => this.checkAndSetGameId(gameId)}
          players={this.state.players}
        />;
    } else {
      component = 
        <PreDraft
          gameId={this.state.gameId}
          selfName={this.state.selfName}
          selfIdx={this.state.selfIdx}
          playerSelectedHandler={(playerIdx) => this.playerSelectedHandler(playerIdx)}
          playerReadyHandler={() => this.playerReadyHandler()}
          gameState={this.state.gameState}
          draftState={this.state.draftState}
          players={this.state.players}
        />;
    }
    return (
      <div className="App" style={{width: "50%", margin: "0 auto"}}>
        {component}
      </div>
    );
  }
}

export default App;
