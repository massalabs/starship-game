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
    IContractData,
    IProvider,
    ProviderType} from "@massalabs/massa-web3";

const scAddress = "A1DztVV6kfTPsZTtE18wrj9BF1ff3vkzFBiyLtJw2nxvrtf85js";
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
        const baseAccount: IAccount = await WalletClient.getAccountFromSecretKey("S1LoQ2cyq273f2TTi1qMYH6qgntAtpn85PbMd9qr2tS7S6A64cC");
        //const web3Client = await ClientFactory.createDefaultClient(DefaultProviderUrls.LABNET, true, baseAccount);
        const providers: Array<IProvider> = [
            {
                url: "http://51.75.131.129:33035",
                type: ProviderType.PUBLIC
            } as IProvider,
            {
                url: "http://51.75.131.129:33034",
                type: ProviderType.PRIVATE
            } as IProvider
        ];
        const web3Client = await ClientFactory.createCustomClient(providers, true, baseAccount);

        //====================================================
        
        /*
        console.log(`Filtering for sc events....`);
        const eventsFilter = {
            start: null,
            end: null,
            original_operation_id: null, //"iYuaiRHtq8EydqdtprLrVmswSs1e6FiNqhsrm1dpGFCgM2APn",
            original_caller_address: null,
            emitter_address: scAddress,
            eventsNameRegex: null, //"PLAYER_ADDED",
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
        */
        
        

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
            parameter: "A1vEpk323ApQe49fc62BFCFQWATKV5pg1XaXVDg839WRi435HLu",
        } as ICallData);
        const callScOperationId = callTxId[0];
        console.log(`Called smart contract with operation ID ${(callScOperationId)}`);
        */

        console.log(`Filtering for sc events....`);
        const eventsFilter = {
            start: null,
            end: null,
            original_operation_id: null, //"EGTXVsPFt2RY4iB3GXtNzqWHTej1pdcENNdCB2KrSfvamGmNy",
            original_caller_address: null, //"A12CoH9XQzHFLdL8wrXd3nra7iidiYEQpqRdbLtyNXBdLtKh1jvT",
            emitter_address: null, //"A12CoH9XQzHFLdL8wrXd3nra7iidiYEQpqRdbLtyNXBdLtKh1jvT", //"A12CoH9XQzHFLdL8wrXd3nra7iidiYEQpqRdbLtyNXBdLtKh1jvT", //scAddress,
            eventsNameRegex: null, //"PLAYER_ADDED",
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
            events.filter((e) => {
                return e.data.includes("PLAYER_ADDED=");
            })
            .forEach((e) => console.log("DATA", e.data));
                  
        });
        eventPoller.on(ON_MASSA_EVENT_ERROR, (ex) => console.log("ERROR ", ex));
        

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