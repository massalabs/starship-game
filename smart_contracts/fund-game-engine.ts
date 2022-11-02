import { Client, IAccount, IProvider, ProviderType, WalletClient } from "@massalabs/massa-web3";
import { IContractData } from "@massalabs/massa-web3";
import { IEventFilter } from "@massalabs/massa-web3";
import { ClientFactory, DefaultProviderUrls } from "@massalabs/massa-web3";
import { IEvent } from "@massalabs/massa-web3";
import { EventPoller } from "@massalabs/massa-web3";
import { PathLike } from "fs";
import { deploySmartContract } from "@massalabs/massa-sc-utils"
const path = require("path");
const fs = require("fs");
const prompt = require("prompt");
const chalk = require("chalk");
const exec = require("child_process").exec;
const Handlebars = require("handlebars");

const SC_FOLDER: PathLike = "./game";
const BUILD_FOLDER: PathLike = `${SC_FOLDER}/build`;
const FUNDER_SC: string = `${SC_FOLDER}/assembly/starshipToken/funder.ts`;
const FUNDER_SC_TEMPLATE: string = `${FUNDER_SC}.tmpl`;
const FUNDER_WASM_TO_DEPLOY: string = "funderStarshipToken.wasm";

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

const schema = {
	properties: {
		shouldBuildSmartContract: {
			description: "Build Funder Smart Contract? (y/n)",
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
		tokenAddress: {
			description: "Massa Token Contract Address",
			message: "Contract Address be base58 encoded",
			type: "string",
			hidden: false,
			required: true
		},
		receiverAddress: {
			description: "Tokens Receiver Address",
			message: "Tokens Receiver Address be base58 encoded",
			type: "string",
			hidden: false,
			required: true
		},
		amountToSend: {
			description: "Amount to send",
			required: true,
			type: "number",
			default: 10
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
console.log(`Welcome to ${chalk.green.bold("Funding the game engine Interactive Prompt")}`);
console.log(header);

prompt.start();

prompt.get(schema, async (err, result) => {

	if (err) {
		console.error(`Prompt error: ${chalk.red(err)}`);
		process.exit(1);
	}

	const shouldBuildSmartContract = result.shouldBuildSmartContract === "y" || result.shouldBuildSmartContract === "Y";

	try {
		// get input from prompt and init a web3 client
		const deployerSecretKey: string = result.deployerSecretKey;
		let deployerAccount: IAccount;
		try {
			deployerAccount = await WalletClient.getAccountFromSecretKey(deployerSecretKey);
		} catch (ex) {
			throw new Error(`Wrong private key. Deployer account could not be initialized: ${ex}`);
		}

		// get input from prompt
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

		// ============================= COMPILE + DEPLOY GAME FUNDER ========================== //

		// get token address from input
		const tokenAddress = result.tokenAddress;

		// get game address from input
		const receiverAddress = result.receiverAddress;

		// get amount to send
		const amountToSend = result.amountToSend;

        // check template file path
        if (!fs.existsSync(FUNDER_SC_TEMPLATE)) {
            throw new Error(`The template file under ${FUNDER_SC_TEMPLATE} does not exist. Please check for an existing template file?`);
        }
		// read template
		let templateContents = fs.readFileSync(FUNDER_SC_TEMPLATE, {encoding: "utf8"});
		// compile template
		let initScTemplate = Handlebars.compile(templateContents);
		// render template
		let renderedTemplate = initScTemplate({ tokenAddress: tokenAddress, receiverAddress: receiverAddress, amountToSend: amountToSend });
		// write contents to a file
		fs.writeFileSync(FUNDER_SC, renderedTemplate, { flag: "w+" });

		// build runner sc
		const commandToRun = "yarn run asbuild:token:funder";
		try {
			console.log(`Running ${chalk.green(commandToRun)} on token smart contracts`);
			await execute(commandToRun, SC_FOLDER);
			console.log(`Smart contracts ${chalk.green("successfully")} compiled to wasm`);
		} catch (ex) {
			const msg = chalk.red(`Error running ${commandToRun} on smart contracts`);
			console.error(msg);
			throw new Error(ex);
		}

		// delete rendered template ts file
		fs.unlinkSync(FUNDER_SC);

		// check file path
		const wasmFile = `./${BUILD_FOLDER}/${FUNDER_WASM_TO_DEPLOY}`;
		if (!fs.existsSync(wasmFile)) {
			throw new Error(`The wasm file under ${wasmFile} does not exist. Maybe you forgot to add BuildSmartContracts?`);
		}

		// compile + deploy sc
		let deploymentOperationId = null;
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

		// get smart contract events
		console.log(`Getting smart contract events...`);
		try {
			const eventsFilter = {
				start: null,
				end: null,
				original_caller_address: null,
				original_operation_id: deploymentOperationId,
				emitter_address: null,
			} as IEventFilter;
			const events: Array<IEvent> = await EventPoller.getEventsOnce(eventsFilter, web3Client);
			console.log("................... GAME FUNDER EVENTS ................... \n");
			console.log(events);
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
