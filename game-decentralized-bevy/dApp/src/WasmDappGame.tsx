import React from "react";
import './App.css';
import 'react-toastify/dist/ReactToastify.css';
import type {} from '@mui/lab/themeAugmentation';
import { Client, EventPoller, IAccount, IEvent, IEventRegexFilter, INodeStatus, ON_MASSA_EVENT_DATA, ON_MASSA_EVENT_ERROR } from "@massalabs/massa-web3";
import TextField from '@mui/material/TextField';
import * as game from "starship";
import Box from '@mui/material/Box';
import LoadingOverlay from 'react-loading-overlay-ts';
import { ToastContainer, toast } from 'react-toastify';
import { ClientFactory, WalletClient } from "@massalabs/massa-web3";
import { IPlayerOnchainEntity, IPlayerGameEntity } from "./PlayerEntity";
import { disconnectPlayer, getActivePlayersAddresses, getActivePlayersCount, getCollectiblesState, getMaximumPlayersCount, getPlayerCandidatePositionFromStore, getPlayerPos, setPlayerPositionOnchain } from "./gameFunctions";
import { IGameEvent } from "./GameEvent";
import { getProviderUrl, PollTimeout, wait } from "./utils";
import { GameEntityUpdate } from "./GameEntity";
import { ITokenOnchainEntity } from "./TokenEntity";
import {IPropState} from "./RegisterPlayer";
import { Link } from "react-router-dom";
import withRouter from "./withRouter";
import Button from '@mui/material/Button';

// game player events
const PLAYER_MOVED = "PLAYER_MOVED";
const PLAYER_ADDED = "PLAYER_ADDED";
const PLAYER_REMOVED = "PLAYER_REMOVED";

// game token events
const TOKEN_ADDED = "TOKEN_ADDED";
const TOKEN_REMOVED = "TOKEN_REMOVED";
const TOKEN_COLLECTED = "TOKEN_COLLECTED";

// settings consts
const UPDATE_BLOCKCHAIN_POS_TIMEOUT_DELAY = 200; // ms = 0.5 secs. Every half a sec update the player pos on chain
const GAME_EVENTS_POLLING_INTERVAL = 300; // 500 ms = 0.5 sec.
const REMOTE_PLAYERS_POLLING_INTERVAL = 300;
const SCREEN_WIDTH = 1000; //px
const SCREEN_HEIGHT = 500; //px

interface IProps {}

export interface IState {
  wasmError: Error | null;
  wasm: game.InitOutput | null;
  isLoading: boolean,
  isPlayerRegistered: boolean;
  isDisconnecting: boolean;
  networkName: string;
  playerSecretKey: string;
  playerAddress: string;
  playerBalance: number;
  playerTokens: number;
  playerName: string;
  playerOnchainState: IPlayerOnchainEntity | null | undefined;
  playerGameState: IPlayerGameEntity | null | undefined;
  web3Client: Client | null;
  threadAddressesMap: Map<string, IAccount>;
  gameAddress: string;
  activePlayers: number;
  maxPlayers: number;
}

class WasmDappExample extends React.Component<IProps, IState> {
  private updateSelfBlockchainPositionTimeout: NodeJS.Timeout | null = null;
  private remoteBlockchainPositionTimeouts: Map<string, PollTimeout> = new Map<string, PollTimeout>();
  private gameEventsPoller: EventPoller | null = null;

  constructor(props: IProps) {
    super(props);

    const propState = ((this.props as any).location).state as IPropState;

    this.state = {
      wasmError: null,
      wasm: null,
      isLoading: true,
      web3Client: null,
      isDisconnecting: false,
      networkName: propState.networkName,
      threadAddressesMap: new Map<string, IAccount>(Object.entries(propState.threadAddressesMap)),
      isPlayerRegistered: propState.isPlayerRegistered,
      playerOnchainState: propState.playerOnchainState,
      playerGameState: null,
      playerBalance: propState.playerBalance,
      playerTokens: propState.playerTokens,
      playerAddress: propState.playerAddress,
      playerName: propState.playerName,
      playerSecretKey: propState.playerSecretKey,
      gameAddress: propState.gameAddress,
      activePlayers: 0,
      maxPlayers: 0,
    };

    this.listenOnGameEvents = this.listenOnGameEvents.bind(this);
    this.updateSelfBlockchainPosition = this.updateSelfBlockchainPosition.bind(this);
    this.updateRemoteBlockchainPosition = this.updateRemoteBlockchainPosition.bind(this);
    this.disconnectPlayer = this.disconnectPlayer.bind(this);
  }

  async componentDidMount(): Promise<void> {

    if (this.state.isPlayerRegistered) {

      // create a new base account
      let web3Client: Client|null = null;
      try {
        const baseAccount = await WalletClient.getAccountFromSecretKey(this.state.playerSecretKey);
        web3Client = await ClientFactory.createCustomClient(getProviderUrl(this.state.networkName), true, baseAccount);
      } catch (ex) {
        console.error(`Error loading web3 client`, ex);
      }
      console.log("Web3 loaded!");

      // load wasm
      let wasm: game.InitOutput|null = null;
      let isError = false;
      try {
        wasm = await game.default();
      } catch (ex) {
        if (!(ex as Error).message.includes("This isn't actually an error!")) {
          console.error(`Error loading wasm`, (ex as Error).message);
          isError = true;
        }
      }
      if (!isError) {
        toast(`Wasm Loaded!`,{
          className: "toast"
        });
      }

      // render in game client initial tokens state
      let tokensInitialState: Array<ITokenOnchainEntity> = [];
      try {
        tokensInitialState = await getCollectiblesState(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
      } catch (ex) {
        console.error("Error getting tokens initial state...", ex);
      }
      const tokensGameUpdate = tokensInitialState.map(tokenEntity => {
        const gameEntity = new GameEntityUpdate(TOKEN_ADDED, tokenEntity.uuid, "N/A", "N/A", tokenEntity.x, tokenEntity.y, 0.0, 0.0);
        return gameEntity;
      })
      if (tokensGameUpdate.length > 0) { game.push_game_entity_updates(tokensGameUpdate); }

      // get connected players
      let maxPlayers: number = 0;
      let activePlayers: number = 0;
      try {
        activePlayers = await getActivePlayersCount(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
        maxPlayers = await getMaximumPlayersCount(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
      } catch (ex) {
        console.error("Error getting players count data...", ex);
      }

      // get connected players addresses
      let connectedPlayers: Array<string> = [];
      try {
        connectedPlayers = await getActivePlayersAddresses(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
      } catch (ex) {
        console.error("Error getting connected players data...", ex);
      }
      // filter only for the remote players
      const remotePlayersOnly = connectedPlayers.filter((addr) => ((addr !== "") && (addr !== this.state.playerAddress)));

      // get remote players states
      const statePromises: Promise<IPlayerOnchainEntity>[] = remotePlayersOnly.map((addr) => {
        return getPlayerPos(web3Client as Client, this.state.gameAddress, addr)
      });
      let remotePlayersStates: Array<IPlayerOnchainEntity> = [];
      try {
        remotePlayersStates = await Promise.all(statePromises);
      } catch (ex) {
        console.error("Error getting remote player states...", ex);
      }

      // render remote players states
      const remotePlayersStatesUpdate = remotePlayersStates.map(remotePlayerState => {
        const gameEntity = new GameEntityUpdate(PLAYER_ADDED, remotePlayerState.uuid, remotePlayerState.address, remotePlayerState.name, remotePlayerState.x, remotePlayerState.y, remotePlayerState.rot, remotePlayerState.w);
        return gameEntity;
      })
      game.push_game_entity_updates(remotePlayersStatesUpdate);

      // start polling the remote addresses positions
      remotePlayersStates.forEach((remotePlayerState) => {
        if (!this.remoteBlockchainPositionTimeouts.has(remotePlayerState.address)) {
          this.remoteBlockchainPositionTimeouts.set(remotePlayerState.address, new PollTimeout(REMOTE_PLAYERS_POLLING_INTERVAL, remotePlayerState.address, this.updateRemoteBlockchainPosition));
        }
      });

      // update react state
      this.setState((prevState: IState, _prevProps: IProps) => {
        return { ...prevState,
              wasm,
              isLoading: false,
              web3Client,
              activePlayers,
              maxPlayers,
              playerGameState: {
                x: this.state.playerOnchainState?.x,
                y: this.state.playerOnchainState?.y,
                rot: this.state.playerOnchainState?.rot
              } as IPlayerGameEntity
        };
      }, () => {
        // start interval loops
        this.listenOnGameEvents();
        this.updateSelfBlockchainPosition();
        toast(`Ready GO!`,{
          className: "toast"
        });
      });
    }
  }
  
  async listenOnGameEvents(): Promise<void> {

    // determine the last slot
    let nodeStatusInfo: INodeStatus|null|undefined = null;
    try {
      nodeStatusInfo = await (this.state.web3Client as Client).publicApi().getNodeStatus();
    } catch(ex) {
      console.log("Error getting node status");
      throw ex;
    }

    const eventsFilter = {
      start: (nodeStatusInfo as INodeStatus).last_slot, // start filtering only from the last slot which was processed onwards
      end: null,
      original_operation_id: null,
      original_caller_address: null,
      emitter_address: this.state.gameAddress,
      eventsNameRegex: null,
      is_final: true // only listen for final game events here
    } as IEventRegexFilter;

    this.gameEventsPoller = EventPoller.startEventsPolling(
      eventsFilter,
      GAME_EVENTS_POLLING_INTERVAL,
      this.state.web3Client as Client
    );
    this.gameEventsPoller.on(ON_MASSA_EVENT_DATA, (events: Array<IEvent>) => {
      // preserve the events order
      events.forEach(update => {
        let gameEvent: IGameEvent|undefined = undefined;
        try {
          gameEvent = JSON.parse(update.data) as IGameEvent;
        } catch (err) {
          console.error("Error parsing game event", update.data);
        }
        if (gameEvent) {
          const eventMessageData = gameEvent?.data.split("=");
          const eventName = eventMessageData.at(0);
          const eventData = eventMessageData.at(1);
          //console.log("EVENT NAME", eventName);
          //console.log("EVENT DATA", eventData);
          switch (eventName) {
            case PLAYER_MOVED: {
              const playerEntity: IPlayerOnchainEntity = JSON.parse(eventData as string);

              // update game engine state
              //const gameEntity = new GameEntityUpdate(PLAYER_MOVED, playerEntity.uuid, playerEntity.address, playerEntity.name, playerEntity.x, playerEntity.y, playerEntity.rot);
              //game.push_game_entity_updates([gameEntity]);

              // in case of the update concerning local player update local player's reported bc coordinates
              const playerOnchainState = this.state.playerOnchainState as IPlayerOnchainEntity;
              if ((playerEntity as IPlayerOnchainEntity).address === playerOnchainState.address && 
              (playerEntity as IPlayerOnchainEntity).uuid === playerOnchainState.uuid &&
              (playerEntity as IPlayerOnchainEntity).name === playerOnchainState.name) {
                this.setState((prevState: IState, _prevProps: IProps) => {
                  return {...prevState,
                    playerOnchainState: {
                      address: playerEntity.address,
                      name: playerEntity.name,
                      uuid: playerEntity.uuid,
                      cbox: playerEntity.cbox,
                      x: playerEntity.x,
                      y: playerEntity.y,
                      rot: playerEntity.rot,
                      w: playerEntity.w}
                    }
                });
              }
              break;
            }
            case PLAYER_ADDED: {
              const playerEntity: IPlayerOnchainEntity = JSON.parse(eventData as string);
              console.log("Player added ", playerEntity);
              // update game engine state
              const gameEntity = new GameEntityUpdate(PLAYER_ADDED, playerEntity.uuid, playerEntity.address, playerEntity.name, playerEntity.x, playerEntity.y, playerEntity.rot, playerEntity.w);
              game.push_game_entity_updates([gameEntity]);
              // start polling player position
              if (!this.remoteBlockchainPositionTimeouts.has(playerEntity.address)) {
                this.remoteBlockchainPositionTimeouts.set(playerEntity.address, new PollTimeout(UPDATE_BLOCKCHAIN_POS_TIMEOUT_DELAY, playerEntity.address, this.updateRemoteBlockchainPosition));
              }
              this.setState({
                activePlayers: this.state.activePlayers + 1
              });
              toast(`Player ${playerEntity.name} just joined!`,{
                className: "toast"
              });
              break;
            }
            case PLAYER_REMOVED: {
              const playerEntity: IPlayerOnchainEntity = JSON.parse(eventData as string);
              console.log("Player removed ", playerEntity);
              // update game engine state
              const gameEntity = new GameEntityUpdate(PLAYER_REMOVED, playerEntity.uuid, playerEntity.address, playerEntity.name, playerEntity.x, playerEntity.y, playerEntity.rot, playerEntity.w);
              game.push_game_entity_updates([gameEntity]);
              toast(`Player ${playerEntity.name} disconnected!`,{
                className: "toast"
              });
              this.setState({
                activePlayers: Math.max(this.state.activePlayers - 1, 0)
              });
              break;
            }
            case TOKEN_COLLECTED: {
              //console.log("Token collected ");
              break;
            }
            case TOKEN_ADDED: {
              const tokenEntity: ITokenOnchainEntity = JSON.parse(eventData as string);
              const gameEntity = new GameEntityUpdate(TOKEN_ADDED, tokenEntity.uuid, "N/A", "N/A", tokenEntity.x, tokenEntity.y, 0.0, 0.0);
              game.push_game_entity_updates([gameEntity]);
              break;
            }
            case TOKEN_REMOVED: {
              const tokenEntity: ITokenOnchainEntity = JSON.parse(eventData as string);
              const gameEntity = new GameEntityUpdate(TOKEN_REMOVED, tokenEntity.uuid, "N/A", "N/A", tokenEntity.x, tokenEntity.y, 0.0, 0.0);
              game.push_game_entity_updates([gameEntity]);
              break;
            }
            default: {
              console.log("Unknown event");
            }
          }
        }
      });
    });
    this.gameEventsPoller.on(ON_MASSA_EVENT_ERROR, (ex) => console.log("ERROR ", ex));
  }

  updateSelfBlockchainPosition = async () => {
    // if there is an already existing watcher, clear it
    if (this.updateSelfBlockchainPositionTimeout) {
      clearTimeout(this.updateSelfBlockchainPositionTimeout);
    }

    // get coors from wasm
    const newX = game.get_player_x();
    const newY = game.get_player_y();
    const newRot = game.get_player_rot();
    const newW = game.get_player_w();

    // update coors state and then update blockchain
    this.setState((prevState: IState, prevProps: IProps) => {
      return {...prevState, playerGameState: {x: newX, y: newY, rot: newRot, w: newW}}
    }, async () => {
      //console.log("Updating Blockchain Coords to...", newX, newY, newRot);
      const playerUpdate = { ...this.state.playerOnchainState, x: newX, y: newY, rot: newRot, w: newW } as IPlayerOnchainEntity;
      await setPlayerPositionOnchain(this.state.web3Client as Client, this.state.gameAddress, this.state.threadAddressesMap, playerUpdate);
    });

    // set a new timeout
    this.updateSelfBlockchainPositionTimeout = setTimeout(this.updateSelfBlockchainPosition, UPDATE_BLOCKCHAIN_POS_TIMEOUT_DELAY);
  }

  disconnectPlayer = async () => {
    this.setState({isDisconnecting: true});
    try {
      await disconnectPlayer(this.state.web3Client as Client, this.state.gameAddress, this.state.playerAddress);
    } catch (ex) {
      console.error("Error disconnecting player...", ex);
    }
    this.setState({isDisconnecting: false, isPlayerRegistered: false});
  }

  updateRemoteBlockchainPosition = async (playerAddress: string) => {
    // if there is an already existing watcher, clear it
    const timeout: PollTimeout | undefined = this.remoteBlockchainPositionTimeouts.get(playerAddress);
    if (timeout) {
      timeout.clear();
    }

    // get coors from blockchain
    let remotePlayerPos: IPlayerOnchainEntity | null = null;
    try {
      remotePlayerPos = await getPlayerCandidatePositionFromStore(this.state.web3Client as Client, this.state.gameAddress, playerAddress);
    } catch (ex) {
      console.error(`Error getting remote player position`, ex);
    }

    if (remotePlayerPos) {
      const gameEntity = new GameEntityUpdate(PLAYER_MOVED, remotePlayerPos.uuid, remotePlayerPos.address, remotePlayerPos.name, remotePlayerPos.x, remotePlayerPos.y, remotePlayerPos.rot, remotePlayerPos.w);
      game.push_game_entity_updates([gameEntity]);
    }

    // set a new timeout
    this.remoteBlockchainPositionTimeouts.set(playerAddress, new PollTimeout(UPDATE_BLOCKCHAIN_POS_TIMEOUT_DELAY, playerAddress, this.updateRemoteBlockchainPosition));
  }

  componentWillUnmount(): void {
    let tries = 0;
    while (tries < 3) {
      if (this.gameEventsPoller) {
        this.gameEventsPoller.stopPolling();
      }
      if (this.updateSelfBlockchainPositionTimeout) {
        clearTimeout(this.updateSelfBlockchainPositionTimeout);
      }
      this.remoteBlockchainPositionTimeouts.forEach(timeout => timeout.clear());
      wait(500);
      tries++;
    }
  }

  render(): JSX.Element {

    if (this.state.isPlayerRegistered) {

      if (this.state.isDisconnecting) {
      
        return (<LoadingOverlay
          active={true}
          spinner
          text='Disconnecting player...'
          className="overlay"
        ></LoadingOverlay>)

        } else {
      
      return (<React.Fragment>
        <ToastContainer />
        <p>Welcome, {this.state.playerName}!</p>
        <Button variant="contained" onClick={this.disconnectPlayer}>Disconnect</Button>
        <hr />
        <LoadingOverlay
              active={this.state.isLoading}
              spinner
              text='Loading Starship Game...'
              className="overlay"
            >
              <canvas id="game" className="game" width={SCREEN_WIDTH} height={SCREEN_HEIGHT}/>
              <Box
                  component="form"
                  sx={{
                    '& .MuiTextField-root': { m: 1, width: '25ch' },
                  }}
                  noValidate
                  autoComplete="off"
                  bgcolor="primary.main"
                >
                  <div>
                    <TextField
                        id="txt-field-tokens-collected"
                        label="Active players"
                        value={`${this.state.activePlayers}/${this.state.maxPlayers}`}
                        disabled={true}
                        variant="filled"
                    />
                  </div>
                  <div>
                    <TextField
                        id="txt-field-tokens-collected"
                        label="Tokens Collected"
                        value={this.state.playerOnchainState ? this.state.playerTokens : "0"}
                        disabled={true}
                        variant="filled"
                    />
                    <TextField
                        id="txt-field-tokens-balance"
                        label="Tokens Balance"
                        value={this.state.playerOnchainState ? this.state.playerBalance : "0.0"}
                        disabled={true}
                        variant="filled"
                    />
                  </div>
                  <div>
                    <TextField
                        id="txt-field-game-x"
                        label="Game X Pos"
                        value={this.state.playerGameState ? this.state.playerGameState.x : "0.0"}
                        disabled={true}
                        variant="filled"
                    />
                    <TextField
                        id="txt-field-game-y"
                        label="Game Y Pos"
                        value={this.state.playerGameState ? this.state.playerGameState.y : "0.0"}
                        disabled={true}
                        variant="filled"
                    />
                    <TextField
                        id="txt-field-game-rot"
                        label="Game Rot Pos"
                        value={this.state.playerGameState ? this.state.playerGameState.rot : "0.0"}
                        disabled={true}
                        variant="filled"
                    />
                  </div>
                  <div>
                    <TextField
                        id="txt-field-massa-x"
                        label="Massa X Pos"
                        value={this.state.playerOnchainState ? this.state.playerOnchainState.x : "0.0"}
                        disabled={true}
                        variant="filled"
                    />
                    <TextField
                        id="txt-field-massa-y"
                        label="Massa Y Pos"
                        value={this.state.playerOnchainState ? this.state.playerOnchainState.y : "0.0"}
                        disabled={true}
                        variant="filled"
                    />
                    <TextField
                        id="txt-field-massa-rot"
                        label="Massa Rot Pos"
                        value={this.state.playerOnchainState ? this.state.playerOnchainState.rot : "0.0"}
                        disabled={true}
                        variant="filled"
                    />
                  </div>
              </Box>
            </LoadingOverlay>
        </React.Fragment>
      )}
    } else {
      return <Link to={`/`}>Please register your player!</Link>
    }
  }
}
export default withRouter(WasmDappExample);