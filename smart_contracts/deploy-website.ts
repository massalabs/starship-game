import { IAccount, ICallData, WalletClient } from "@massalabs/massa-web3";
import { IContractData } from "@massalabs/massa-web3";
import { IEventFilter } from "@massalabs/massa-web3";
import { ClientFactory, DefaultProviderUrls } from "@massalabs/massa-web3";
import { SmartContractUtils } from "@massalabs/massa-sc-utils";
import { IEvent } from "@massalabs/massa-web3";
import { EventPoller } from "@massalabs/massa-web3";
import { EOperationStatus } from "@massalabs/massa-web3";
import { PathLike } from "fs";
const path = require("path");
const fs = require("fs");
const prompt = require("prompt");
const chalk = require("chalk");
const ora = require("ora");
const exec = require("child_process").exec;
import { zip, COMPRESSION_LEVEL } from "zip-a-folder";
import { ICompiledSmartContract } from "@massalabs/massa-sc-utils/dist/interfaces/ICompiledSmartContract";

const DAPP_FOLDER: PathLike = "../dApp";
const DAPP_ENV_FILE: PathLike = ".env";
const SC_FOLDER: PathLike = "./player_move";
const SITE_FILENAME: PathLike = "site.zip";
const SITE_TS_FILENAME: PathLike = "website.ts";
const SITE_WASM_FILENAME: PathLike = "website.wasm";
const DNS_RESOLVER_SC_TESTNET_ADDRESS = "A12o8tw83tDrA52Lju9BUDDodAhtUp4scHtYr8Fj4iwhDTuWZqHZ";
const DNS_RESOLVER_SC_LABNET_ADDRESS = "A12o8tw83tDrA52Lju9BUDDodAhtUp4scHtYr8Fj4iwhDTuWZqHZ"; // check!
const DNS_RESOLVER_SC_MAINNET_ADDRESS = "A12o8tw83tDrA52Lju9BUDDodAhtUp4scHtYr8Fj4iwhDTuWZqHZ"; // check!

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
	await execute("npm install", installPath);
};

const initSubmodules = async (): Promise<void> => {
	await npmInstall(DAPP_FOLDER);
	await npmInstall(SC_FOLDER);
};

const schema = {
	properties: {
		deployDappOnMassa: {
			description: "Deploy dApp on Massa? (y/n)",
			pattern: "^(?:Y|y|N|n)$",
			default: "y",
		},
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
			pattern: "(MAINNET|TESTNET|LABNET)",
			type: "string",
			default: "LABNET",
			required: true
		},
		deployerPrivateKey: {
			description: "Deployer Account Private Key",
			message: "Private key must be base58 encoded",
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
			default: 200000
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
console.log(`Welcome to ${chalk.green.bold("Massa Starship Deployer Interactive Prompt")}`);
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
	const deployDappOnMassa = result.deployDappOnMassa === "y" || result.deployDappOnMassa === "Y";

	try {

		// if required, install npm on submodules
		if (shouldNpmInstall) {
			try {
				const waitP: Array<Promise<void>> = [];
				spinner = ora(`Running ${chalk.green("npm install")} on submodules`).start();
				waitP.push(initSubmodules());
				await Promise.all(waitP);
				spinner.succeed(`Submodules ${chalk.green("successfully")} initialized`);
			} catch (ex) {
				const msg = chalk.red(`Error running npm install on submodules`);
				spinner.fail(msg);
				throw new Error(ex);
			}
		}

		// if required build sc
		if (shouldBuildSmartContract) {
			try {
				spinner = ora(`Running ${chalk.green("npm build")} on smart contracts`).start();
				await execute("npm run build", SC_FOLDER);
				spinner.succeed(`Smart contracts ${chalk.green("successfully")} compiled to wasm`);
			} catch (ex) {
				const msg = chalk.red(`Error running npm build on smart contracts`);
				spinner.fail(msg);
				throw new Error(ex);
			}
		}

		// get input from prompt
		const networkID: string = result.networkID.toUpperCase();
		let selectedNetwork: DefaultProviderUrls = DefaultProviderUrls.TESTNET;
		let dnsResolverAddress: string = DNS_RESOLVER_SC_TESTNET_ADDRESS;
		switch (networkID) {
			case "TESTNET": {
				selectedNetwork = DefaultProviderUrls.TESTNET;
				dnsResolverAddress = DNS_RESOLVER_SC_TESTNET_ADDRESS;
				break;
			}
			case "MAINNET": {
				selectedNetwork = DefaultProviderUrls.MAINNET;
				dnsResolverAddress = DNS_RESOLVER_SC_MAINNET_ADDRESS;
				break;
			}
			case "LABNET": {
				selectedNetwork = DefaultProviderUrls.LABNET;
				dnsResolverAddress = DNS_RESOLVER_SC_LABNET_ADDRESS;
				break;
			}
			default: {
				throw new Error(`Unknown network selected: ${networkID}`);
			}
		}

		const deployerPrivateKey: string = result.deployerPrivateKey;
		const wasmFile: string = `./${SC_FOLDER}/build/deploy.wasm`;
		if (!fs.existsSync(wasmFile)) {
			throw new Error(`The wasm file under ${wasmFile} does not exist. Maybe you forgot to add BuildSmartContracts?`);
		}
		const fee: number = result.fee;
		const maxGas: number = result.maxGas;
		const gasPrice: number = result.gasPrice;
		const coins: number = result.coins;

		// init deployer account and a web3 client
		let deployerAccount: IAccount;
		try {
			deployerAccount = await WalletClient.getAccountFromSecretKey(deployerPrivateKey);
		} catch (ex) {
			throw new Error(`Wrong private key. Deployer account could not be initialized: ${ex}`);
		}
		const web3Client = await ClientFactory.createDefaultClient(selectedNetwork, true, deployerAccount);

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

		// deploy zip site on massa
		if (deployDappOnMassa) {
			// build .env file for dapp with sc address
			const envFile = path.join(__dirname, DAPP_FOLDER, DAPP_ENV_FILE);
			fs.writeFileSync(envFile, `REACT_APP_SC_ADDRESS=${scAddress}`);
			const fileContents = fs.readFileSync(`${envFile}`, "utf8");
			console.log(`Written file to ${envFile} with contents: `, fileContents);

			// build the dapp fe
			try {
				spinner = ora(`Running ${chalk.green("build")} on React App`).start();
				await execute(`npm run build`, DAPP_FOLDER);
				spinner.succeed(`${chalk.green("React App")} successfully created a build folder`);
			} catch (ex) {
				const msg = chalk.red(`Error building the Dapp build folder`);
				spinner.fail(msg);
				throw new Error(ex);
			}

			// zipping dapp build folder
			const zipSourceFolder = path.join(__dirname, DAPP_FOLDER, "build/");
			const zipFileDest = path.join(__dirname, DAPP_FOLDER, SITE_FILENAME);
			try {
				spinner = ora(`Running ${chalk.green("zip")} on React App build folder`).start();
				await zip(zipSourceFolder, zipFileDest, {compression: COMPRESSION_LEVEL.high}); // this will overwrite any existing zip file
				spinner.succeed(`${chalk.green("React App build")} successfully zipped into ${SITE_FILENAME}`);
			} catch (ex) {
				const msg = chalk.red(`Error zipping dapp folder into ${SITE_FILENAME}`);
				spinner.fail(msg);
				throw new Error(ex);
			}

			// copy the site.zip to sc directory build
			const copyZipFileDest = path.join(__dirname, SC_FOLDER, "build", SITE_FILENAME);
			fs.copyFileSync(zipFileDest, copyZipFileDest);

			// running massa-scripts to convert site.zip to a wasm sc
			try {
				spinner = ora(`Running ${chalk.green("build:website")} in smart contract folder`).start();
				await execute(`npm run build:website`, SC_FOLDER);
				spinner.succeed(`${chalk.green(`${SITE_FILENAME}`)} bytecode successfully converted to .wasm`);
			} catch (ex) {
				const msg = chalk.red(`Error building wasm file out of ${SITE_FILENAME}`);
				spinner.fail(msg);
				throw new Error(ex);
			}

			// remove the zip files
			if (fs.existsSync(zipFileDest)) {
				//fs.unlinkSync(zipFileDest);
			}
			if (fs.existsSync(copyZipFileDest)) {
				//fs.unlinkSync(copyZipFileDest);
			}
			// remove the website.ts
			const siteTsFile = path.join(__dirname, SC_FOLDER, SITE_TS_FILENAME);
			if (fs.existsSync(siteTsFile)) {
				// fs.unlinkSync(siteTsFile);
			}

			// finally deploy the website.wasm
			const websiteWasmFile = path.join(__dirname, SC_FOLDER, "build", SITE_WASM_FILENAME);
			if (!fs.existsSync(websiteWasmFile)) {
				throw new Error(`Could not find ${websiteWasmFile} file under the sc directory in build`);
			}

			// compile sc from wasm file ready for deployment
			spinner = ora(`Running ${chalk.green("compilation")} of smart contract on path ${chalk.yellow(websiteWasmFile)}....`).start();
			const compiledSc: ICompiledSmartContract = await utils.compileSmartContractFromWasmFile(websiteWasmFile);
			if (!compiledSc.base64) {
				const msg = chalk.red(`Error compiling smart contract on path ${chalk.yellow(websiteWasmFile)}. No bytecode to deploy. Check AS compiler`);
				throw new Error(msg);
			}
			spinner.succeed(`Smart Contract ${chalk.green("successfully")} compiled to deployable bytecode`);

			// deploy smart contract
			spinner = ora(`Running ${chalk.green("deployment")} of decentralized website smart contract....`).start();
			const deployTxId = await web3Client.smartContracts().deploySmartContract({
				fee,
				maxGas,
				gasPrice,
				coins,
				contractDataBase64: compiledSc.base64
			} as IContractData);
			const deploymentOperationId = deployTxId[0];
			spinner.succeed(`Deployed Smart Contract ${chalk.green("successfully")} with opId ${deploymentOperationId}`);

			/*
			try {
				spinner = ora(`Calling DNS smart contract resolver to register site.zip...`).start();
				const callTxId = await web3Client.smartContracts().callSmartContract({
					fee,
					gasPrice,
					maxGas,
					parallelCoins: coins,
					sequentialCoins: coins,
					targetAddress: dnsResolverAddress,
					functionName: "setResolver",
					parameter: JSON.stringify({name: "gol", address: zipSiteAddress})
				} as ICallData);
				const callScOperationId = callTxId[0];
				spinner.succeed(`Called smart contract ${dnsResolverAddress}::setResolver and got operation ID ${chalk.yellow(callScOperationId)}`);
			} catch (ex) {
				const msg = chalk.red(`Error cleaning sc artifacts`);
				spinner.fail(msg);
				throw new Error(ex);
			}
			*/

			// run the clean command in the sc folder
			try {
				spinner = ora(`Running ${chalk.green("clean")} on smart contract artifacts`).start();
				// await execute(`npm run clean`, SC_FOLDER);
				spinner.succeed(`${chalk.green("Clean")} successfully removed all sc artifacts`);
			} catch (ex) {
				const msg = chalk.red(`Error cleaning sc artifacts`);
				spinner.fail(msg);
				throw new Error(ex);
			}
		}

	} catch (err) {
		console.error(`Deployment error: ${chalk.red(err)}`);
		process.exit(1);
	}
});
