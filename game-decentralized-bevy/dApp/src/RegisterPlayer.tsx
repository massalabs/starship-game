import React, { Component } from "react";
import './App.css';
import 'react-toastify/dist/ReactToastify.css';
import type {} from '@mui/lab/themeAugmentation';
import { Client, IAccount } from "@massalabs/massa-web3";
import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import { ToastContainer, toast } from 'react-toastify';
import { ClientFactory, WalletClient } from "@massalabs/massa-web3";
import { IPlayerOnchainEntity } from "./PlayerEntity";
import { getPlayerPos, registerPlayer, isPlayerRegistered, getCollectiblesState, getPlayerBalance, getPlayerTokens } from "./gameFunctions";
import { generateThreadAddressesMap, getProviderUrl, networks, networkValues } from "./utils";
import { ITokenOnchainEntity } from "./TokenEntity";
import { Navigate } from "react-router-dom";

const style = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  height: 500,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  pt: 2,
  px: 4,
  pb: 3,
  textAlign: "center"
};

interface IProps {}

export interface IPropState {
  gameAddress: string;
  playerSecretKey: string;
  playerAddress: string;
  networkName: string;
  isPlayerRegistered: boolean;
  tokensInitialState: Array<ITokenOnchainEntity>;
  threadAddressesMap: Object;
  playerOnchainState: IPlayerOnchainEntity | undefined;
  playerBalance: number;
  playerTokens: number;
} 

export interface IState extends IPropState {
  showModal: boolean;
}

export default class RegisterPlayer extends Component<IProps, IState> {

  constructor(props: IProps) {
    super(props);

    this.state = {
      playerAddress: 'N/A',
      gameAddress: "",
      playerSecretKey: "",
      networkName: networks.IMMONET.value,
      showModal: true,
      isPlayerRegistered: false,
      tokensInitialState: [],
      threadAddressesMap: new Map<number, IAccount>(),
      playerOnchainState: undefined,
      playerBalance: 0,
      playerTokens: 0,
    };

    this.showModal = this.showModal.bind(this);
    this.hideModal = this.hideModal.bind(this);
    this.registerPlayerAndOpenGame = this.registerPlayerAndOpenGame.bind(this);
    this.handleGameAddressChange = this.handleGameAddressChange.bind(this);
    this.handlePlayerSecretKeyChange = this.handlePlayerSecretKeyChange.bind(this);
    this.handleNetworkChange = this.handleNetworkChange.bind(this);
  }

  showModal = () => {
    this.setState({ showModal: true });
  };

  hideModal = () => {
    this.setState({ showModal: false });
  };

  handleGameAddressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ gameAddress: event.target.value });
  };

  handlePlayerSecretKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const that = this;
    that.setState({ playerSecretKey: event.target.value });
    WalletClient.getAccountFromSecretKey(event.target.value)
    .then((res) => {
      const account = res.address as string;
      that.setState({ playerAddress: account });
    })
    .catch((ex) => {
    })
  };

  handleNetworkChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ networkName: event.target.value });
  };

  async componentDidMount(): Promise<void> {

  }

  async registerPlayerAndOpenGame(): Promise<void> {

    // create a new base account
    let web3Client: Client|undefined = undefined;
    let baseAccount: IAccount|undefined = undefined;
    try {
      baseAccount = await WalletClient.getAccountFromSecretKey(this.state.playerSecretKey);
      web3Client = await ClientFactory.createCustomClient(getProviderUrl(this.state.networkName), true, baseAccount);
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

    // check if player is registered
    let hasPlayerRegistered: boolean = false;
    try {
      hasPlayerRegistered = await isPlayerRegistered(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
    } catch (ex) {
      console.error("Error getting is player registered...", ex);
    }

    // register player if necessary
    let playerEntity: IPlayerOnchainEntity|undefined = undefined;
    let playerBalance: number = 0;
    let playerTokens: number = 0;
    if (!hasPlayerRegistered) {
      try {
        playerEntity = await registerPlayer(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
        toast(`Player Just Registered!`,{
          className: "toast"
        });
      } catch (ex) {
        console.error("Error registering player...", ex);
      }
    } else {
      try {
        playerEntity = await getPlayerPos(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
        toast(`Player Already Registered!`,{
          className: "toast"
        });
      } catch (ex) {
        console.error("Error registering player...", ex);
      }
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
    }

    // get collectibles initial state and send it to the game engine
    let tokensInitialState: Array<ITokenOnchainEntity> = [];
    try {
      tokensInitialState = await getCollectiblesState(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
    } catch (ex) {
      console.error("Error getting tokens initial state...", ex);
    }

    // TODO: get all active players at the time of joining

    // update react state
    if (playerEntity) {
      this.setState((prevState: IState, _prevProps: IProps) => {
        return { ...prevState,
              showModal: false,
              isPlayerRegistered: true,
              tokensInitialState,
              playerBalance,
              playerTokens,
              threadAddressesMap: Object.fromEntries(threadAddressesMap),
              playerOnchainState: playerEntity
        };
      });
    }
  }

  componentWillUnmount(): void {

  }

  render(): JSX.Element {
    if (this.state.showModal) {
      return (
        <React.Fragment>
          <Modal
            hideBackdrop
            open={this.state.showModal}
            onClose={() => {console.log("closed");}}
            aria-labelledby="child-modal-title"
            aria-describedby="child-modal-description"
          >
            <Box sx={{ ...style, width: 700 }}>
              <h2 id="child-modal-title">Enter game</h2>
              <p id="child-modal-description">
                Please either register a new player or select an registered one
              </p>
              <div>
                  <Box
                    component="form"
                    sx={{
                      '& .MuiTextField-root': { m: 1, width: '40ch' },
                    }}
                    noValidate
                    autoComplete="off"
                  >
                    <TextField
                      id="outlined-select-currency"
                      select
                      label="Select"
                      value={this.state.networkName}
                      onChange={this.handleNetworkChange}
                      helperText="Please select your network"
                      variant="filled"
                    >
                      { 
                        Array.from(networkValues).map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))
                      }
                    </TextField>
                    <div>
                      <TextField
                          id="txt-field-tokens-collected"
                          label="Game address"
                          value={this.state.gameAddress}
                          onChange={this.handleGameAddressChange}
                          disabled={false}
                          variant="filled"
                      />
                      <TextField
                          id="txt-field-tokens-balance"
                          label="Player secret key"
                          value={this.state.playerSecretKey}
                          onChange={this.handlePlayerSecretKeyChange}
                          disabled={false}
                          variant="filled"
                      />
                    </div>
                    <div>
                      <TextField
                          id="txt-field-tokens-collected"
                          label="Player address"
                          value={this.state.playerAddress}
                          disabled={true}
                          variant="filled"
                      />
                      </div>
                  </Box>
              </div>
              <Button variant="contained" onClick={this.registerPlayerAndOpenGame}>Register Player</Button>
            </Box>
          </Modal>
  
          <ToastContainer />
        
        </React.Fragment>
      )
    } else {
      return <Navigate to="/play" replace state={this.state as IPropState} />;
    }
  }
}