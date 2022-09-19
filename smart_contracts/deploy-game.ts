import { IAccount, WalletClient } from "@massalabs/massa-web3";
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
const CALLER_WASM_TO_DEPLOY: string = "callerEngine.wasm";
const RUNNER_SC: string = `${SC_FOLDER}/assembly/gameEngine/runner.ts`;
const RUNNER_SC_TEMPLATE: string = `${RUNNER_SC}.tmpl`;
const RUNNER_WASM_TO_DEPLOY: string = "runnerEngine.wasm";

const STARTER_SC: string = `${SC_FOLDER}/assembly/gameEngine/starter.ts`;
const STARTER_SC_TEMPLATE: string = `${STARTER_SC}.tmpl`;
const STARTER_WASM_TO_DEPLOY: string = "starterEngine.wasm";

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
			pattern: "(MAINNET|mainnet|TESTNET|testnet|LABNET|labnet)",
			type: "string",
			default: "LABNET",
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
console.log(`Welcome to ${chalk.green.bold("Massa Starship Game Engine Deployer Interactive Prompt")}`);
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
		let commandToRun = "yarn run asbuild:engine && yarn run asbuild:engine:caller";
		if (shouldBuildSmartContract) {
			try {
				console.log(`Running ${chalk.green(commandToRun)} on game engine smart contracts`);
				await execute(commandToRun, SC_FOLDER);
				console.log(`Smart contracts ${chalk.green("successfully")} compiled to wasm`);
			} catch (ex) {
				const msg = chalk.red(`Error running ${commandToRun} on smart contracts`);
				console.error(msg);
				throw new Error(ex);
			}
		}

		// get input from prompt
		const networkID: string = result.networkID.toUpperCase();
		let selectedNetwork: DefaultProviderUrls = DefaultProviderUrls.TESTNET;
		switch (networkID) {
			case "TESTNET": {
				selectedNetwork = DefaultProviderUrls.TESTNET;
				break;
			}
			case "MAINNET": {
				selectedNetwork = DefaultProviderUrls.MAINNET;
				break;
			}
			case "LABNET": {
				selectedNetwork = DefaultProviderUrls.LABNET;
				break;
			}
			default: {
				throw new Error(`Unknown network selected: ${networkID}`);
			}
		}

		// init deployer account and a web3 client
		const deployerSecretKey: string = result.deployerSecretKey;
		let deployerAccount: IAccount;
		try {
			deployerAccount = await WalletClient.getAccountFromSecretKey(deployerSecretKey);
		} catch (ex) {
			throw new Error(`Wrong private key. Deployer account could not be initialized: ${ex}`);
		}

		// init a web3 client
		const web3Client = await ClientFactory.createDefaultClient(selectedNetwork, true, deployerAccount);

		const fee: number = result.fee;
		const maxGas: number = result.maxGas;
		const gasPrice: number = result.gasPrice;
		const coins: number = result.coins;

		// ============================= COMPILE + DEPLOY GAME CALLER ========================== //

		// check file path
		let wasmFile: string = `./${BUILD_FOLDER}/${CALLER_WASM_TO_DEPLOY}`;
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
			} as IContractData, selectedNetwork, deployerAccount, true);
		} catch (ex) {
			const msg = chalk.red(`Error compiling/deploying smart contract on path ${chalk.yellow(wasmFile)}`);
			console.error(msg);
			throw new Error(ex);
		}

		// poll smart contract events for the opId and find an event that contains the emitted sc address
		console.log(`Getting smart contract address...`);
		let gameScAddress: string;
		try {
			const eventsFilter = {
				start: null,
				end: null,
				original_caller_address: null,
				original_operation_id: deploymentOperationId,
				emitter_address: null,
			} as IEventFilter;
			const events: Array<IEvent> = await EventPoller.getEventsOnce(eventsFilter, web3Client);
			console.log("................... GAME CALLER EVENTS ................... \n");
			console.log(events);
			const addressEvent: IEvent|undefined = events.find(event => event.data.includes("Address:"));
			if (!addressEvent) {
				throw new Error("No events were emitted from contract containing a message `Address:...`. Please make sure to include such a message in order to fetch the sc address");
			}
			gameScAddress = addressEvent.data.split(":")[1];
			console.log(`Game Smart Contract Address = ${chalk.yellow(gameScAddress)}`);
		} catch (ex) {
			const msg = chalk.red(`Error getting smart contract address. Maybe you forgot to emit an event of the type "Address:xyz" ?`);
			console.error(msg);
			throw new Error(msg);
		}

		// ============================= COMPILE + DEPLOY GAME RUNNER ========================== //

		// get token address from input
		const tokenAddress = result.tokenAddress;

        // check template file path
        if (!fs.existsSync(RUNNER_SC_TEMPLATE)) {
            throw new Error(`The template file under ${RUNNER_SC_TEMPLATE} does not exist. Please check for an existing template file?`);
        }
		// read template
		let templateContents = fs.readFileSync(RUNNER_SC_TEMPLATE, {encoding: "utf8"});
		// compile template
		let initScTemplate = Handlebars.compile(templateContents);
		// render template
		let renderedTemplate = initScTemplate({ tokenAddress, gameAddress: gameScAddress });
		// write contents to a file
		fs.writeFileSync(RUNNER_SC, renderedTemplate, { flag: "w+" });

		// build runner sc
		commandToRun = "yarn run asbuild:engine:runner";
		try {
			console.log(`Running ${chalk.green(commandToRun)} on game engine smart contracts`);
			await execute(commandToRun, SC_FOLDER);
			console.log(`Smart contracts ${chalk.green("successfully")} compiled to wasm`);
		} catch (ex) {
			const msg = chalk.red(`Error running ${commandToRun} on smart contracts`);
			console.error(msg);
			throw new Error(ex);
		}

		// delete rendered template ts file
		fs.unlinkSync(RUNNER_SC);

		// check file path
		wasmFile = `./${BUILD_FOLDER}/${RUNNER_WASM_TO_DEPLOY}`;
		if (!fs.existsSync(wasmFile)) {
			throw new Error(`The wasm file under ${wasmFile} does not exist. Maybe you forgot to add BuildSmartContracts?`);
		}

		// compile + deploy sc
		deploymentOperationId = null;
		try {
			deploymentOperationId = await deploySmartContract(wasmFile, {
				fee,
				maxGas,
				gasPrice,
				coins,
			} as IContractData, selectedNetwork, deployerAccount, true);
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
			console.log("................... GAME RUNNER EVENTS ................... \n");
			console.log(events);
		} catch (ex) {
			const msg = chalk.red(`Error getting smart contract address. Maybe you forgot to emit an event of the type "Address:xyz" ?`);
			console.error(msg);
			throw new Error(msg);
		}

		// ============================= COMPILE + DEPLOY GAME STARTER ========================== //

        // check template file path
        if (!fs.existsSync(STARTER_SC_TEMPLATE)) {
            throw new Error(`The template file under ${STARTER_SC_TEMPLATE} does not exist. Please check for an existing template file?`);
        }
		// read template
		templateContents = fs.readFileSync(STARTER_SC_TEMPLATE, {encoding: "utf8"});
		// compile template
		initScTemplate = Handlebars.compile(templateContents);
		// render template
		renderedTemplate = initScTemplate({ gameAddress: gameScAddress });
		// write contents to a file
		fs.writeFileSync(STARTER_SC, renderedTemplate, { flag: "w+" });

		// build starter sc
		commandToRun = "yarn run asbuild:engine:starter";
		try {
			console.log(`Running ${chalk.green(commandToRun)} on game engine smart contracts`);
			await execute(commandToRun, SC_FOLDER);
			console.log(`Smart contracts ${chalk.green("successfully")} compiled to wasm`);
		} catch (ex) {
			const msg = chalk.red(`Error running ${commandToRun} on smart contracts`);
			console.error(msg);
			throw new Error(ex);
		}

		// delete rendered template ts file
		fs.unlinkSync(STARTER_SC);

		// check file path
		wasmFile = `./${BUILD_FOLDER}/${STARTER_WASM_TO_DEPLOY}`;
		if (!fs.existsSync(wasmFile)) {
			throw new Error(`The wasm file under ${wasmFile} does not exist. Maybe you forgot to add BuildSmartContracts?`);
		}

		// compile + deploy sc
		deploymentOperationId = null;
		try {
			deploymentOperationId = await deploySmartContract(wasmFile, {
				fee,
				maxGas,
				gasPrice,
				coins,
			} as IContractData, selectedNetwork, deployerAccount, true);
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
			console.log("................... GAME STARTER EVENTS ................... \n");
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
