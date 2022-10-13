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
import { getActivePlayersCount, getMaximumPlayersCount, setPlayerPositionOnchain } from "./gameFunctions";
import { IGameEvent } from "./GameEvent";
import { getProviderUrl } from "./utils";
import { GameEntityUpdate } from "./GameEntity";
import { ITokenOnchainEntity } from "./TokenEntity";
import {IPropState} from "./RegisterPlayer";
import { Link } from "react-router-dom";
import withRouter from "./withRouter";

// game player events
const PLAYER_MOVED = "PLAYER_MOVED";
const PLAYER_ADDED = "PLAYER_ADDED";
const PLAYER_REMOVED = "PLAYER_REMOVED";

// game token events
const TOKEN_ADDED = "TOKEN_ADDED";
const TOKEN_REMOVED = "TOKEN_REMOVED";
const TOKEN_COLLECTED = "TOKEN_COLLECTED";

// settings consts
const UPDATE_BLOCKCHAIN_POS_TIMEOUT_DELAY = 500; // ms = 0.5 secs. Every half a sec update the player pos on chain
const GAME_EVENTS_POLLING_INTERVAL = 100; // 500 ms = 0.5 sec.
const SCREEN_WIDTH = 1000; //px
const SCREEN_HEIGHT = 500; //px

interface IProps {}
export interface IState {
  wasmError: Error | null;
  wasm: game.InitOutput | null;
  isLoading: boolean,
  isPlayerRegistered: boolean;
  networkName: string;
  playerSecretKey: string;
  playerAddress: string;
  playerBalance: number;
  playerTokens: number;
  playerOnchainState: IPlayerOnchainEntity | null | undefined;
  playerGameState: IPlayerGameEntity | null | undefined;
  web3Client: Client | null;
  threadAddressesMap: Map<string, IAccount>;
  gameAddress: string;
  tokensInitialState: Array<ITokenOnchainEntity>;
  activePlayers: number;
  maxPlayers: number;
}

class WasmDappExample extends React.Component<IProps, IState> {
  private updateBlockchainPositionTimeout: NodeJS.Timeout | null = null;
  private gameEventsPoller: EventPoller | null = null;

  constructor(props: IProps) {
    super(props);

    const propState = ((this.props as any).location).state as IPropState;

    this.state = {
      wasmError: null,
      wasm: null,
      isLoading: true,
      web3Client: null,
      networkName: propState.networkName,
      threadAddressesMap: new Map<string, IAccount>(Object.entries(propState.threadAddressesMap)),
      isPlayerRegistered: propState.isPlayerRegistered,
      playerOnchainState: propState.playerOnchainState,
      playerGameState: null,
      playerBalance: propState.playerBalance,
      playerTokens: propState.playerTokens,
      playerAddress: propState.playerAddress,
      playerSecretKey: propState.playerSecretKey,
      gameAddress: propState.gameAddress,
      tokensInitialState: propState.tokensInitialState,
      activePlayers: 0,
      maxPlayers: 0,
    };

    this.listenOnGameEvents = this.listenOnGameEvents.bind(this);
    this.updateBlockchainPosition = this.updateBlockchainPosition.bind(this);
  }

  async componentDidMount(): Promise<void> {

    const propState = ((this.props as any).location).state;
    console.log(propState);
    if (propState && propState.isPlayerRegistered) {

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
        console.error(`Error loading wasm`, (ex as Error).message);
        if (!(ex as Error).message.includes("This isn't actually an error!")) {
          isError = true;
        }
      }
      if (!isError) {
        toast(`Wasm Loaded!`,{
          className: "toast"
        });
      }

      const tokensGameUpdate = this.state.tokensInitialState.map(tokenEntity => {
        const gameEntity = new GameEntityUpdate(TOKEN_ADDED, tokenEntity.uuid, "N/A", tokenEntity.x, tokenEntity.y, 0.0);
        return gameEntity;
      })
      game.push_game_entity_updates(tokensGameUpdate);

      let maxPlayers: number = 0;
      let activePlayers: number = 0;
      try {
        activePlayers = await getActivePlayersCount(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
        maxPlayers = await getMaximumPlayersCount(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
      } catch (ex) {
        console.error("Error getting players count data...", ex);
      }

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
        this.updateBlockchainPosition();
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
              //console.log("Player moved ", playerEntity);
              // update game engine state
              const gameEntity = new GameEntityUpdate(PLAYER_MOVED, playerEntity.uuid, playerEntity.address, playerEntity.x, playerEntity.y, playerEntity.rot);
              game.push_game_entity_updates([gameEntity]);

              // in case of the update concerning local player update local player's reported bc coordinates
              const playerOnchainState = this.state.playerOnchainState as IPlayerOnchainEntity;
              if ((playerEntity as IPlayerOnchainEntity).address === playerOnchainState.address && 
              (playerEntity as IPlayerOnchainEntity).uuid === playerOnchainState.uuid) {
                  this.setState((prevState: IState, _prevProps: IProps) => {
                    return {...prevState,
                      playerOnchainState: {
                        address: playerEntity.address,
                        uuid: playerEntity.uuid,
                        cbox: playerEntity.cbox,
                        x: playerEntity.x,
                        y: playerEntity.y,
                        rot: playerEntity.rot}
                      }
                  });
                }
              break;
            }
            case PLAYER_ADDED: {
              const playerEntity: IPlayerOnchainEntity = JSON.parse(eventData as string);
              console.log("Player added ", playerEntity);
              // update game engine state
              const gameEntity = new GameEntityUpdate(PLAYER_ADDED, playerEntity.uuid, playerEntity.address, playerEntity.x, playerEntity.y, playerEntity.rot);
              game.push_game_entity_updates([gameEntity]);
              this.setState({
                activePlayers: this.state.activePlayers + 1
              });
              toast(`Player ${playerEntity.uuid} just joined!`,{
                className: "toast"
              });
              break;
            }
            case PLAYER_REMOVED: {
              const playerEntity: IPlayerOnchainEntity = JSON.parse(eventData as string);
              console.log("Player removed ", playerEntity);
              // update game engine state
              const gameEntity = new GameEntityUpdate(PLAYER_REMOVED, playerEntity.uuid, playerEntity.address, playerEntity.x, playerEntity.y, playerEntity.rot);
              game.push_game_entity_updates([gameEntity]);
              toast(`Player ${playerEntity.uuid} disconnected!`,{
                className: "toast"
              });
              this.setState({
                activePlayers: Math.max(this.state.activePlayers - 1, 0)
              });
              break;
            }
            case TOKEN_COLLECTED: {
              console.log("Token collected ");
              break;
            }
            case TOKEN_ADDED: {
              const tokenEntity: ITokenOnchainEntity = JSON.parse(eventData as string);
              const gameEntity = new GameEntityUpdate(TOKEN_ADDED, tokenEntity.uuid, "N/A", tokenEntity.x, tokenEntity.y, 0.0);
              game.push_game_entity_updates([gameEntity]);
              break;
            }
            case TOKEN_REMOVED: {
              const tokenEntity: ITokenOnchainEntity = JSON.parse(eventData as string);
              const gameEntity = new GameEntityUpdate(TOKEN_REMOVED, tokenEntity.uuid, "N/A", tokenEntity.x, tokenEntity.y, 0.0);
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

  updateBlockchainPosition = async () => {
    // if there is an already existing watcher, clear it
    if (this.updateBlockchainPositionTimeout) {
      clearTimeout(this.updateBlockchainPositionTimeout);
    }

    // get coors from wasm
    const newX = game.get_player_x();
    const newY = game.get_player_y();
    const newRot = game.get_player_rot();
    //console.log("Got game update: ", newX, newY, newRot);

    // TODO: only update if bc position is diff to current game pos
    //if (Math.abs((this.state.playerOnchainState as IPlayerOnchainEntity).x - newX) > 0.1
    //  || Math.abs((this.state.playerOnchainState as IPlayerOnchainEntity).y as number - newY) > 0.1
    //  || Math.abs((this.state.playerOnchainState as IPlayerOnchainEntity).rot as number - newRot) > 0.1) {
      // update coors state and then update blockchain
      this.setState((prevState: IState, prevProps: IProps) => {
        return {...prevState, playerGameState: {x: newX, y: newY, rot: newRot}}
      }, async () => {
        //console.log("Updating Blockchain Coords to...", newX, newY, newRot);
        const playerUpdate = { ...this.state.playerOnchainState, x: newX, y: newY, rot: newRot } as IPlayerOnchainEntity;
        await setPlayerPositionOnchain(this.state.web3Client as Client, this.state.gameAddress, this.state.threadAddressesMap, playerUpdate);
      });
    //}
    // set a new timeout
    this.updateBlockchainPositionTimeout = setTimeout(this.updateBlockchainPosition, UPDATE_BLOCKCHAIN_POS_TIMEOUT_DELAY);
  }

  componentWillUnmount(): void {
    if (this.gameEventsPoller) {
      this.gameEventsPoller.stopPolling();
    }
    if (this.updateBlockchainPositionTimeout) {
      clearTimeout(this.updateBlockchainPositionTimeout);
    }
  }

  render(): JSX.Element {

    const propState = ((this.props as any).location).state;

    if (propState && propState.isPlayerRegistered) {
      return (
        <React.Fragment>
        <ToastContainer />
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
      )
    } else {
      return <Link to={`/`}>Oops! Please register player first</Link>
    }
  }
}
export default withRouter(WasmDappExample);