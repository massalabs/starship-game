import React, { Component } from "react";
import LoadingOverlay from 'react-loading-overlay-ts';
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
import { registerPlayer, isPlayerRegistered, getPlayerPos } from "./gameFunctions";
import { generateThreadAddressesMap, getProviderUrl, networks, networkValues } from "./utils";
import { Navigate } from "react-router-dom";

const style = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  height: 600,
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
  playerName: string;
  networkName: string;
  isPlayerRegistered: boolean;
  threadAddressesMap: Object;
} 

export interface IState extends IPropState {
  showModal: boolean;
  isRegisteringPlayer: boolean;
}

export default class RegisterPlayer extends Component<IProps, IState> {

  constructor(props: IProps) {
    super(props);

    this.state = {
      playerAddress: 'N/A',
      gameAddress: "",
      playerSecretKey: "",
      playerName: "N/A",
      networkName: networks.IMMONET.value,
      showModal: true,
      isPlayerRegistered: false,
      threadAddressesMap: new Map<number, IAccount>(),
      isRegisteringPlayer: false,
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

  handlePlayerNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ playerName: event.target.value });
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

    this.setState({
      isRegisteringPlayer: true,
      showModal: false
    })

    // create a new base account
    let web3Client: Client|undefined = undefined;
    let baseAccount: IAccount|undefined = undefined;
    try {
      baseAccount = await WalletClient.getAccountFromSecretKey(this.state.playerSecretKey);
      web3Client = await ClientFactory.createCustomClient(getProviderUrl(this.state.networkName), true, baseAccount);
    } catch (ex) {
      console.error(`Error loading web3 client`, ex);
    }
    toast(`Massa Web3 Loaded!`,{
      className: "toast",
      type: "success"
    });

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
      this.setState({ isRegisteringPlayer: false });
    }

    // register player if necessary
    let playerEntity: IPlayerOnchainEntity|undefined = undefined;
    if (!hasPlayerRegistered) {
      try {
        playerEntity = await registerPlayer(web3Client as Client, this.state.gameAddress, this.state.playerName, this.state.playerAddress);
        toast(`Player Just Registered!`,{
          className: "toast",
          type: "success"
        });
      } catch (ex) {
        console.error("Error registering player...", ex);
        this.setState({ isRegisteringPlayer: false });
        toast(`Error checking for registered player ${(ex as Error).message}!`,{
          className: "toast",
          type: "error"
        });
      }
    } else {
      try {
        playerEntity = await getPlayerPos(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
        toast(`Player Already Registered!`,{
          className: "toast",
          type: "success"
        });
      } catch (ex) {
        console.error("Error registering player...", ex);
        this.setState({ isRegisteringPlayer: false });
        toast(`Error registering player ${(ex as Error).message}!`,{
          className: "toast",
          type: "error"
        });
      }
    }

    // update react state
    if (playerEntity) {
      this.setState((prevState: IState, _prevProps: IProps) => {
        return { ...prevState,
              showModal: false,
              isPlayerRegistered: true,
              threadAddressesMap: Object.fromEntries(threadAddressesMap),
              isRegisteringPlayer: false
        };
      });
    }
  }

  componentWillUnmount(): void {

  }

  render(): JSX.Element {
    if (this.state.showModal && !this.state.isRegisteringPlayer) {
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
                      <TextField
                          id="txt-field-tokens-balance"
                          label="Player name"
                          value={this.state.playerName}
                          onChange={this.handlePlayerNameChange}
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
    } else if (!this.state.showModal && this.state.isRegisteringPlayer) {
      return (
        <LoadingOverlay
          active={this.state.isRegisteringPlayer}
          spinner
          text='Registering player...'
          className="overlay"
        >
        </LoadingOverlay>
      )
    } else {
      return <Navigate to="/play" replace state={this.state as IPropState} />;
    }
  }
}