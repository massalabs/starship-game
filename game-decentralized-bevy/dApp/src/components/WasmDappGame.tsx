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
import { disconnectPlayer, getActivePlayersAddresses, getActivePlayersCount, getCollectiblesState, getMaximumPlayersCount, getPlayerBalance, getPlayerCandidateLasersPositionFromStore, getPlayerCandidatePositionFromStore, getPlayerPos, getPlayerTokens, setPlayerLasersOnchain, setPlayerPositionOnchain } from "../gameMethods";
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
import { IPlayerLasersRequest } from "../entities/PlayerLasers";

export const PLAYER_POS_KEY = "PLAYER_POS_KEY";

// game player events
export const PLAYER_MOVED = "PLAYER_MOVED";
export const PLAYER_ADDED = "PLAYER_ADDED";
export const PLAYER_REMOVED = "PLAYER_REMOVED";

// game token events
export const TOKEN_ADDED = "TOKEN_ADDED";
export const TOKEN_REMOVED = "TOKEN_REMOVED";
export const TOKEN_COLLECTED = "TOKEN_COLLECTED";

// laser events
export const LASERS_SHOT = "LASERS_SHOT";

// settings consts
export const UPDATE_BLOCKCHAIN_POS_TIMEOUT_DELAY = 200; // ms = 0.5 secs. Every half a sec update the player pos on chain
export const GAME_EVENTS_POLLING_INTERVAL = 300; // 500 ms = 0.5 sec.
export const REMOTE_PLAYERS_POLLING_INTERVAL = 300;
export const SCREEN_WIDTH = 1000; //px
export const SCREEN_HEIGHT = 500; //px

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
  playerUuid: string;
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
  playerEntity: IPlayerOnchainEntity|undefined;
}

class WasmDappExample extends React.Component<IProps, IState> {
  private updateSelfBlockchainPositionTimeout: NodeJS.Timeout | null = null;
  private readSelfBlockchainPositionTimeout: NodeJS.Timeout | null = null;
  private remoteBlockchainPlayerPositionTimeouts: Map<string, PollTimeout> = new Map<string, PollTimeout>();
  private remoteBlockchainPlayerLasersTimeouts: Map<string, PollTimeout> = new Map<string, PollTimeout>();
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
      playerAddress: propState.playerAddress as string,
      playerUuid: propState.playerUuid as string,
      playerName: propState.playerName as string,
      playerSecretKey: propState.playerSecretKey as string,
      gameAddress: propState.gameAddress as string,
      playerEntity: propState.playerEntity as IPlayerOnchainEntity,
      activePlayers: 0,
      maxPlayers: 0,
    };

    // bind all component methods
    this.listenOnGameEvents = this.listenOnGameEvents.bind(this);
    this.updateSelfBlockchainPosition = this.updateSelfBlockchainPosition.bind(this);
    this.readSelfBlockchainPosition = this.readSelfBlockchainPosition.bind(this);
    this.updatePlayerRemoteBlockchainPosition = this.updatePlayerRemoteBlockchainPosition.bind(this);
    this.updatePlayerLasersRemoteBlockchainPosition = this.updatePlayerLasersRemoteBlockchainPosition.bind(this);
    this.disconnectPlayer = this.disconnectPlayer.bind(this);
    this.stopAllPollers = this.stopAllPollers.bind(this);
  }

  async componentDidMount(): Promise<void> {

    if (this.state.isPlayerRegistered) {

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
          className: "toast",
          type: "success"
        });
      }

      // send the local player entity to the game engine
      // TODO: fix this using redux!
      let playerEntityFromStorage: IPlayerOnchainEntity|undefined = undefined;
      const localStoragePlayerPos = window.localStorage.getItem(PLAYER_POS_KEY);
      if (localStoragePlayerPos && localStoragePlayerPos.length > 0) {
        try {
          playerEntityFromStorage = JSON.parse(localStoragePlayerPos);
        } catch (ex) {
          // nothing in the storage
          console.info("Nothing in the local storage");
        }
      }

      const latestPlayerEntityPosition = playerEntityFromStorage ? playerEntityFromStorage : this.state.playerEntity;
      if (latestPlayerEntityPosition) {
        const localPlayerGameEntity = new GameEntityUpdate(PLAYER_ADDED, JSON.stringify({...latestPlayerEntityPosition, type: ENTITY_TYPE.LOCAL}));
        game.push_game_entity_updates([localPlayerGameEntity]);
      }

      // create a new base account
      let web3Client: Client|null = null;
      try {
        const baseAccount = await WalletClient.getAccountFromSecretKey(this.state.playerSecretKey);
        web3Client = await ClientFactory.createCustomClient(getProviderUrl(this.state.networkName), true, baseAccount);
      } catch (ex) {
        console.error(`Error loading web3 client`, ex);
      }
      console.log("Web3 loaded!");

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

      // get player balance and tokens
      let playerBalance: number = 0;
      let playerTokens: number = 0;
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

      // get connected players
      let activePlayers: number|null = 0;
      let maxPlayers: number|null = 0;
      try {
        activePlayers = await getActivePlayersCount(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
        maxPlayers = await getMaximumPlayersCount(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
      } catch (ex) {
        console.error("Error getting players count data...", ex);
      }

      // get connected players addresses
      let connectedPlayers: Array<string> = [];
      try {
        //connectedPlayers = await getActivePlayersAddressesFromStore(web3Client as Client, this.state.gameAddress, false);
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

      // start polling the remote addresses positions and lasers
      remotePlayersStates.forEach((remotePlayerState) => {
        if (!this.remoteBlockchainPlayerPositionTimeouts.has(remotePlayerState.address)) {
          this.remoteBlockchainPlayerPositionTimeouts.set(remotePlayerState.address, new PollTimeout(REMOTE_PLAYERS_POLLING_INTERVAL, remotePlayerState.address, this.updatePlayerRemoteBlockchainPosition));
        }

        if (!this.remoteBlockchainPlayerLasersTimeouts.has(remotePlayerState.address)) {
          this.remoteBlockchainPlayerLasersTimeouts.set(remotePlayerState.address, new PollTimeout(REMOTE_PLAYERS_POLLING_INTERVAL, remotePlayerState.address, this.updatePlayerLasersRemoteBlockchainPosition));
        }
      });

      // update react state
      this.setState((prevState: IState, _prevProps: IProps) => {
        return { ...prevState,
              wasm,
              isLoading: false,
              web3Client,
              activePlayers: activePlayers ? activePlayers : 0,
              maxPlayers: maxPlayers ? maxPlayers : 0,
              playerBalance,
              playerTokens,
              playerOnchainState: this.state.playerEntity,
              playerGameState: {
                x: this.state.playerEntity?.x,
                y: this.state.playerEntity?.y,
                rot: this.state.playerEntity?.rot,
                w: this.state.playerEntity?.w
              } as IPlayerGameEntity
        };
      }, () => {
        // start interval loops
        this.listenOnGameEvents();
        this.updateSelfBlockchainPosition();
        this.readSelfBlockchainPosition();
        toast(`Ready GO!`,{
          className: "toast",
          type: "success"
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
      is_final: false // only listen for final game events here
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
              if (!this.remoteBlockchainPlayerPositionTimeouts.has(playerAddedEventData.address)) {
                this.remoteBlockchainPlayerPositionTimeouts.set(playerAddedEventData.address, new PollTimeout(UPDATE_BLOCKCHAIN_POS_TIMEOUT_DELAY, playerAddedEventData.address, this.updatePlayerRemoteBlockchainPosition));
              }

              // start polling player lasers
              if (!this.remoteBlockchainPlayerLasersTimeouts.has(playerAddedEventData.address)) {
                this.remoteBlockchainPlayerLasersTimeouts.set(playerAddedEventData.address, new PollTimeout(UPDATE_BLOCKCHAIN_POS_TIMEOUT_DELAY, playerAddedEventData.address, this.updatePlayerLasersRemoteBlockchainPosition));
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
              console.log("[REACT] Player removed ", playerRemovedEventData);

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
              const gameEntity = new GameEntityUpdate(TOKEN_COLLECTED, JSON.stringify({...collectedTokenEventData}));
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
    this.gameEventsPoller.on(ON_MASSA_EVENT_ERROR, (ex) => console.log("Game Poller Event Error ", ex));
  }

  updateSelfBlockchainPosition = async () => {
    // if there is an already existing watcher, clear it
    if (this.updateSelfBlockchainPositionTimeout) {
      clearTimeout(this.updateSelfBlockchainPositionTimeout);
    }

    // get coors from wasm
    const newX: number = game.get_player_x();
    const newY: number = game.get_player_y();
    const newRot: number = game.get_player_rot();
    const newW: number = game.get_player_w();
    const lasersState: string | undefined = game.get_player_lasers(); // "{...uuid,x,y,rot,w}@{...uuid,x,y,rot,w}@{...uuid,x,y,rot,w}...""

    // update coors state and then update blockchain
    this.setState((prevState: IState, prevProps: IProps) => {
      return {...prevState, playerGameState: {x: newX, y: newY, rot: newRot, w: newW}}
    });

    //console.log("Updating Blockchain Coords to...", newX, newY, newRot);
    const playerUpdate = { ...this.state.playerOnchainState, x: newX, y: newY, rot: newRot, w: newW } as IPlayerOnchainEntity;

    // update players position onchain
    try {
      await setPlayerPositionOnchain(this.state.web3Client as Client, this.state.gameAddress, this.state.threadAddressesMap, playerUpdate);
    } catch (ex) {
      console.warn("Error setting player onchain position...", ex);
    };

    // send new laser state to blockchain
    try {
      await setPlayerLasersOnchain(this.state.web3Client as Client, this.state.gameAddress, this.state.threadAddressesMap, {
        playerAddress: this.state.playerAddress,
        playerUuid: this.state.playerUuid,
        lasersData: lasersState ? lasersState : "", // pass the game state directly to the smart contract
        time: (new Date()).getTime()
      } as IPlayerLasersRequest);
    } catch (ex) {
      console.warn("Error setting player laser onchain position...", ex);
    };

    // set a new timeout or not if player is disconnecting
    if (this.state.isDisconnecting) {
      if (this.updateSelfBlockchainPositionTimeout) {
        clearTimeout(this.updateSelfBlockchainPositionTimeout);
      }
    } else {
      this.updateSelfBlockchainPositionTimeout = setTimeout(this.updateSelfBlockchainPosition, UPDATE_BLOCKCHAIN_POS_TIMEOUT_DELAY);
    }
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
      console.warn("Error reading player position...", ex);
    };

    // update coors state and then update blockchain
    if (playerEntity) {
      window.localStorage.setItem(PLAYER_POS_KEY, JSON.stringify((playerEntity as IPlayerOnchainEntity)));
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
    }

    // set a new timeout or clear if the player is disconnecting
    if (this.state.isDisconnecting) {
      if (this.readSelfBlockchainPositionTimeout) {
        clearTimeout(this.readSelfBlockchainPositionTimeout);
      }
    } else {
      this.readSelfBlockchainPositionTimeout = setTimeout(this.readSelfBlockchainPosition, UPDATE_BLOCKCHAIN_POS_TIMEOUT_DELAY);
    }
  }

  disconnectPlayer = async () => {
    this.stopAllPollers();
    this.setState({isDisconnecting: true});
    try {
      await disconnectPlayer(this.state.web3Client as Client, this.state.gameAddress, this.state.playerAddress);
    } catch (ex) {
      console.error("Error disconnecting player...", ex);
    }
    this.setState({isDisconnecting: false, isPlayerRegistered: false});
  }

  updatePlayerRemoteBlockchainPosition = async (playerAddress: string) => {
    // if there is an already existing watcher, clear it
    const timeout: PollTimeout | undefined = this.remoteBlockchainPlayerPositionTimeouts.get(playerAddress);
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
    this.remoteBlockchainPlayerPositionTimeouts.set(playerAddress, new PollTimeout(UPDATE_BLOCKCHAIN_POS_TIMEOUT_DELAY, playerAddress, this.updatePlayerRemoteBlockchainPosition));
  }

  updatePlayerLasersRemoteBlockchainPosition = async (playerAddress: string) => {
    // if there is an already existing watcher, clear it
    const timeout: PollTimeout | undefined = this.remoteBlockchainPlayerLasersTimeouts.get(playerAddress);
    if (timeout) {
      timeout.clear();
    }

    // get player lasers from blockchain
    let remotePlayerLasersRequest: IPlayerLasersRequest|null = null;
    try {
      remotePlayerLasersRequest = await getPlayerCandidateLasersPositionFromStore(this.state.web3Client as Client, this.state.gameAddress, playerAddress);
    } catch (ex) {
      console.error(`Error getting remote player lasers request`, ex);
    }

    /*
    // if there is data send it to the game engine
    if (remotePlayerLasersRequest) {
      let playerLasersData: Array<IPlayerLaserData> = [];
      try {
        const laserStates = remotePlayerLasersRequest?.lasersData.split("@");
        laserStates.forEach(laserState => {
          let laserStateDataJSON: IPlayerLaserData|undefined = undefined;
          try {
            laserStateDataJSON = JSON.parse(laserState as string);
          } catch (ex) {}
          if (laserStateDataJSON) {
            playerLasersData.push(laserStateDataJSON);
          }
        })
      } catch (ex) {
          console.error("Error parsing data for player laser");
          throw ex;
      }

      // send update events to game engine
      const lasersGameUpdate = playerLasersData.map(laserData => {
        return new GameEntityUpdate(LASERS_SHOT, JSON.stringify({...laserData}));
      })
      game.push_game_entity_updates(lasersGameUpdate);
    }
    */

    // send update events to game engine
    game.push_game_entity_updates([new GameEntityUpdate(LASERS_SHOT, JSON.stringify({...remotePlayerLasersRequest}))]);

    // set a new timeout
    this.remoteBlockchainPlayerLasersTimeouts.set(playerAddress, new PollTimeout(UPDATE_BLOCKCHAIN_POS_TIMEOUT_DELAY, playerAddress, this.updatePlayerLasersRemoteBlockchainPosition));
  }

  stopAllPollers = async () => {
    let tries = 0;
    while (tries < 5) {
      if (this.gameEventsPoller) {
        this.gameEventsPoller.stopPolling();
      }
      if (this.updateSelfBlockchainPositionTimeout) {
        clearTimeout(this.updateSelfBlockchainPositionTimeout);
      }
      if (this.readSelfBlockchainPositionTimeout) {
        clearTimeout(this.readSelfBlockchainPositionTimeout);
      }
      this.remoteBlockchainPlayerPositionTimeouts.forEach(timeout => timeout.clear());
      this.remoteBlockchainPlayerLasersTimeouts.forEach(timeout => timeout.clear());
      wait(500);
      tries++;
    }
  }

  componentWillUnmount(): void {
    this.stopAllPollers();
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