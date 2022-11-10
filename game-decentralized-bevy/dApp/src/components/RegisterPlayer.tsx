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
import { IPlayerOnchainEntity } from "../entities/PlayerEntity";
import { registerPlayer, isPlayerRegistered, getPlayerPos, getPlayerExecutors } from "../gameMethods";
import { generateThreadAddressesMap, getProviderUrl, networks, networkValues } from "../utils/massa";
import { Navigate } from "react-router-dom";
import ReactScrollableList from 'react-scrollable-list';

const style = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  height: 800,
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
  gameAddress: string|undefined;
  playerSecretKey: string|undefined;
  playerAddress: string|undefined;
  playerName: string|undefined;
  playerUuid: string|undefined;
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
      playerAddress: '',
      gameAddress: '',
      playerSecretKey: '',
      playerName: '',
      playerUuid: '',
      networkName: networks.IMMONET.value,
      showModal: true,
      isPlayerRegistered: false,
      threadAddressesMap: new Map<number, IAccount>(),
      isRegisteringPlayer: false,
    };

    this.showModal = this.showModal.bind(this);
    this.hideModal = this.hideModal.bind(this);
    this.registerPlayerAndOpenGame = this.registerPlayerAndOpenGame.bind(this);
    this.checkForRegisteredPlayer = this.checkForRegisteredPlayer.bind(this);
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
      //console.error(ex);
      that.setState({ playerAddress: "wrong secret key" });
    })
  };

  handleNetworkChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ networkName: event.target.value });
  };

  async componentDidMount(): Promise<void> {

  }

  async checkForRegisteredPlayer(): Promise<void> {

    if (!this.state.playerSecretKey || !this.state.playerSecretKey.startsWith("S")) {
      toast(`Bad secret key found. Please add one`,{
        className: "toast",
        type: "error"
      });
      return;
    }
    if (!this.state.playerAddress || !this.state.playerAddress.startsWith("A")) {
      toast(`Bad player address found. Please add a legit secret key`,{
        className: "toast",
        type: "error"
      });
      return;
    }
    if (!this.state.networkName) {
      toast(`No network name found. Please select one`,{
        className: "toast",
        type: "error"
      });
      return;
    }
    if (!this.state.gameAddress || !this.state.gameAddress.startsWith("A")) {
      toast(`Bad game address found. Please add a correct one`,{
        className: "toast",
        type: "error"
      });
      return;
    }
    // create a new base account
    let web3Client: Client|undefined = undefined;
    let baseAccount: IAccount|undefined = undefined;
    try {
      baseAccount = await WalletClient.getAccountFromSecretKey(this.state.playerSecretKey);
      web3Client = await ClientFactory.createCustomClient(getProviderUrl(this.state.networkName), true, baseAccount);
    } catch (ex) {
      console.error(`Error loading web3 client`, ex);
    }

    // check if player is registered
    let hasPlayerRegistered: boolean = false;
    try {
      hasPlayerRegistered = await isPlayerRegistered(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
    } catch (ex) {
      console.error("Error getting is player registered...", ex);
      this.setState({ isRegisteringPlayer: false });
    }

    let playerEntity: IPlayerOnchainEntity|undefined = undefined;
    let threadAddressesMap = new Map<number, IAccount>();
    if (hasPlayerRegistered) {
      // get player position
      try {
        playerEntity = await getPlayerPos(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
        toast(`Player Already Registered!`,{
          className: "toast",
          type: "success"
        });
      } catch (ex) {
        console.error("Error fetching chain data...", ex);
        toast(`Error fetching player chain data ${(ex as Error).message}!`,{
          className: "toast",
          type: "error"
        });
      }
      // get player executors
      try {
        threadAddressesMap = await getPlayerExecutors(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
      } catch (ex) {
        console.error("Error getting player executors...", ex);
        toast(`Error getting player executors ${(ex as Error).message}!`,{
          className: "toast",
          type: "error"
        });
      }
    } else {
      toast(`Player is not registered!`,{
        className: "warning",
        type: "warning"
      });
    }
 
    // update react state
    if (playerEntity) {
      this.setState({
        playerName: playerEntity.name,
        playerUuid: playerEntity.uuid,
        threadAddressesMap: Object.fromEntries(threadAddressesMap) 
      });
    }
  }

  async registerPlayerAndOpenGame(): Promise<void> {

    if (!this.state.playerSecretKey || !this.state.playerSecretKey.startsWith("S")) {
      toast(`Bad secret key found. Please add one`,{
        className: "toast",
        type: "error"
      });
      return;
    }
    if (!this.state.playerAddress || !this.state.playerAddress.startsWith("A")) {
      toast(`Bad player address found. Please add a legit secret key`,{
        className: "toast",
        type: "error"
      });
      return;
    }
    if (!this.state.networkName) {
      toast(`No network name found. Please select one`,{
        className: "toast",
        type: "error"
      });
      return;
    }
    if (!this.state.gameAddress || !this.state.gameAddress.startsWith("A")) {
      toast(`Bad game address found. Please add a correct one`,{
        className: "toast",
        type: "error"
      });
      return;
    }
    if (!this.state.playerName) {
      toast(`No player name given. Please add one`,{
        className: "toast",
        type: "error"
      });
      return;
    }

    // create a new base account
    let web3Client: Client|undefined = undefined;
    let baseAccount: IAccount|undefined = undefined;
    try {
      baseAccount = await WalletClient.getAccountFromSecretKey(this.state.playerSecretKey);
      web3Client = await ClientFactory.createCustomClient(getProviderUrl(this.state.networkName), true, baseAccount);
    } catch (ex) {
      console.error(`Error loading web3 client`, ex);
      return;
    }
    toast(`Massa Web3 Loaded!`,{
      className: "toast",
      type: "success"
    });

    // check if player is registered
    let hasPlayerRegistered: boolean = false;
    try {
      hasPlayerRegistered = await isPlayerRegistered(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
    } catch (ex) {
      console.error("Error getting is player registered...", ex);
      this.setState({ isRegisteringPlayer: false });
      return;
    }

    // register player if necessary
    let playerEntity: IPlayerOnchainEntity|undefined = undefined;
    let threadAddressesMap: Map<number, IAccount> = new Map();

    // if brand new player
    if (!hasPlayerRegistered) {

      // generate thread addresses map
      try {
        threadAddressesMap = await generateThreadAddressesMap(web3Client as Client);
      } catch (ex) {
        console.error(`Error generating thread addresses map`, ex);
        return;
      }

      console.log("Thread map generated!");
      toast(`Player Thread Executors generated!`,{
        className: "toast",
        type: "success"
      });

      // hide the modal and start registering player
      this.setState({
        isRegisteringPlayer: true,
        showModal: false
      })

      // register the player
      try {
        const executorsSecretKeys = Object.values(Object.fromEntries(threadAddressesMap)).map(item => item.secretKey).join(',');
        playerEntity = await registerPlayer(web3Client as Client, this.state.gameAddress, this.state.playerName, this.state.playerAddress, executorsSecretKeys);
        toast(`Player Just Registered!`,{
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
    } else { // player exists
      // get player position
      try {
        playerEntity = await getPlayerPos(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
      } catch (ex) {
        console.error("Error getting player position...", ex);
        this.setState({ isRegisteringPlayer: false });
        toast(`Error getting player position ${(ex as Error).message}!`,{
          className: "toast",
          type: "error"
        });
      }

      // get player executors
      try {
        threadAddressesMap = await getPlayerExecutors(web3Client as Client, this.state.gameAddress, this.state.playerAddress);
      } catch (ex) {
        console.error("Error getting player executors...", ex);
        this.setState({ isRegisteringPlayer: false });
        toast(`Error getting player executors ${(ex as Error).message}!`,{
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
              playerUuid: playerEntity?.uuid,
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
              <h2 id="child-modal-title">Enter Massa Starship</h2>
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

              <div>
              <Box
                component="form"
                sx={{
                  '& .MuiTextField-root': { m: 1, width: '40ch' },
                }}
                noValidate
                autoComplete="off"
              >
                <ReactScrollableList
                    listItems={Object.entries(this.state.threadAddressesMap).map(entry => {
                      return { id: entry[0], content: entry[1].address }
                    })}
                    heightOfItem={10}
                    maxItemsToRender={10}
                    style={{ color: '#333', textAlign: 'center', justifyContent: 'center', alignItems: 'center' }}
                  />
              </Box>
              </div>
              <div>
                <Button variant="contained" onClick={this.checkForRegisteredPlayer} color='success'>Check Player</Button>
              </div>
              <div>
                <Button variant="contained" onClick={this.registerPlayerAndOpenGame}>Register Player</Button>
              </div>
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