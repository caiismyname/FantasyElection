import React from 'react';
import './App.css';
import {apiKey, authDomain, databaseURL, projectId, storageBucket, appId, measurementId} from "./firebaseCredentials";
const Firebase = require('firebase/app');
require('firebase/database');
const uuidv4 = require('uuid/v4');

const starterGameState = {
  onlinePlayers: {},
  readyPlayers: {},
  draftCompleted: false, // This is not meant to control the draft. It is used for checks incase the game is visited after the draft is completed
}

const starterDraftState = {
  draftOrder: {}, // FB doesn't store lists natively.
  currentDraftPosition: 0,
}

const draftRounds = 2; // must be even for snake

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

  checkGameId(gameId, successCallback, failureCallback) {
    Firebase.database().ref("/games/" + gameId).once('value').then(function(snapshot) {
      if (snapshot.exists()) {
        successCallback();
      } else {
        failureCallback();
      }
    });
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
    // Generate a draft order
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
      .ref("/games/" + gameId + "/draftState/")
      .set({...draftState});
  }

  endDraft(gameId) {
    Firebase.database()
      .ref("/games/" + gameId + "/gameState/draftCompleted") 
      .set(true);
  }

  subscribeToDraftState(gameId, callback) {
    Firebase.database().ref("/games/" + gameId + "/draftState").on('value', (snapshot) => {
      callback(snapshot.val());
    })
  }

  nextTurn(gameId, nextPosition) {
    Firebase.database()
      .ref("/games/" + gameId + "/draftState/currentDraftPosition")
      .set(nextPosition);
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
      if (!this.props.onlinePlayers[idx]) {
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
            onlinePlayers={this.props.gameState.onlinePlayers}
            playerSelectedHandler={(playerIdx) => this.props.playerSelectedHandler(playerIdx)}
          />
        </div>
      );
     // Once a player is picked, wait for the user to confirm they're ready 
    } else if (!this.props.gameState.readyPlayers[this.props.selfIdx]) {
      return (
        <div>
          <h1> Welcome to the draft {this.props.players[this.props.selfIdx]}. Get ready to beat Trump</h1>
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
            <h1>{this.props.players[this.props.selfIdx]}, you have entered the draft, which will start once everyone joins.</h1>
            <h2>Still missing:</h2>
            <ul>
              {notReady}
            </ul>
          </div>
        );
      } else {
        return (null);
      }
    }
  }
}

class Draft extends React.Component {

  nextTurnHandler() {
    this.props.nextTurnHandler();
  }

  isMyTurn() {
    return this.props.draftState.draftOrder[this.props.draftState.currentDraftPosition] == this.props.selfIdx;
  }

  render() {
    let title = this.isMyTurn() ? <h1>It your turn!</h1> : <h1>It {this.props.players[this.props.draftState.draftOrder[this.props.draftState.currentDraftPosition]]} turn</h1>;
    let nextButton = this.isMyTurn() ? <button onClick={() => this.nextTurnHandler()}>End Turn</button> : null;

    if (this.props.gameState.draftCompleted) {
      return(<h1>The draft is over</h1>);
    }

    return(
      <div>
        {title}
        <UpcomingDraftees draftState={this.props.draftState} players={this.props.players}/>
        {nextButton}
      </div>
    );
  }
}

class UpcomingDraftees extends React.Component {

  render() {
    const draftOrder = this.props.draftState.draftOrder;
    let upcoming = [];
    for (let position = this.props.draftState.currentDraftPosition; position < draftOrder.length; position++) {
      const element = 
        <div 
          style={{
            flex:"1", 
            display:"flex", 
            overflow:"auto",
            border:"1px solid black",
          }}
          key={position}
        >
          {this.props.players[draftOrder[position]]}
        </div>;

      upcoming.push(element);
    }

    return(
      <div
        style={{display:"flex", "flexDirection":"row", "minHeight": "50px"}}
      >
        {upcoming}
      </div>
    );
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
    this.startDraft = this.startDraft.bind(this);
    this.nextTurnHandler = this.nextTurnHandler.bind(this);

    this.state = {
      gameId: "",
      gameState: {...starterGameState},
      players: {
        0: "",
        1: "",
      },
      firebaseManager: new FirebaseManager(),
      dbConnectionStarted: false, // This is set locally, not from FB
      dbDraftConnectionStarted: false, // This also serves as the indicator that the draft has started. This is set locally, not from FB
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

    // Once we have a gameID, we need to start listening for gameState changes
    if (!this.state.dbConnectionStarted) {
      this.startDBConnection(); 
    }

    // Once everyone is ready, start the draft
    let allPlayersReady = this.state.gameState.readyPlayers.length > 0;
    for (let playerIdx in this.state.gameState.readyPlayers) {
      allPlayersReady = allPlayersReady && this.state.gameState.readyPlayers[playerIdx];
    }
    if (allPlayersReady && !this.state.dbDraftConnectionStarted) {
      this.startDraft();
    }

    // Once draft is started, watch for when the draft ends
    if (this.draftHasStarted && !this.state.gameState.draftCompleted) {
      if (this.state.draftState.currentDraftPosition === this.state.draftState.draftOrder.length) {
        this.endDraft();
      }
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

  startDraft() {
    // Note: Every client will try and start the draft.
    // This is how the dbDraftConnectionStarted flag gets set locally.
    // It's technically a race condition, but since the order is random, it doesn't actually matter.

    this.state.firebaseManager.startDraft(this.state.gameId, this.state.players.length);
    this.state.firebaseManager.subscribeToDraftState(this.state.gameId, (newDraftState) => {
      this.setState({draftState: {...newDraftState}, dbDraftConnectionStarted: true});
    });

    // this.setState({dbDraftConnectionStarted: true});
  }

  endDraft() {
    this.state.firebaseManager.endDraft(this.state.gameId);
  }

  draftHasStarted() {
    return this.state.dbDraftConnectionStarted;
  }

  nextTurnHandler() {
    this.state.firebaseManager.nextTurn(this.state.gameId, this.state.draftState.currentDraftPosition + 1);
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
      component = this.draftHasStarted()
        ? <Draft 
            draftState={this.state.draftState}
            gameState={this.state.gameState}
            players={this.state.players}
            selfIdx={this.state.selfIdx}
            nextTurnHandler={() => this.nextTurnHandler()}
          />
        : <PreDraft
            gameId={this.state.gameId}
            selfIdx={this.state.selfIdx}
            playerSelectedHandler={(playerIdx) => this.playerSelectedHandler(playerIdx)}
            playerReadyHandler={() => this.playerReadyHandler()}
            gameState={this.state.gameState}
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
