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
    Firebase.database().ref(id + "/players").set({...players});
  }

}


class OnboardingPage extends React.Component {
  constructor(props) {
    super(props);

    this.addNewPlayer = this.addNewPlayer.bind(this);
    this.changePlayerName = this.changePlayerName.bind(this);
    this.createNewGame = this.createNewGame.bind(this);

    this.state = {
      players: {
        0: "",
        1: "",
      },
      firebaseManager: new FirebaseManager(),
    }
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
    this.state.firebaseManager.createNewGame(this.state.players);
  }

  render() {
    return (
      <div>
        <h1>Welcome to Fantasy Elections: Democratic Primaries 2020</h1>
        <PlayerEntry 
          players={this.state.players}
          addNewPlayerHandler={() => this.addNewPlayer()}
          changePlayerNameHandler={(idx, value) => this.changePlayerName(idx, value)}
        />
        <button 
          onClick={this.createNewGame}
          style={{margin:"200px 0 0"}}
        >Submit</button>
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
      <div style={{width: "50%", margin: "0 auto"}}>
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

function App() {
  return (
    <div className="App">
      <OnboardingPage />
    </div>
  );
}

export default App;
