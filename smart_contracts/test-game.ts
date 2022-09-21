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

        const scAddress = "A12UKBNkzj3gGjSytoWMZ3S2WdGzpDxTqYyUo3zHRngLmfRTBrPb";

        // call sc function
        console.log(`Calling smart contract function...`);
        const callTxId = await web3Client.smartContracts().callSmartContract({
            fee: 0,
            gasPrice: 0,
            maxGas: 200000,
            parallelCoins: 0,
            sequentialCoins: 0,
            targetAddress: scAddress,
            functionName: "registerPlayer", //playerAddress
            parameter: "A12A2NAA3tTs9dW2t3MnoxpbADdLV7gWE9Le9BygsbTgjcFmMj4o",
        } as ICallData);
        const callScOperationId = callTxId[0];
        console.log(`Called smart contract with operation ID ${(callScOperationId)}`);
        
        

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