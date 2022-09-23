import React, { Component } from "react";
import './App.css';
import 'react-toastify/dist/ReactToastify.css';
import type {} from '@mui/lab/themeAugmentation';
import TextField from '@mui/material/TextField';
import * as game from "starship";
import Box from '@mui/material/Box';
import LoadingOverlay from 'react-loading-overlay-ts';
import { ToastContainer, toast } from 'react-toastify';

const wait = async (timeMilli: number): Promise<void> => {
	return new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			clearTimeout(timeout);
			return resolve();
		}, timeMilli);
	});
};

// settings consts
const SCREEN_WIDTH = 1000; //px
const SCREEN_HEIGHT = 500; //px

// addresses consts
const GAME_ADDRESS = "A1Y8763Q7HtHBJxnTCRH67NUXGNTsSN2M4ZtqkZ9RmLTzBRAb99"; //process.env.REACT_APP_SC_ADDRESS ||
const PLAYER_ADDRESS = "A12CoH9XQzHFLdL8wrXd3nra7iidiYEQpqRdbLtyNXBdLtKh1jvT"; // TODO: to be read in the UI

interface IProps {}
interface IState {
  wasmError: Error | null;
  wasm: game.InitOutput | null;
  isLoading: boolean,
  playerAddress: string;
  gameAddress: string;
}
export default class WasmDappExample extends Component<IProps, IState> {

  constructor(props: IProps) {
    super(props);

    this.state = {
      wasmError: null,
      wasm: null,
      isLoading: true,
      playerAddress: PLAYER_ADDRESS,
      gameAddress: GAME_ADDRESS,
    };
  }

  async componentDidMount(): Promise<void> {

    // load wasm
    let wasm: game.InitOutput|null = null;
    try {
      wasm = await game.default();
      toast(`Wasm Loaded!`,{
        className: "toast"
      });
    } catch (ex) {
      console.error(`Error loading wasm`, (ex as Error).message);
    }

    // update react state
    this.setState((prevState: IState, _prevProps: IProps) => {
      return { ...prevState,
            wasm,
            isLoading: false,
      };
    }, async () => {
      await wait(3000);
      toast(`Ready GO!`,{
        className: "toast"
      });
    });
  }

  componentWillUnmount(): void {
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
                      label="Player Address"
                      value={this.state.playerAddress}
                      disabled={true}
                      variant="filled"
                    />
                  <TextField
                      id="outlined-name4"
                      label="Game Address"
                      value={this.state.gameAddress}
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