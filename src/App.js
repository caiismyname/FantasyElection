import React from 'react';
import './App.css';
import {apiKey, authDomain, databaseURL, projectId, storageBucket, appId, measurementId} from "./firebaseCredentials";
const Firebase = require('firebase/app');
require('firebase/database');
const uuidv4 = require('uuid/v4');

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
    return (id);
  }

  checkGameId(gameId, successCallback, failureCallback) {
    Firebase.database().ref("/games/" + gameId).once('value').then(function(snapshot) {
      if (snapshot.val() != null) {
        successCallback();
      } else {
        failureCallback();
      }
    });
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

class App extends React.Component {
  constructor(props) {
    super(props);

    this.addNewPlayer = this.addNewPlayer.bind(this);
    this.changePlayerName = this.changePlayerName.bind(this);
    this.createNewGame = this.createNewGame.bind(this);
    this.checkAndSetGameId = this.checkAndSetGameId.bind(this);

    this.state = {
      gameId: "",
      gameState: {
        allPlayersOnline: false,
        allPlayersReady: false,
        draftStarted: false,
      },
      players: {
        0: "",
        1: "",
      },
      firebaseManager: new FirebaseManager(),
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
      component = <h1>Here's the game</h1>;
    }
    return (
      <div className="App" style={{width: "50%", margin: "0 auto"}}>
        {component}
      </div>
    );
  }
}

export default App;
