import { Client, IAccount, ICallData, IProvider, ProviderType, WalletClient } from "@massalabs/massa-web3";
import { IContractData } from "@massalabs/massa-web3";
import { IEventFilter } from "@massalabs/massa-web3";
import { ClientFactory, DefaultProviderUrls } from "@massalabs/massa-web3";
import { SmartContractUtils } from "@massalabs/massa-sc-utils";
import { IEvent } from "@massalabs/massa-web3";
import { EventPoller } from "@massalabs/massa-web3";
import { EOperationStatus } from "@massalabs/massa-web3";
import { PathLike } from "fs";
import { ICompiledSmartContract } from "@massalabs/massa-sc-utils/dist/interfaces/ICompiledSmartContract";
const path = require("path");
const fs = require("fs");
const prompt = require("prompt");
const chalk = require("chalk");
const ora = require("ora");
const exec = require("child_process").exec;

const SC_FOLDER: PathLike = "./game";
const BUILD_FOLDER: PathLike = `${SC_FOLDER}/build`;
const WASM_TO_DEPLOY: string = "callerEngine.wasm";

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
console.log(`Welcome to ${chalk.green.bold("Massa Starship Game Engine Runner Deployer Interactive Prompt")}`);
console.log(header);

prompt.start();
let spinner;

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
				spinner = ora(`Running ${chalk.green("yarn install")} on submodules`).start();
				waitP.push(initSubmodules());
				await Promise.all(waitP);
				spinner.succeed(`Submodules ${chalk.green("successfully")} initialized`);
			} catch (ex) {
				const msg = chalk.red(`Error running yarn install on submodules`);
				spinner.fail(msg);
				throw new Error(ex);
			}
		}

		// if required build sc
		const commandToRun = "yarn run asbuild:engine && yarn run asbuild:engine:caller";
		if (shouldBuildSmartContract) {
			try {
				spinner = ora(`Running ${chalk.green(commandToRun)} on game engine smart contracts`).start();
				await execute(commandToRun, SC_FOLDER);
				spinner.succeed(`Smart contracts ${chalk.green("successfully")} compiled to wasm`);
			} catch (ex) {
				const msg = chalk.red(`Error running ${commandToRun} on smart contracts`);
				spinner.fail(msg);
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

		const wasmFile: string = `./${BUILD_FOLDER}/${WASM_TO_DEPLOY}`;
		if (!fs.existsSync(wasmFile)) {
			throw new Error(`The wasm file under ${wasmFile} does not exist. Maybe you forgot to add BuildSmartContracts?`);
		}
		const fee: number = result.fee;
		const maxGas: number = result.maxGas;
		const gasPrice: number = result.gasPrice;
		const coins: number = result.coins;

		// construct a sc utils helper
		const utils = new SmartContractUtils();

		// compile sc from wasm file ready for deployment
		spinner = ora(`Running ${chalk.green("compilation")} of smart contract on path ${chalk.yellow(wasmFile)}....`).start();
		let compiledSc: ICompiledSmartContract;
		try {
			compiledSc = await utils.compileSmartContractFromWasmFile(wasmFile);
			spinner.succeed(`Smart Contract ${chalk.green("successfully")} compiled to deployable bytecode under ${wasmFile}`);
		} catch (ex) {
			const msg = chalk.red(`Error compiling smart contract on path ${chalk.yellow(wasmFile)}`);
			spinner.fail(msg);
			throw new Error(ex);
		}

		if (!compiledSc.base64) {
			const msg = chalk.red(`No bytecode to deploy for wasm file ${chalk.yellow(wasmFile)}. Check AS compiler`);
			spinner.fail(msg);
			throw new Error(msg);
		}

		// deploy smart contract
		spinner = ora(`Running ${chalk.green("deployment")} of smart contract....`).start();
		let deployTxId: string[] = [];
		let deploymentOperationId: string;
		try {
			deployTxId = await web3Client.smartContracts().deploySmartContract({
				fee,
				maxGas,
				gasPrice,
				coins,
				contractDataBase64: compiledSc.base64
			} as IContractData, deployerAccount);

			if (deployTxId.length === 0) {
				throw new Error(`No transaction ids were produced by the deployment. Something went wrong. Please check your contract and network`);
			}
			deploymentOperationId = deployTxId[0];
			spinner.succeed(`Smart Contract ${chalk.green("successfully")} deployed to ${chalk.yellow(networkID)}. Operation ID ${chalk.yellow(deploymentOperationId)}`);
		} catch (ex) {
			const msg = chalk.red(`Error deploying smart contract ${chalk.yellow(wasmFile)} to network ${chalk.yellow(networkID)}`);
			spinner.fail(msg);
			throw new Error(ex);
		}

		// await final state
		spinner = ora(`Awaiting ${chalk.green("FINAL")} transaction status....`).start();
		let status: EOperationStatus;
		try {
			status = await web3Client.smartContracts().awaitRequiredOperationStatus(deploymentOperationId, EOperationStatus.FINAL);
			spinner.succeed(`Transaction with Operation ID ${chalk.yellow(deploymentOperationId)} has reached finality!`);
		} catch (ex) {
			const msg = chalk.red(`Error getting finality of transaction ${chalk.yellow(deploymentOperationId)}`);
			spinner.fail(msg);
			throw new Error(ex);
		}

		if (status !== EOperationStatus.FINAL) {
			const msg = chalk.red(`Transaction ${chalk.yellow(deploymentOperationId)} did not reach finality after considerable amount of time. Try redeploying anew`);
			spinner.fail(msg);
			throw new Error(msg);
		}

		// poll smart contract events for the opId and find an event that contains the emitted sc address
		spinner = ora(`Getting smart contract address...`).start();
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

			const addressEvent: IEvent|undefined = events.find(event => event.data.includes("Address:"));
			if (!addressEvent) {
				throw new Error("No events were emitted from contract containing a message `Address:...`. Please make sure to include such a message in order to fetch the sc address");
			}
			scAddress = addressEvent.data.split(":")[1];
			spinner.succeed(`Smart Contract Address = ${chalk.yellow(scAddress)}`);
		} catch (ex) {
			const msg = chalk.red(`Error getting smart contract address. Maybe you forgot to emit an event of the type "Address:xyz" ?`);
			spinner.fail(msg);
			throw new Error(msg);
		}
	} catch (err) {
		console.error(`Deployment error: ${chalk.red(err)}`);
		process.exit(1);
	}
});
