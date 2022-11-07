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
import { IPlayerOnchainEntity, IPlayerGameEntity } from "../entities/PlayerEntity";
import { disconnectPlayer, getActivePlayersAddresses, getActivePlayersCount, getCollectiblesState, getMaximumPlayersCount, getPlayerBalance, getPlayerCandidatePositionFromStore, getPlayerPos, getPlayerTokens, setPlayerPositionOnchain } from "../gameMethods";
import { IGameEvent } from "../entities/GameEvent";
import { PollTimeout, wait } from "../utils/time";
import { getProviderUrl } from "../utils/massa";
import { ENTITY_TYPE, GameEntityUpdate } from "../entities/GameEntity";
import { ITokenOnchainEntity } from "../entities/TokenEntity";
import {IPropState} from "./RegisterPlayer";
import { Link } from "react-router-dom";
import withRouter from "../utils/withRouter";
import Button from '@mui/material/Button';
import { ICollectedTokenOnchainEntity } from "../entities/CollectedTokenEntity";
import { parseJson } from "../utils/utils";

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
  private readSelfBlockchainPositionTimeout: NodeJS.Timeout | null = null;
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
      playerOnchainState: null,
      playerGameState: null,
      playerBalance: 0,
      playerTokens: 0,
      playerAddress: propState.playerAddress,
      playerName: propState.playerName,
      playerSecretKey: propState.playerSecretKey,
      gameAddress: propState.gameAddress,
      activePlayers: 0,
      maxPlayers: 0,
    };

    this.listenOnGameEvents = this.listenOnGameEvents.bind(this);
    this.updateSelfBlockchainPosition = this.updateSelfBlockchainPosition.bind(this);
    this.readSelfBlockchainPosition = this.readSelfBlockchainPosition.bind(this);
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
          toast(`Error loading wasm. Error = ${(ex as Error).message}!`,{
            className: "toast",
            type: "error"
          });
          isError = true;
          return;
        }
      }
      if (!isError) {
        toast(`Wasm Loaded!`,{
          className: "toast"
        });
      }

      // get player pos and balances
      let playerEntity: IPlayerOnchainEntity|undefined = undefined;
      let playerBalance: number = 0;
      let playerTokens: number = 0;
      try {
        playerEntity = await getPlayerPos(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
        toast(`Player Already Registered!`,{
          className: "toast",
          type: "success"
        });
      } catch (ex) {
        console.error("Error registering player...", ex);
        toast(`Error registering player ${(ex as Error).message}!`,{
          className: "toast",
          type: "error"
        })
      };

      try {
        playerBalance = await getPlayerBalance(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
      } catch (ex) {
        console.error("Error getting player balance...", ex);
      }
      try {
        playerTokens = await getPlayerTokens(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
      } catch (ex) {
        console.error("Error getting player tokens...", ex);
      }

      // send the local player entity to the game engine
      if (playerEntity) {
        const localPlayerGameEntity = new GameEntityUpdate(PLAYER_ADDED, JSON.stringify({...playerEntity, type: ENTITY_TYPE.LOCAL}));
        game.push_game_entity_updates([localPlayerGameEntity]);
      }

      // render in game client initial tokens state
      let tokensInitialState: Array<ITokenOnchainEntity> = [];
      try {
        tokensInitialState = await getCollectiblesState(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
      } catch (ex) {
        console.error("Error getting tokens initial state...", ex);
      }
      const tokensGameUpdate = tokensInitialState.map(tokenEntity => {
        return new GameEntityUpdate(TOKEN_ADDED, JSON.stringify({...tokenEntity, type: ENTITY_TYPE.REMOTE}));
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
        return new GameEntityUpdate(PLAYER_ADDED, JSON.stringify({...remotePlayerState, type: ENTITY_TYPE.REMOTE}));
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
              playerBalance,
              playerTokens,
              playerOnchainState: playerEntity,
              playerGameState: {
                x: playerEntity?.x,
                y: playerEntity?.y,
                rot: playerEntity?.rot,
                w: playerEntity?.w
              } as IPlayerGameEntity
        };
      }, () => {
        // start interval loops
        this.listenOnGameEvents();
        this.updateSelfBlockchainPosition();
        this.readSelfBlockchainPosition();
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
    this.gameEventsPoller.on(ON_MASSA_EVENT_DATA, async (events: Array<IEvent>) => {
      // preserve the events order
      for (const event of events) {
        let gameEvent: IGameEvent|undefined = undefined;
        try {
          gameEvent = JSON.parse(event.data) as IGameEvent;
        } catch (err) {
          console.warn("Ignoring game event...", event);
          continue; // not a proper game event
        }
        if (gameEvent && gameEvent.data) {
          const eventMessageData = gameEvent.data.split("=");
          if (eventMessageData.length !==2) {
            continue
          }
          const eventName = eventMessageData.at(0);
          const eventData = eventMessageData.at(1);
          //console.log("EVENT NAME", eventName);
          //console.log("EVENT DATA", eventData);
          switch (eventName) {
            case PLAYER_MOVED: {

              // try to parse event
              const parsedPlayerEntity = parseJson<IPlayerOnchainEntity>(eventData);
              if (parsedPlayerEntity.isError) {
                console.warn(`Could not parse PLAYER_MOVED event`);
                continue;
              }
              let playerEntityEventData = parsedPlayerEntity.data as IPlayerOnchainEntity;

              // update game engine state
              //const gameEntity = new GameEntityUpdate(PLAYER_MOVED, playerEntity.uuid, playerEntity.address, playerEntity.name, playerEntity.x, playerEntity.y, playerEntity.rot);
              //game.push_game_entity_updates([gameEntity]);

              // in case of the update concerning local player update local player's reported bc coordinates
              const playerOnchainState = this.state.playerOnchainState as IPlayerOnchainEntity;
              if (playerEntityEventData.address === playerOnchainState.address && 
                playerEntityEventData.uuid === playerOnchainState.uuid &&
                playerEntityEventData.name === playerOnchainState.name) {
                this.setState((prevState: IState, _prevProps: IProps) => {
                  return {...prevState,
                    playerOnchainState: {
                      address: playerEntityEventData.address,
                      name: playerEntityEventData.name,
                      uuid: playerEntityEventData.uuid,
                      cbox: playerEntityEventData.cbox,
                      x: playerEntityEventData.x,
                      y: playerEntityEventData.y,
                      rot: playerEntityEventData.rot,
                      w: playerEntityEventData.w}
                    }
                });
              }
              break;
            }
            case PLAYER_ADDED: {
              // try to parse event
              const parsedPlayerAddedEventData = parseJson<IPlayerOnchainEntity>(eventData);
              if (parsedPlayerAddedEventData.isError) {
                console.warn(`Could not parse PLAYER_ADDED event`);
                continue;
              }
              let playerAddedEventData = parsedPlayerAddedEventData.data as IPlayerOnchainEntity;

              // update game engine state
              const gameEntity = new GameEntityUpdate(PLAYER_ADDED, JSON.stringify({...playerAddedEventData, type: ENTITY_TYPE.REMOTE}));
              game.push_game_entity_updates([gameEntity]);

              // start polling player position
              if (!this.remoteBlockchainPositionTimeouts.has(playerAddedEventData.address)) {
                this.remoteBlockchainPositionTimeouts.set(playerAddedEventData.address, new PollTimeout(UPDATE_BLOCKCHAIN_POS_TIMEOUT_DELAY, playerAddedEventData.address, this.updateRemoteBlockchainPosition));
              }
              // increase the players count
              this.setState({
                activePlayers: this.state.activePlayers + 1
              }, () => {
                toast(`Player ${playerAddedEventData.name} just joined!`,{
                  className: "toast"
                });
              });
              break;
            }
            case PLAYER_REMOVED: {
              // try to parse event
              const parsedPlayerRemovedEventData = parseJson<IPlayerOnchainEntity>(eventData);
              if (parsedPlayerRemovedEventData.isError) {
                console.warn(`Could not parse PLAYER_REMOVED event`);
                continue;
              }
              let playerRemovedEventData = parsedPlayerRemovedEventData.data as IPlayerOnchainEntity;

              // update game engine state
              const gameEntity = new GameEntityUpdate(PLAYER_REMOVED, JSON.stringify({...playerRemovedEventData, type: ENTITY_TYPE.REMOTE}));
              game.push_game_entity_updates([gameEntity]);

              // reduce the players count
              this.setState({
                activePlayers: Math.max(this.state.activePlayers - 1, 0)
              }, () => {
                toast(`Player ${playerRemovedEventData.name} disconnected!`,{
                  className: "toast"
                });
              });
              break;
            }
            case TOKEN_COLLECTED: {
              // try to parse event
              const parsedCollectedTokenEvent = parseJson<ICollectedTokenOnchainEntity>(eventData);
              if (parsedCollectedTokenEvent.isError) {
                console.warn(`Could not parse TOKEN_COLLECTED event`);
                continue;
              }
              let collectedTokenEventData = parsedCollectedTokenEvent.data as ICollectedTokenOnchainEntity;

              // push event to game engine
              const gameEntity = new GameEntityUpdate(TOKEN_COLLECTED, eventData as string);
              game.push_game_entity_updates([gameEntity]);

              // check if this update is concerning us or not
              if (collectedTokenEventData.playerUuid === this.state.playerOnchainState?.uuid) {
                let playerTokens: number = 0;
                let playerBalance: number = 0;
                  try {
                    playerBalance = await getPlayerBalance(this.state.web3Client as Client, this.state.gameAddress, this.state.playerAddress);
                    playerTokens = await getPlayerTokens(this.state.web3Client as Client, this.state.gameAddress, this.state.playerAddress);
                  } catch (ex) {
                    console.error("Error getting player tokens...", ex);
                  }

                  this.setState((prevState: IState, _prevProps: IProps) => {
                    return {...prevState, playerTokens, playerBalance }
                  });
              }
              break;
            }
            case TOKEN_ADDED: {
              // try to parse event
              const parsedTokenAddedEvent = parseJson<ITokenOnchainEntity>(eventData);
              if (parsedTokenAddedEvent.isError) {
                console.warn(`Could not parse TOKEN_ADDED event`);
                continue;
              }
              let tokenAddedEventEventData = parsedTokenAddedEvent.data as ITokenOnchainEntity;

              // send event to game engine
              const gameEntity = new GameEntityUpdate(TOKEN_ADDED, JSON.stringify({...tokenAddedEventEventData, type: ENTITY_TYPE.REMOTE}));
              game.push_game_entity_updates([gameEntity]);
              break;
            }
            case TOKEN_REMOVED: {
              // try to parse event
              const parsedTokenRemovedEvent = parseJson<ITokenOnchainEntity>(eventData);
              if (parsedTokenRemovedEvent.isError) {
                console.warn(`Could not parse TOKEN_REMOVED event`);
                continue;
              }
              let tokenRemovedEventEventData = parsedTokenRemovedEvent.data as ITokenOnchainEntity;

              // send event to game engine
              const gameEntity = new GameEntityUpdate(TOKEN_REMOVED, JSON.stringify({...tokenRemovedEventEventData, type: ENTITY_TYPE.REMOTE}));
              game.push_game_entity_updates([gameEntity]);
              break;
            }
            default: {
              console.warn("Unknown event");
            }
          }
        }
      }
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

  readSelfBlockchainPosition = async () => {
    // if there is an already existing watcher, clear it
    if (this.readSelfBlockchainPositionTimeout) {
      clearTimeout(this.readSelfBlockchainPositionTimeout);
    }

    let playerEntity: IPlayerOnchainEntity|undefined = undefined;
    try {
      playerEntity = await getPlayerPos(this.state.web3Client as Client, this.state.gameAddress, this.state.playerAddress);
    } catch (ex) {
      console.error("Error reading player position...", ex);
    };

    // update coors state and then update blockchain
    this.setState((prevState: IState, prevProps: IProps) => {
      return {...prevState, playerOnchainState:
        {
          address: (playerEntity as IPlayerOnchainEntity).address,
          name: (playerEntity as IPlayerOnchainEntity).name,
          uuid: (playerEntity as IPlayerOnchainEntity).uuid,
          cbox: (playerEntity as IPlayerOnchainEntity).cbox,
          x: (playerEntity as IPlayerOnchainEntity).x,
          y: (playerEntity as IPlayerOnchainEntity).y,
          rot: (playerEntity as IPlayerOnchainEntity).rot,
          w: (playerEntity as IPlayerOnchainEntity).w
        }}
    });

    // set a new timeout
    this.readSelfBlockchainPositionTimeout = setTimeout(this.readSelfBlockchainPosition, UPDATE_BLOCKCHAIN_POS_TIMEOUT_DELAY);
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

    // send event to game engine
    if (remotePlayerPos) {
      const gameEntity = new GameEntityUpdate(PLAYER_MOVED, JSON.stringify({...remotePlayerPos, type: ENTITY_TYPE.REMOTE}));
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
      if (this.readSelfBlockchainPositionTimeout) {
        clearTimeout(this.readSelfBlockchainPositionTimeout);
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
        <p>Welcome, {this.state.playerName}! ({this.state.playerAddress.substring(0, 10)}...)</p>
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
                        value={this.state.playerOnchainState ? this.state.playerTokens.toString() : "N/A"}
                        disabled={true}
                        variant="filled"
                    />
                    <TextField
                        id="txt-field-tokens-balance"
                        label="Tokens Balance"
                        value={this.state.playerOnchainState ? this.state.playerBalance.toString() : "N/A"}
                        disabled={true}
                        variant="filled"
                    />
                  </div>
                  <div>
                    <TextField
                        id="txt-field-game-x"
                        label="Game X Pos"
                        value={this.state.playerGameState ? this.state.playerGameState.x.toString() : "N/A"}
                        disabled={true}
                        variant="filled"
                    />
                    <TextField
                        id="txt-field-game-y"
                        label="Game Y Pos"
                        value={this.state.playerGameState ? this.state.playerGameState.y.toString() : "N/A"}
                        disabled={true}
                        variant="filled"
                    />
                    <TextField
                        id="txt-field-game-rot"
                        label="Game Rot Pos"
                        value={this.state.playerGameState ? this.state.playerGameState.rot.toString() : "N/A"}
                        disabled={true}
                        variant="filled"
                    />
                  </div>
                  <div>
                    <TextField
                        id="txt-field-massa-x"
                        label="Massa X Pos"
                        value={this.state.playerOnchainState ? this.state.playerOnchainState.x.toString() : "N/A"}
                        disabled={true}
                        variant="filled"
                    />
                    <TextField
                        id="txt-field-massa-y"
                        label="Massa Y Pos"
                        value={this.state.playerOnchainState ? this.state.playerOnchainState.y.toString() : "N/A"}
                        disabled={true}
                        variant="filled"
                    />
                    <TextField
                        id="txt-field-massa-rot"
                        label="Massa Rot Pos"
                        value={this.state.playerOnchainState ? this.state.playerOnchainState.rot.toString() : "N/A"}
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