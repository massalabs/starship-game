import { deploySmartContract } from "@massalabs/massa-sc-utils";
import { IDatastoreEntryInput,
    WalletClient,
    IReadData,
    ICallData,
    IEvent,
    ClientFactory,
    DefaultProviderUrls,
    IAccount, 
    ISlot,
    EventPoller,
    IEventRegexFilter,
    ON_MASSA_EVENT_DATA,
    ON_MASSA_EVENT_ERROR,
    EOperationStatus,
    IContractData} from "@massalabs/massa-web3";

const scAddress = "A1aC7wPd8CCyks266zCiU3LophK8zzj9fYxwTPBRpbgxRcTYG9t";
const playerAddress = "A12CoH9XQzHFLdL8wrXd3nra7iidiYEQpqRdbLtyNXBdLtKh1jvT";
const gameOwnerAddress = "A12A2NAA3tTs9dW2t3MnoxpbADdLV7gWE9Le9BygsbTgjcFmMj4o";

interface IGameEntity {
    uuid: string;
    playerAddress: string;
    x: number;
    y: number;
    bbMargin: number;
    tokensCollected: number;
    balance: number;
}

(async () => {
    const header = "=".repeat(process.stdout.columns - 1);
    console.log(header);
    console.log(`Game Test Example"`);
    console.log(header);

    try {

        // init client
        const baseAccount: IAccount = await WalletClient.walletGenerateNewAccount();
        const web3Client = await ClientFactory.createDefaultClient(DefaultProviderUrls.LABNET, true, baseAccount);


        //====================================================
        
        
        console.log(`Filtering for sc events....`);
        const eventsFilter = {
            start: null,
            end: null,
            original_operation_id: null,
            original_caller_address: null,
            emitter_address: scAddress,
            eventsNameRegex: "GAME_TOKENS_STATE_UPDATED",
            is_final: true
        } as IEventRegexFilter;
                
        
        const eventPoller = EventPoller.startEventPoller(
            eventsFilter,
            1000,
            web3Client
        );
        eventPoller.on(ON_MASSA_EVENT_DATA, (events: Array<IEvent>) => {
            const element = events[events.length - 1];
            //console.log("SLOT", element.context.slot);
            events.forEach((e) => console.log("DATA", e.data.substring(0, 30)));
                  
        });
        eventPoller.on(ON_MASSA_EVENT_ERROR, (ex) => console.log("ERROR ", ex));
        

        /*
        //const x = await EventPoller.getEventsOnce(eventsFilter, web3Client);
        //console.log(x);
        */

        /*
        await EventPoller.startEventsPollingAsync(
            eventsFilter,
            1000,
            web3Client,
            (events) => {console.log("EVENTS:" , events.length)},
            (ex) => {console.log("ERROR" , ex)});
        */

        //====================================================

        // call sc function
        /*
        console.log(`Calling smart contract function...`);
        const callTxId = await web3Client.smartContracts().callSmartContract({
            fee: 0,
            gasPrice: 0,
            maxGas: 200000,
            parallelCoins: 0,
            sequentialCoins: 0,
            targetAddress: scAddress,
            functionName: "registerPlayer", //playerAddress
            parameter: "A12CoH9XQzHFLdL8wrXd3nra7iidiYEQpqRdbLtyNXBdLtKh1jvT",
        } as ICallData);
        const callScOperationId = callTxId[0];
        console.log(`Called smart contract with operation ID ${(callScOperationId)}`);
        */

        // read sc state
        /*
        console.log(`Reading a smart contract state...`);
        const readTxId = await web3Client.smartContracts().readSmartContract({
            fee: 0,
            maxGas: 200000,
            simulatedGasPrice: 0,
            targetAddress: scAddress,
            targetFunction: "getPlayerPos",
            parameter: playerAddress,
            callerAddress: playerAddress
        } as IReadData);
        console.log(`Called read contract with operation ID ${(JSON.stringify(readTxId, null, 4))}`);
        */



        //const status: EOperationStatus = await web3Client.smartContracts().getOperationStatus("2oiSymQNLUYw7AWxLsCX6qo7SUk9v8Q9ivkN68YsEdQ5aBfXnf");
        //console.log("STATUSSSS ", status);

        // get sc storage data
        /*
        console.log(`Reading a smart state entry...`);
        const scStorageData = await web3Client.publicApi().getDatastoreEntries([{address: scAddress, key: "getMassaTokensState" } as IDatastoreEntryInput]);
        console.log(`Got smart contract storage data for key: ${(JSON.stringify(scStorageData, null, 4))}`);
        */

    } catch (ex) {
        const msg = console.log(`Error = ${(ex as Error).message}`);
        console.error(msg);
    }
})();