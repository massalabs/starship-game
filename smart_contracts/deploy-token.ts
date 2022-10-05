import { Client, IAccount, IProvider, ProviderType, WalletClient } from "@massalabs/massa-web3";
import { IContractData } from "@massalabs/massa-web3";
import { IEventFilter } from "@massalabs/massa-web3";
import { ClientFactory, DefaultProviderUrls } from "@massalabs/massa-web3";
import { deploySmartContract } from "@massalabs/massa-sc-utils";
import { IEvent } from "@massalabs/massa-web3";
import { EventPoller } from "@massalabs/massa-web3";
import { PathLike } from "fs";
const path = require("path");
const fs = require("fs");
const prompt = require("prompt");
const chalk = require("chalk");
const exec = require("child_process").exec;

const SC_FOLDER: PathLike = "./game";
const BUILD_FOLDER: PathLike = `${SC_FOLDER}/build`;
const WASM_TO_DEPLOY: string = "callerStarshipToken.wasm";

const execute = async (command, cwd?: PathLike): Promise<void> => {
	return new Promise((resolve, reject) => {
		exec(command, {cwd}, function(error, stdout, stderr) {
		if (error) {
			return reject(error);
		}
		return resolve(stdout);
		});
	});
};

const npmInstall = async (submodulePath): Promise<void> => {
	const installPath = path.join(__dirname, submodulePath);
	await execute("yarn install", installPath);
};

const initSubmodules = async (): Promise<void> => {
	await npmInstall(SC_FOLDER);
};

const schema = {
	properties: {
		shouldNpmInstall: {
			description: "Run NPM Install? (y/n)",
			pattern: "^(?:Y|y|N|n)$",
			default: "y",
		},
		shouldBuildSmartContract: {
			description: "Build Smart Contract? (y/n)",
			pattern: "^(?:Y|y|N|n)$",
			default: "y",
		},
		networkID: {
			description: "Network ID",
			message: "Must be one of MAINNET/TESTNET/LABNET",
			pattern: "(MAINNET|mainnet|TESTNET|testnet|LABNET|labnet|IMMONET|immonet)",
			type: "string",
			default: "IMMONET",
			required: true
		},
		deployerSecretKey: {
			description: "Deployer Account Secret Key",
			message: "Secret key must be base58 encoded",
			type: "string",
			hidden: true,
			replace: "*",
			required: true
		},
		fee: {
			description: "Fee",
			required: true,
			type: "number",
			default: 0
		},
		maxGas: {
			description: "Max Gas",
			required: true,
			type: "number",
			default: 70000000
		},
		gasPrice: {
			description: "Gas Price",
			required: true,
			type: "number",
			default: 0
		},
		coins: {
			description: "Coins to send with deployment",
			required: true,
			type: "number",
			default: 0,
		},
	}
};

const header = "=".repeat(process.stdout.columns - 1);
console.log(header);
console.log(`Welcome to ${chalk.green.bold("Massa Starship Token Deployer Interactive Prompt")}`);
console.log(header);

prompt.start();

prompt.get(schema, async (err, result) => {

	if (err) {
		console.error(`Prompt error: ${chalk.red(err)}`);
		process.exit(1);
	}

	const shouldNpmInstall = result.shouldNpmInstall === "y" || result.shouldNpmInstall === "Y";
	const shouldBuildSmartContract = result.shouldBuildSmartContract === "y" || result.shouldBuildSmartContract === "Y";

	try {
		// if required, install yarn on submodules
		if (shouldNpmInstall) {
			try {
				const waitP: Array<Promise<void>> = [];
				console.log(`Running ${chalk.green("yarn install")} on submodules`);
				waitP.push(initSubmodules());
				await Promise.all(waitP);
				console.log(`Submodules ${chalk.green("successfully")} initialized`);
			} catch (ex) {
				const msg = chalk.red(`Error running yarn install on submodules`);
				console.error(msg);
				throw new Error(ex);
			}
		}

		// if required build sc
		const commandToRun = "yarn run asbuild:token && yarn run asbuild:token:caller";
		if (shouldBuildSmartContract) {
			try {
				console.log(`Running ${chalk.green(commandToRun)} on token smart contract`);
				await execute(commandToRun, SC_FOLDER);
				console.log(`Smart contracts ${chalk.green("successfully")} compiled to wasm`);
			} catch (ex) {
				const msg = chalk.red(`Error running ${commandToRun} on smart contracts`);
				console.error(msg);
				throw new Error(ex);
			}
		}

		// init deployer account
		const deployerSecretKey: string = result.deployerSecretKey;
		let deployerAccount: IAccount;
		try {
			deployerAccount = await WalletClient.getAccountFromSecretKey(deployerSecretKey);
		} catch (ex) {
			throw new Error(`Wrong private key. Deployer account could not be initialized: ${ex}`);
		}

		// get input from prompt and init a web3 client
		const networkID: string = result.networkID.toUpperCase();
		let selectedNetwork: DefaultProviderUrls = DefaultProviderUrls.TESTNET;
		let web3Client: Client = null;
		try {
			switch (networkID) {
				case "TESTNET": {
					selectedNetwork = DefaultProviderUrls.TESTNET;
					web3Client = await ClientFactory.createDefaultClient(selectedNetwork, true, deployerAccount);
					break;
				}
				case "MAINNET": {
					selectedNetwork = DefaultProviderUrls.MAINNET;
					web3Client = await ClientFactory.createDefaultClient(selectedNetwork, true, deployerAccount);
					break;
				}
				case "LABNET": {
					selectedNetwork = DefaultProviderUrls.LABNET;
					web3Client = await ClientFactory.createDefaultClient(selectedNetwork, true, deployerAccount);
					break;
				}
				case "IMMONET": {
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
					web3Client = await ClientFactory.createCustomClient(providers, true, deployerAccount);
					break;
				}
				default: {
					throw new Error(`Unknown network selected: ${networkID}`);
				}
			}
		} catch (ex) {
			throw new Error(`Error initializing a web3 client: ${ex}`);
		}
		
		const fee: number = result.fee;
		const maxGas: number = result.maxGas;
		const gasPrice: number = result.gasPrice;
		const coins: number = result.coins;

		// check file path
		const wasmFile: string = `./${BUILD_FOLDER}/${WASM_TO_DEPLOY}`;
		if (!fs.existsSync(wasmFile)) {
			throw new Error(`The wasm file under ${wasmFile} does not exist. Maybe you forgot to add BuildSmartContracts?`);
		}

		// compile + deploy sc
		let deploymentOperationId: string|null = null;
		try {
			deploymentOperationId = await deploySmartContract(wasmFile, {
				fee,
				maxGas,
				gasPrice,
				coins,
			} as IContractData, web3Client, true, deployerAccount);
		} catch (ex) {
			const msg = chalk.red(`Error compiling/deploying smart contract on path ${chalk.yellow(wasmFile)}`);
			console.error(msg);
			throw new Error(ex);
		}

		// poll smart contract events for the opId and find an event that contains the emitted sc address
		console.log(`Getting smart contract address...`);
		let scAddress: string;
		try {
			const eventsFilter = {
				start: null,
				end: null,
				original_caller_address: null,
				original_operation_id: deploymentOperationId,
				emitter_address: null,
			} as IEventFilter;
			const events: Array<IEvent> = await EventPoller.getEventsOnce(eventsFilter, web3Client);
			console.log("................... TOKEN EVENTS ................... \n");
			console.log(events);
			const addressEvent: IEvent|undefined = events.find(event => event.data.includes("Address:"));
			if (!addressEvent) {
				throw new Error("No events were emitted from contract containing a message `Address:...`. Please make sure to include such a message in order to fetch the sc address");
			}
			scAddress = addressEvent.data.split(":")[1];
			console.log(`Smart Contract Address = ${chalk.yellow(scAddress)}`);
		} catch (ex) {
			const msg = chalk.red(`Error getting smart contract address. Maybe you forgot to emit an event of the type "Address:xyz" ?`);
			console.error(msg);
			throw new Error(msg);
		}
	} catch (err) {
		console.error(`Deployment error: ${chalk.red(err)}`);
		process.exit(1);
	}
});
