import React from 'react';
// import logo from './logo.svg';
import './App.css';

class OnboardingPage extends React.Component {


  render() {
    return (
      <div>
        <h1>Welcome to Fantasy Elections: Democratic Primaries 2020</h1>
        <PlayerEntry />
      </div>
    );
  }
}

class PlayerEntry extends React.Component {
  constructor(props) {
    super(props);

    this.addNewPlayer = this.addNewPlayer.bind(this);

    this.state = {
      players: {
        0: "",
        1: "",
      }
    }
  }

  textChangeHandler(idx, value) {
    const newPlayers = {...this.state.players};
    newPlayers[idx] = value;
    this.setState({players: newPlayers});
  }

  addNewPlayer() {
    const newPlayerIndex = Object.keys(this.state.players).length;
    const newPlayers = {...this.state.players};
    newPlayers[newPlayerIndex] = "";
    this.setState({players: newPlayers});
  }

  render() {
    const playerFields = [];

    for (let playerIdx in this.state.players) {
      const field = 
        <textarea 
          style={{border: "1px solid black", width:"100%"}}
          value={this.state.players[playerIdx]}
          onChange={event => {this.textChangeHandler(playerIdx, event.target.value)}}
          key={playerIdx}
        />;
      playerFields.push(field);
    }

    return(
      <div style={{width: "50%", margin: "0 auto"}}>
        {playerFields}
        <div 
          onClick={this.addNewPlayer} 
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
