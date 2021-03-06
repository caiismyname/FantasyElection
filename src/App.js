import React from 'react';
import './App.css';
import {apiKey, authDomain, databaseURL, projectId, storageBucket, appId, measurementId} from "./firebaseCredentials";
import {primaryData} from "./democratic_primary_2020";
import {BrowserRouter} from "react-router-dom";
const Firebase = require('firebase/app');
require('firebase/database');
const uuidv4 = require('uuid/v4');

const starterGameState = {
  onlinePlayers: {}, // Online status is so that users can't double select a player name
  readyPlayers: {},
  draftCompleted: false, // This is not meant to control the draft. It is used for checks incase the game is visited after the draft is completed
}

const starterDraftState = {
  draftOrder: [],
  currentDraftPosition: 0,
  pickerPerPlayer: {}, // Individual clients should always only use the sublist associated with their playerIdx
  availablePicks: {},
}

const draftRounds = 10; // must be even for snake

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
    const blankPicks = {};
    for (let stateIdx in primaryData.states) {
      const state = primaryData.states[stateIdx];
      blankPicks[state.name] = {};
      for (let candidateIdx in primaryData.candidates) {
        const candidate = primaryData.candidates[candidateIdx];
        blankPicks[state.name][candidate] = true;
      }
    }

    Firebase.database()
      .ref("/games/" + gameId + "/draftState/availablePicks")
      .set({...blankPicks});

    Firebase.database().ref("/games/" + gameId + "/draftState").on('value', (snapshot) => {
      callback(snapshot.val());
    })
  }

  nextTurn(gameId, nextPosition) {
    Firebase.database()
      .ref("/games/" + gameId + "/draftState/currentDraftPosition")
      .set(nextPosition);
  }

  submitPick(gameId, playerIdx, candidate, state, newSelfPicks, callback) {
    const availablePicksQueryPath = "/games/" + gameId + "/draftState/availablePicks/" + state + "/" + candidate;
    Firebase.database().ref(availablePicksQueryPath).once('value')
      .then((snapshot) => {
        if (snapshot.exists()) {
          Firebase.database()
            .ref(availablePicksQueryPath)
            .remove();

          Firebase.database()
            .ref("/games/" + gameId + "/draftState/picksPerPlayer/" + playerIdx)
            .set(newSelfPicks);

          callback();
        };
      });
    
  }

  generateFullPicksList(gameId, callback) {
    Firebase.database()
      .ref("/games/" + gameId + "/pickerPerPlayer").once('value')
      .then((snapshot) => callback(snapshot.val()));
  }
}

class OnboardingPage extends React.Component {
  render() {
    return (
      <div>
        <h1>Welcome to Fantasy Elections</h1>
        <div className="BoundingBox">
          <h2><i>Democratic Primaries 2020</i></h2>
          <p style={{textAlign: "left"}}>Play against your friends to draft the candidate+state pairs you think will win each Democratic primary. Then tally up the delegate counts from the states you picked correctly to see who's more in tune with the 2020 Democratic electorate.</p>
        </div>
        
        <div className="BoundingBox">
          <PlayerEntry 
            players={this.props.players}
            addNewPlayerHandler={() => this.props.addNewPlayerHandler()}
            changePlayerNameHandler={(idx, value) => this.props.changePlayerNameHandler(idx, value)}
            deletePlayerHandler={(idx) => this.props.deletePlayerHandler(idx)}
          />
          <div style={{height:"30px"}}></div>
          <button 
            onClick={() => this.props.createNewGameHandler()}
            style={{margin:"0 auto", width: "33%"}}
          >
            Create Game
          </button>

          <p>-- or --</p>
          <GameIdSubmission 
            joinGameHandler={(gameId) => this.props.joinGameHandler(gameId)}
          />
        </div>
      </div>
    );
  }
}

class PlayerEntry extends React.Component {
  render() {
    const playerFields = [];

    for (let playerIdx in this.props.players) {
      const field = 
        <div>
          <textarea 
            style={{border: "1px solid black", width:"95%", fontSize:"1.5vmin", height:"2vmin", resize:"none"}}
            value={this.props.players[playerIdx]}
            onChange={event => {this.props.changePlayerNameHandler(playerIdx, event.target.value)}}
            key={playerIdx}
            placeholder={"Player " + (Number(playerIdx) + 1)}
          />
          <span style={{float:"right", cursor:"grab"}} onClick={() => this.props.deletePlayerHandler(playerIdx)}>X</span>
        </div>;
      playerFields.push(field);
    }

    return(
      <div>
        {playerFields}
        <div 
          onClick={this.props.addNewPlayerHandler} 
          style={{float:"left", display:"inline-block", cursor:"grab"}}
        >
          Add new player
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
          onChange={event => {this.setState({value: event.target.value.trim()})}}
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
          style={{border:"1px solid black", background:"light-gray", marginBottom: "2vh", cursor:"grab"}}
          onClick={() => this.props.playerSelectedHandler(playerIdx)}
        >
          {this.props.players[playerIdx]}
        </div>
      playerSelectors.push(entry);
    }

    return (
      <div className="BoundingBox">
        <h2>Select a player</h2>
        {playerSelectors}
      </div>
    );
  }
}

class PreDraft extends React.Component {

  render() {
    // If no player has been selected, pick a player
    if (this.props.selfIdx === "") {
      return (
        <div>
          <h1>Let's get started</h1>
          <h3>Your Game ID is <span style={{backgroundColor:"#F7FAFC", padding: "5px"}}>{this.props.gameId}</span></h3>
          <h3>Share it with your friends so they can join the draft.</h3>
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
          <h1> Welcome to the draft, {this.props.players[this.props.selfIdx]}</h1>
          <h3>Your Game ID is <span style={{backgroundColor:"#F7FAFC", padding: "5px"}}>{this.props.gameId}</span></h3>
          <h3>Share it with your friends so they can join the draft.</h3>
          <div className="BoundingBox">
            <h3>When you're ready, click the button below to enter the draft. Once you enter, you cannot exit.</h3>
            <button onClick={() => this.props.playerReadyHandler()}>Ready</button>
          </div>
        </div>
      );
    } else {
      const notReady = [];

      for (let idx in this.props.players) {
        if (!this.props.gameState.readyPlayers[idx]) {
          notReady.push(<div key={idx}>{this.props.players[idx]}</div>);
        }
      }

      // If we're still waiting on players to join, show a holding screen
      if (notReady.length != 0) {
        return (
          <div>
            <h1>{this.props.players[this.props.selfIdx]}, you have entered the draft.</h1>
            <h3>Your Game ID is <span style={{backgroundColor:"#F7FAFC", padding: "5px"}}>{this.props.gameId}</span></h3>
            <h3>Share it with your friends so they can join the draft.</h3>
            <div className="BoundingBox">
              <h3>The draft will start once all players have joined.</h3>
              <h3>Still missing:</h3>
              {notReady}
            </div>
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

  generateStatesPerCandidate() {
    const statesPerCandidate = {};

    for (let candidateIdx in primaryData.candidates) {
      statesPerCandidate[candidateIdx] = [];

      for (let stateIdx in this.props.draftState.availablePicks) {
        if (this.candidateName(candidateIdx) in this.props.draftState.availablePicks[stateIdx]) {
          statesPerCandidate[candidateIdx].push(stateIdx);
        }
      }
    }

    return (statesPerCandidate);
  }

  candidateName(idx) {
    return (primaryData.candidates[idx]);
  }

  generateFullPicksList() {
    const fullList = [];
    const currentPickIdxPerPlayer = {}; // Keep track of which of the player's picks we're on

    for (let playerIdx in this.props.players) {
      currentPickIdxPerPlayer[playerIdx] = 0;
    }

    const draftState = this.props.draftState;
    for (let pickNum in draftState.draftOrder) {
      // If we reach the current pick, there are no more picks to display
      if (pickNum >= draftState.currentDraftPosition) {
        break;
      }

      const playerIdx = draftState.draftOrder[pickNum];

      // If we reach a player with no picks, we've reached the end of the list
      if (!(playerIdx in draftState.picksPerPlayer)) {
        break;
      }

      const playerName = this.props.players[playerIdx];
      const pick = {...draftState.picksPerPlayer[playerIdx][currentPickIdxPerPlayer[playerIdx]]};
      pick.prefix = playerName;

      fullList.push(pick);
      currentPickIdxPerPlayer[playerIdx] = currentPickIdxPerPlayer[playerIdx] + 1;
    }

    return (fullList);
  }

  generateSelfPicks() {
    if (this.props.draftState.picksPerPlayer === undefined) {
      return [];
    } else {
      if (!(this.props.selfIdx in this.props.draftState.picksPerPlayer)) {
        return [];
      } else {
        return this.props.draftState.picksPerPlayer[this.props.selfIdx];
      }
    }
  }

  render() {
    let title = this.isMyTurn() ? <h1>It's <u>your</u> turn!</h1> : <h1>It's <u>{this.props.players[this.props.draftState.draftOrder[this.props.draftState.currentDraftPosition]]}'s</u> turn</h1>;

    if (this.props.gameState.draftCompleted) {
      return(
        <div>
          <h1>The draft is over. Thanks for playing!</h1>
          <PicksDisplay
            picks={this.props.draftState.selfPicks}
            titleText={"Your picks"}
          />
        </div>
      );
    }

    return(
      <div>
        {title}
        {this.isMyTurn() ? <img src={require("./your_turn.png")} className="yourTurnImage"/> : null}
        <UpcomingDraftees 
          currentDraftPosition={this.props.draftState.currentDraftPosition}
          draftOrder={this.props.draftState.draftOrder}
          players={this.props.players}
        />
        <div className="BoundingBox" style={{display: "flex", flexDirection: "row"}}>
          <PicksDisplay 
            picks={this.generateSelfPicks()}
            titleText="Your picks"
          />
          <PicksDisplay 
            picks={this.generateFullPicksList()}
            titleText="All picks"
          />
        </div>
        <DraftPicker 
          statesPerCandidate={this.generateStatesPerCandidate()}
          submitPickHandler={(candidate, state) => this.props.submitPickHandler(candidate, state)}
          isMyTurn={this.isMyTurn()}
        />
      </div>
    );
  }
}

class UpcomingDraftees extends React.Component {

  render() {
    let upcoming = [];
    for (let position = this.props.currentDraftPosition; position < this.props.draftOrder.length; position++) {
      const element = 
        <div 
          style={{
            flex:"0 0 120px", 
            display:"flex", 
            overflow:"auto",
            border:"1px solid black",
            padding: "1vh",
            justifyContent:"center", 
            alignItems: "center",
            height: "3vh",
          }}
          key={position}
        >
          {position + 1}. {this.props.players[this.props.draftOrder[position]]}
        </div>;

      upcoming.push(element);
    }

    return(
      <div
        style={{display:"flex", "flexDirection":"row", overflowX: "auto", "minHeight": "50px", justifyContent:"left", alignItems: "center",}}
      >
        {upcoming}
      </div>
    );
  }
}

class PicksDisplay extends React.Component {

  render() {
    const picks = [];
    if (this.props.picks !== []) {
      let counter = 1;
      for (let pickIdx in this.props.picks) {
        const pick = this.props.picks[pickIdx];
        const prefix = "prefix" in this.props.picks[pickIdx] ? this.props.picks[pickIdx].prefix : "";
        picks.push(<div className="picksDisplayElement" key={pick.state}><b>{counter}. {prefix} </b> {pick.state} : {pick.candidate}</div>);
        counter += 1;
      }
    } else {
      return (null);
    }

    return (
      <div className="picksDisplayContainer">
        <h2>{this.props.titleText}</h2>
        <div className="draftPickerContainer">
          {picks}
        </div>
      </div>
    );
  }
}

class DraftPicker extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      selectedCandidateIdx: 0,
      selectedState: "", // This has to be the actual text because indexing on non-complete state lists will result in incorrect names
    }
  }

  candidateName(idx) {
    return (primaryData.candidates[idx]);
  }

  submitPick() {
    this.props.submitPick(this.candidateName(this.state.selectedCandidateIdx), this.state.selectedState);
  }
  
  render() {
    let candidates = [];
    let states = [];
    
    for (let candidateIdx in primaryData.candidates) {
      const cssClass = candidateIdx === this.state.selectedCandidateIdx ? "selectedItem" : "";
      candidates.push(
        <div className={cssClass + " draftPickerElement"} key={candidateIdx} onClick={() => this.setState({selectedCandidateIdx: candidateIdx})}>
          {this.candidateName(candidateIdx)}
        </div>
      );
    }
    for (let state in this.props.statesPerCandidate[this.state.selectedCandidateIdx]) {
      const stateName = this.props.statesPerCandidate[this.state.selectedCandidateIdx][state];
      const cssClass = stateName === this.state.selectedState ? "selectedItem" : "";
      states.push(
        <div className={cssClass + " draftPickerElement stateElement"} key={stateName} onClick={() => this.setState({selectedState: stateName})}>
          {stateName}
        </div>
      );
    }

    let submitButton;
    if (this.props.isMyTurn && this.state.selectedState !== "") {
        submitButton = <button onClick={() => this.props.submitPickHandler(this.candidateName(this.state.selectedCandidateIdx), this.state.selectedState)}>Submit</button> 
    } else {
      submitButton = null;
    }

    // blank text for current pick if no selection has been made, proxied by if a state has been selected
    const currentPick = this.state.selectedState === ""
      ? "--- : ---"
      : this.candidateName(this.state.selectedCandidateIdx) + " : " + this.state.selectedState;

    const delegateCount = this.state.selectedState === ""
      ? "Delegates: --"
      : "Delegates: " + primaryData.delegateCounts[this.state.selectedState];


    return (
      <div className="BoundingBox">
        <h2>Available Picks</h2>
        <div style={{display:"flex", flexDirection: "row", paddingBottom: "1vh"}}>
          <div style={{display:"flex", flexGrow:"1", maxWidth: "50%"}}>
            <img src={require("./candidatePhotos/" + this.candidateName(this.state.selectedCandidateIdx) + ".jpg")} className="candidatePhoto"/>
          </div>
          <div style={{flexGrow:"1", maxWidth:"50%"}}>
            <div><h3>{currentPick}</h3></div>
            <div><h4>{delegateCount}</h4></div>
          </div>
        </div>
        
        <div style={{display: "flex", flexDirection: "row"}}>
          <div className="draftPickerContainer" style={{flexDirection: "column"}}>
            {candidates}
          </div>
          <div className="draftPickerContainer" style={{float: "right"}}>
            {states}
          </div>
        </div>
        {submitButton}
      </div>
    );
  }
}

class App extends React.Component {
  constructor(props) {
    super(props);

    this.addNewPlayer = this.addNewPlayer.bind(this);
    this.changePlayerName = this.changePlayerName.bind(this);
    this.deletePlayer = this.deletePlayer.bind(this);
    this.createNewGame = this.createNewGame.bind(this);
    this.checkAndSetGameId = this.checkAndSetGameId.bind(this);
    this.playerSelectedHandler = this.playerSelectedHandler.bind(this);
    this.startDraft = this.startDraft.bind(this);
    this.nextTurnHandler = this.nextTurnHandler.bind(this);
    this.submitPick = this.submitPick.bind(this);

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
    if (this.draftHasStarted() && !this.state.gameState.draftCompleted) {
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

  deletePlayer(idx) {
    const newPlayers = {...this.state.players};
    delete newPlayers[idx];
    this.setState({players: newPlayers});
  }

  createNewGame() {
    const cleanedPlayers = {...this.state.players}; // removed empty entries
    for (let playerIdx in cleanedPlayers) {
      if (cleanedPlayers[playerIdx] === "") {
        delete cleanedPlayers[playerIdx];
      }
    }
    const gameId = this.state.firebaseManager.createNewGame(cleanedPlayers);
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

  generateSelfPicks() {
    if (this.state.draftState.picksPerPlayer === undefined) {
      return [];
    } else {
      if (!(this.state.selfIdx in this.state.draftState.picksPerPlayer)) {
        return [];
      } else {
        return this.state.draftState.picksPerPlayer[this.state.selfIdx];
      }
    }
  }

  submitPick(candidate, state) {
    const newSelfPicks = this.generateSelfPicks();
    newSelfPicks.push({"candidate": candidate, "state": state}); // key is using `state` as a variable, not putting it in a list
    this.state.firebaseManager.submitPick(this.state.gameId, this.state.selfIdx, candidate, state, newSelfPicks, () => this.nextTurnHandler());
  }

  render() {
    let component; 

    if (this.state.gameId === "") {
      component = 
        <OnboardingPage 
          addNewPlayerHandler={() => this.addNewPlayer()}
          changePlayerNameHandler={(idx, value) => this.changePlayerName(idx, value)}
          deletePlayerHandler={(idx) => this.deletePlayer(idx)}
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
            submitPickHandler={(candidate, state) => this.submitPick(candidate, state)}
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
      <div className="App">
        <div className="Header">
          <b onClick={() => this.setState({gameId: ""})} style={{cursor:"grab"}}>Fantasy Elections:</b> Because This Reality Won't Cut It
        </div>
        {this.state.gameId === "" ? <img src={require("./homepageBanner.jpg")} className="HomepageBanner"></img> : null}
        <div className="Container">
          
          {component}
        </div>
      </div>
    );
  }
}

export default App;
