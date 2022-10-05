import React, { Component } from "react";
import './App.css';
import 'react-toastify/dist/ReactToastify.css';
import type {} from '@mui/lab/themeAugmentation';
import { Client, EventPoller, IAccount, IEvent, IEventRegexFilter, IProvider, ON_MASSA_EVENT_DATA, ON_MASSA_EVENT_ERROR, ProviderType } from "@massalabs/massa-web3";
import TextField from '@mui/material/TextField';
import * as game from "starship";
import Box from '@mui/material/Box';
import LoadingOverlay from 'react-loading-overlay-ts';
import { ToastContainer, toast } from 'react-toastify';
import { ClientFactory, WalletClient } from "@massalabs/massa-web3";
import { IPlayerOnchainEntity, IPlayerGameEntity } from "./PlayerEntity";
import { getPlayerPos, registerPlayer, isPlayerRegistered, setPlayerPositionOnchain } from "./gameFunctions";
import { IGameEvent } from "./GameEvent";
import { generateThreadAddressesMap } from "./utils";

const wait = async (timeMilli: number): Promise<void> => {
	return new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			clearTimeout(timeout);
			return resolve();
		}, timeMilli);
	});
};

const providers = [
  {
      url: "https://inno.massa.net/test13",
      type: ProviderType.PUBLIC
  } as IProvider,
  {
      url: "https://inno.massa.net/test13",
      type: ProviderType.PRIVATE
  } as IProvider
];


// settings consts
const UPDATE_BLOCKCHAIN_POS_TIMEOUT_DELAY = 500; // ms = 0.5 secs. Every half a sec update the player pos on chain
const GAME_EVENTS_POLLING_INTERVAL = 1000; // ms = 1sec.
const SCREEN_WIDTH = 1000; //px
const SCREEN_HEIGHT = 500; //px

// addresses consts
const GAME_ADDRESS = "A178zjYtJEYsg33yaEqUjB9azgfX567tT4rSF4jQKDLVwXieqhu"; //process.env.REACT_APP_SC_ADDRESS ||
const BASE_ACCOUNT_SECRET_KEY = "S1LoQ2cyq273f2TTi1qMYH6qgntAtpn85PbMd9qr2tS7S6A64cC";
const PLAYER_ADDRESS = "A12CoH9XQzHFLdL8wrXd3nra7iidiYEQpqRdbLtyNXBdLtKh1jvT"; // TODO: to be read in the UI

interface IProps {}

export interface IState {
  wasmError: Error | null;
  wasm: game.InitOutput | null;
  isLoading: boolean,
  playerAddress: string;
  playerOnchainState: IPlayerOnchainEntity | null | undefined;
  playerGameState: IPlayerGameEntity | null | undefined;
  web3Client: Client | null;
  threadAddressesMap: Map<number, IAccount>;
  gameAddress: string;
}
export default class WasmDappExample extends Component<IProps, IState> {
  private updateBlockchainPositionTimeout: NodeJS.Timeout | null = null;
  private gameEventsPoller: EventPoller | null = null;

  constructor(props: IProps) {
    super(props);

    this.state = {
      wasmError: null,
      wasm: null,
      isLoading: true,
      web3Client: null,
      threadAddressesMap: new Map(),
      playerOnchainState: null,
      playerGameState: null,
      playerAddress: PLAYER_ADDRESS,
      gameAddress: GAME_ADDRESS,
    };

    this.listenOnGameEvents = this.listenOnGameEvents.bind(this);
    this.updateBlockchainPosition = this.updateBlockchainPosition.bind(this);
  }

  async componentDidMount(): Promise<void> {

    // create a new base account
    let web3Client: Client|null = null;
    try {
      const baseAccount = await WalletClient.getAccountFromSecretKey(BASE_ACCOUNT_SECRET_KEY);
      web3Client = await ClientFactory.createCustomClient(providers, true, baseAccount);
    } catch (ex) {
      console.error(`Error loading web3 client`, ex);
    }
    console.log("Web3 loaded!");

    // generate thread addresses map // TODO: only generate once for new players and update sc
    let threadAddressesMap: Map<number, IAccount> = new Map();
    try {
      threadAddressesMap = await generateThreadAddressesMap(web3Client as Client);
    } catch (ex) {
      console.error(`Error generating thread addresses map`, ex);
    }
    console.log("Thread map generated!");

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

    // check if player is registered
    let hasPlayerRegistered: boolean = false;
    try {
      hasPlayerRegistered = await isPlayerRegistered(web3Client as Client, GAME_ADDRESS, PLAYER_ADDRESS);
    } catch (ex) {
      console.error("Error getting is player registered...", ex);
    }

    // register player if necessary
    let playerEntity: IPlayerOnchainEntity|undefined = undefined;
    if (!hasPlayerRegistered) {
      try {
        playerEntity = await registerPlayer(web3Client as Client, GAME_ADDRESS, PLAYER_ADDRESS);
        toast(`Player Just Registered!`,{
          className: "toast"
        });
      } catch (ex) {
        console.error("Error registering player...", ex);
      }
    } else {
      try {
        playerEntity = await getPlayerPos(web3Client as Client, GAME_ADDRESS, PLAYER_ADDRESS);
        toast(`Player Already Registered!`,{
          className: "toast"
        });
      } catch (ex) {
        console.error("Error registering player...", ex);
      }
    }

    // TODO: set game state if we have bc coordinates

    // update react state
    if (playerEntity) {
      this.setState((prevState: IState, _prevProps: IProps) => {
        return { ...prevState,
              wasm,
              isLoading: false,
              web3Client,
              threadAddressesMap,
              playerOnchainState: playerEntity,
              playerGameState: {
                x: playerEntity?.x,
                y: playerEntity?.y,
                rot: playerEntity?.rot
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
    const eventsFilter = {
      start: null,
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
        const update = events[events.length - 1];
        //console.log("RECEIVED GAME DATA", update.data);
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
          console.log("EVENT NAME", eventName);
          console.log("EVENT DATA", eventData);
          switch (eventName) {
            case "PLAYER_MOVED": {
              const playerEntity: IPlayerOnchainEntity = JSON.parse(eventData as string);
              const playerOnchainState = this.state.playerOnchainState as IPlayerOnchainEntity;
              if ((playerEntity as IPlayerOnchainEntity).address === playerOnchainState.address && 
              (playerEntity as IPlayerOnchainEntity).uuid === playerOnchainState.uuid) {
                  this.setState((prevState: IState, _prevProps: IProps) => {
                    return {...prevState,
                      playerOnchainState: {
                        address: playerEntity.address,
                        uuid: playerEntity.uuid,
                        cbox: playerEntity.cbox,
                        tokensCollected: playerEntity.tokensCollected,
                        x: playerEntity.x,
                        y: playerEntity.y,
                        rot: playerEntity.rot}
                      }
                  });
                }
              break;
            }
            case "GAME_TOKENS_STATE_UPDATED": {
              break;
            }
            case "PLAYER_ADDED": {
              const playerEntity: IPlayerOnchainEntity = JSON.parse(eventData as string);
              console.log("Player added ", playerEntity);
              break;
            }
            case "PLAYER_REMOVED": {
              break;
            }
            case "TOKEN_COLLECTED": {
              break;
            }
            default: {
              console.log("Unknown event");
            }
          }
        }
    });
    this.gameEventsPoller.on(ON_MASSA_EVENT_ERROR, (ex) => console.log("ERROR ", ex));
  }

  updateBlockchainPosition = async () => {
    // if there is an already existing watcher, clear it
    if (this.updateBlockchainPositionTimeout) {
      clearTimeout(this.updateBlockchainPositionTimeout);
    }

    // get coors from wasm
    const newX = game.get_x();
    const newY = game.get_y();
    const newRot = game.get_rot();
    //console.log("Got game update: ", newX, newY, newRot);

    // TODO: only update if bc position is diff to current game pos

    // update coors state and then update blockchain
    this.setState((prevState: IState, prevProps: IProps) => {
      return {...prevState, playerGameState: {x: newX, y: newY, rot: newRot}}
    }, async () => {
      //console.log("Updating Blockchain Coords to...", newX, newY, newRot);
      const playerUpdate = { ...this.state.playerOnchainState, x: newX, y: newY, rot: newRot } as IPlayerOnchainEntity;
      await setPlayerPositionOnchain(this.state.web3Client as Client, this.state.gameAddress, this.state.threadAddressesMap, playerUpdate);
    });
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
                      id="outlined-name3"
                      label="Tokens Collected"
                      value={this.state.playerOnchainState?.tokensCollected}
                      disabled={true}
                      variant="filled"
                  />
                  <TextField
                      id="outlined-name4"
                      label="Tokens Balance"
                      value={0}
                      disabled={true}
                      variant="filled"
                  />
                </div>
                <div>
                  <TextField
                      id="outlined-name1"
                      label="Game X Pos"
                      value={this.state.playerGameState?.x}
                      disabled={true}
                      variant="filled"
                  />
                  <TextField
                      id="outlined-name2"
                      label="Game Y Pos"
                      value={this.state.playerGameState?.y}
                      disabled={true}
                      variant="filled"
                  />
                  <TextField
                      id="outlined-name2"
                      label="Game Rot Pos"
                      value={this.state.playerGameState?.rot}
                      disabled={true}
                      variant="filled"
                  />
                </div>
                <div>
                  <TextField
                      id="outlined-name3"
                      label="Massa X Pos"
                      value={this.state.playerOnchainState?.x}
                      disabled={true}
                      variant="filled"
                  />
                  <TextField
                      id="outlined-name4"
                      label="Massa Y Pos"
                      value={this.state.playerOnchainState?.y}
                      disabled={true}
                      variant="filled"
                  />
                  <TextField
                      id="outlined-name4"
                      label="Massa Rot Pos"
                      value={this.state.playerOnchainState?.rot}
                      disabled={true}
                      variant="filled"
                  />
                </div>
            </Box>
          </LoadingOverlay>
      </React.Fragment>
    );
  }
}