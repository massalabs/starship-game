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
    ProviderType,
    IEventFilter} from "@massalabs/massa-web3";



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
        //const web3Client = await ClientFactory.createDefaultClient(DefaultProviderUrls.LABNET, true, baseAccount);
        const web3Client = await ClientFactory.createCustomClient(providers, true, baseAccount);

        const scAddress = "A129MvYKsK23GRs8sndXYNqo29tf6oiHq2GkCgdGij6dtYMnucyS";
        const playerAddress = "A12PWTzCKkkE9P5Supt3Fkb4QVZ3cdfB281TGaup7Nv1DY12a6F1";

        
  
        
        // call sc function
        console.log(`Calling smart contract function...`);
        const callTxId = await web3Client.smartContracts().callSmartContract({
            fee: 0,
            gasPrice: 0,
            maxGas: 200000,
            parallelCoins: 0,
            sequentialCoins: 0,
            targetAddress: scAddress,
            functionName: "registerPlayer",
            parameter: playerAddress,
        } as ICallData);
        const callScOperationId = callTxId[0];
        console.log(`Called smart contract with operation ID ${(callScOperationId)}`);
        
        // await final state
        await web3Client.smartContracts().awaitRequiredOperationStatus(callScOperationId, EOperationStatus.FINAL);

        const events = await EventPoller.getEventsOnce({
        start: null,
        end: null,
        original_operation_id: callScOperationId,
        original_caller_address: null,
        emitter_address: null,
        } as IEventFilter, web3Client);

        console.log("EVENTSSSSSSSSSSSSSS ", events);
        
        

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
        console.log("DATA ", readTxId[0].output_events[0].data);
        */

        //const status: EOperationStatus = await web3Client.smartContracts().getOperationStatus("2oiSymQNLUYw7AWxLsCX6qo7SUk9v8Q9ivkN68YsEdQ5aBfXnf");
        //console.log("Status ", status);

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