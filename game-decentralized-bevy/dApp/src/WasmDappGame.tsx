import React, { Component } from "react";
import './App.css';
import 'react-toastify/dist/ReactToastify.css';
import type {} from '@mui/lab/themeAugmentation';
import { Client, EOperationStatus, EventPoller, IAccount, ICallData, IEvent, IEventFilter, IEventRegexFilter, INodeStatus, IProvider, IReadData, ON_MASSA_EVENT_DATA, ON_MASSA_EVENT_ERROR, ProviderType } from "@massalabs/massa-web3";
import TextField from '@mui/material/TextField';
import * as game from "starship";
import Box from '@mui/material/Box';
import LoadingOverlay from 'react-loading-overlay-ts';
import { ToastContainer, toast } from 'react-toastify';
import { ClientFactory, DefaultProviderUrls, WalletClient } from "@massalabs/massa-web3";
import { IPlayerOnchainEntity, IPlayerGameEntity } from "./PlayerEntity";
import { getPlayerPos, registerPlayer, isPlayerRegistered } from "./gameFunctions";
import { IGameEvent } from "./GameEvent";

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
const MAX_THREADS = 32;
const UPDATE_BLOCKCHAIN_POS_TIMEOUT_DELAY = 500; // ms
const READ_BLOCKCHAIN_POS_TIMEOUT_DELAY = 100; // ms
const SCREEN_WIDTH = 1000; //px
const SCREEN_HEIGHT = 500; //px

// addresses consts
const GAME_ADDRESS = "A129MvYKsK23GRs8sndXYNqo29tf6oiHq2GkCgdGij6dtYMnucyS"; //process.env.REACT_APP_SC_ADDRESS ||
const BASE_ACCOUNT_SECRET_KEY = "S1LoQ2cyq273f2TTi1qMYH6qgntAtpn85PbMd9qr2tS7S6A64cC";
const PLAYER_ADDRESS = "A12CoH9XQzHFLdL8wrXd3nra7iidiYEQpqRdbLtyNXBdLtKh1jvT"; // TODO: to be read in the UI

const generateThreadAddressesMap = async (): Promise<Map<number, IAccount>> => {
  const addressesMap: Map<number, IAccount> = new Map();
  while(true) {
      const randomAccount: IAccount = await WalletClient.walletGenerateNewAccount();
      addressesMap.set(randomAccount.createdInThread as number, randomAccount);
      if (addressesMap.size === MAX_THREADS) {
          break;
      }
  }
  return addressesMap;
}

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
  private readBlockchainPosTimeout: NodeJS.Timeout | null = null;

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
    //this.setEntityPosition = this.setEntityPosition.bind(this);

    this.listenOnGameEvents = this.listenOnGameEvents.bind(this);
    //this.readBlockchainPos = this.readBlockchainPos.bind(this);
    //this.updateBlockchainPosition = this.updateBlockchainPosition.bind(this);
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
      threadAddressesMap = await generateThreadAddressesMap();
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

    // set game state if we have bc coordinates
    /*
    if (entityState) {
      //game.set_user_virtual_position(entityState.blockchainX, entityState.blockchainY);
      game.set_user_desired_position(entityState.blockchainX, entityState.blockchainY);
      toast.success(`Player BC coords set to (${entityState.blockchainX}, ${entityState.blockchainY})!`,{
        className: "toast"
      });
    } else {
      toast.error(`Player BC coords unaccessible!`,{
        className: "toast"
      });
    }
    */

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
      }, async () => {
      // start interval loops
        this.listenOnGameEvents();
        //this.readBlockchainPos();
        //await wait(3000);
        //this.updateBlockchainPosition();
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
      is_final: true
    } as IEventRegexFilter;

    const eventPoller = EventPoller.startEventsPolling(
      eventsFilter,
      1000,
      this.state.web3Client as Client
    );
    eventPoller.on(ON_MASSA_EVENT_DATA, (events: Array<IEvent>) => {
        const update = events[events.length - 1];
        console.log("RECEIVED GAME DATA", update.data);
        let gameEvent: IGameEvent|undefined = undefined;
        try {
          gameEvent = JSON.parse(update.data) as IGameEvent;
        } catch (err) {
          console.error("Error parsing game event")
        }
        if (gameEvent) {
          const eventMessageData = gameEvent?.data.split("=");
          const eventName = eventMessageData.at(0);
          const eventData = eventMessageData.at(1);
          console.log("EVENT NAME", eventName);
          console.log("EVENT DATA", eventData);
        }
    });
    eventPoller.on(ON_MASSA_EVENT_ERROR, (ex) => console.log("ERROR ", ex));
  }
  
 
  
  



  

  



  /*
  readBlockchainPos = async (): Promise<void> => {
    // if there is an already existing watcher, clear it
    if (this.readBlockchainPosTimeout) {
      clearTimeout(this.readBlockchainPosTimeout);
    }

    // fetch coords from storage
    let blockchainState: IBlockchainGameEntity|undefined;
    try {
      blockchainState = await this.getPlayerPos(this.state.web3Client as Client);
    } catch (ex) {
      console.error("Error getting storage coords...", ex);
    }
    if (blockchainState && this.state.playerOnchainState) {
      if (Math.abs(this.state.playerOnchainState.blockchainX - blockchainState.blockchainX) > 0.0001 ||
          Math.abs(this.state.playerOnchainState.blockchainY - blockchainState.blockchainY) > 0.0001) {
        // apply movement vector to the ship
        game.set_user_desired_position(blockchainState.blockchainX, blockchainState.blockchainY);
        // update coors state for blockchain coords
        this.setState((prevState: IState, _prevProps: IProps) => {
          return { ...prevState, playerOnchainState: {...prevState.playerOnchainState as IBlockchainGameEntity,
              blockchainX: (blockchainState as IBlockchainGameEntity).blockchainX,
              blockchainY: (blockchainState as IBlockchainGameEntity).blockchainY} };
        });
      }
    }
    // set a new timeout
    this.readBlockchainPosTimeout = setTimeout(this.readBlockchainPos, READ_BLOCKCHAIN_POS_TIMEOUT_DELAY);
  }
  */

  /*
  setEntityPosition = async (entity: IBlockchainGameEntity): Promise<string|undefined> => {
    // evaluate thread from which to send
    let nodeStatusInfo: INodeStatus|null|undefined = null;
    try {
      nodeStatusInfo = await this.state.web3Client?.publicApi().getNodeStatus();
    } catch(ex) {
      console.log("Error getting node status");
      throw ex;
    }
    const threadForNextOp = ((nodeStatusInfo as INodeStatus).next_slot.thread + 2) % MAX_THREADS;
    console.log("Next thread to execute op with = ", threadForNextOp);
    const executor = this.state.threadAddressesMap.get(threadForNextOp);
    let opIds;
    try {
      opIds = await this.state.web3Client?.smartContracts().callSmartContract({
        /// storage fee for taking place in books
        fee: 0,
        /// The maximum amount of gas that the execution of the contract is allowed to cost.
        maxGas: 200000,
        /// The price per unit of gas that the caller is willing to pay for the execution.
        gasPrice: 0,
        /// Extra coins that are spent from the caller's parallel balance and transferred to the target
        parallelCoins: 0,
        /// Extra coins that are spent from the caller's sequential balance and transferred to the target
        sequentialCoins: 0,
        /// Target smart contract address
        targetAddress: this.state.gameAddress,
        /// Target function name. No function is called if empty.
        functionName: "setAbsCoors",
        /// Parameter to pass to the target function
        parameter: BlockchainGameEntity.fromObject(entity).toString()
      } as ICallData, executor as IAccount);
    } catch (ex) {
      console.error(`Error setting object coords to sc`, ex);
      throw ex;
    }
    console.log("Updated Blockchain Coords OP_ID", opIds);
    return opIds ? opIds[0] : undefined;
  }
  */

  /*
  updateBlockchainPosition = async () => {
    // if there is an already existing watcher, clear it
    if (this.updateBlockchainPositionTimeout) {
      clearTimeout(this.updateBlockchainPositionTimeout);
    }

    // get coors from wasm
    const newX = game.get_x();
    const newY = game.get_y();

    if (this.state.playerOnchainState &&
      (Math.abs(this.state.playerOnchainState.gameX - newX) > 0.0001 ||  //Math.abs(this.state.rocketGameXPos - newX)
      Math.abs(this.state.playerOnchainState.gameY - newY) > 0.0001)) {

      // update coors state and then update blockchain
      this.setState((prevState: IState, prevProps: IProps) => {
        //return {...prevState, rocketGameXPos: newX, rocketGameYPos: newY} 
        return {...prevState, playerOnchainState: {...prevState.playerOnchainState as IBlockchainGameEntity, gameX: newX, gameY: newY}} 
      }, async () => {
        console.log("Updating Blockchain Coords to...", newX, newY);
        const updatedState = this.state.playerOnchainState;
        (updatedState as IBlockchainGameEntity).blockchainX = newX;
        (updatedState as IBlockchainGameEntity).blockchainY = newY;
        await this.setEntityPosition(updatedState as IBlockchainGameEntity);
      });
    }
    // set a new timeout
    this.updateBlockchainPositionTimeout = setTimeout(this.updateBlockchainPosition, UPDATE_BLOCKCHAIN_POS_TIMEOUT_DELAY);
  }
  */

  componentWillUnmount(): void {
    if (this.readBlockchainPosTimeout) {
      clearTimeout(this.readBlockchainPosTimeout);
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
                      label="Massa Balance"
                      value={0}
                      disabled={true}
                      variant="filled"
                    />
                </div>
                <div>
                  <TextField
                      id="outlined-name1"
                      label="Game Blockchain X Pos"
                      value={this.state.playerGameState?.x}
                      disabled={true}
                      variant="filled"
                    />
                  <TextField
                      id="outlined-name2"
                      label="Game Blockchain Y Pos"
                      value={this.state.playerGameState?.y}
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
                </div>
            </Box>
          </LoadingOverlay>
      </React.Fragment>
    );
  }
}