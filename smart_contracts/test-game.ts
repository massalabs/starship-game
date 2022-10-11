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
    IEventFilter,
    INodeStatus} from "@massalabs/massa-web3";

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

        const scAddress = "A1fTDXRPUjsFS5L43cc2oBKt42aQDm8Wg8T9pW5zxGgpcWka41V";
        const playerAddress = "A17iXLYDiRxxjEKpvJNMdbSiTEhrxYzvAUq1dE1E2vF7FyuMck5";
        // ========================================================================= 

        /*
        const readTxData = await web3Client.smartContracts().readSmartContract({
            fee: 0,
            maxGas: 200000,
            simulatedGasPrice: 0,
            targetAddress: scAddress,
            targetFunction: "getCollectiblesState",
            parameter: "",
            callerAddress: playerAddress
        } as IReadData);
        readTxData[0].output_events[0].data.split("@").map(event => {
            console.log(event);
        })
        */
        // ============================================

        // register player
       /*
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

        // poll events
        const events = await EventPoller.getEventsOnce({
            start: null,
            end: null,
            original_operation_id: callScOperationId,
            original_caller_address: null,
            emitter_address: null,
        } as IEventFilter, web3Client);

        console.log("REGISTER PLAYER EVENTS ", events);
        */

        // ============================================

        // remove player
       
        console.log(`Calling smart contract function...`);
        const callTxId = await web3Client.smartContracts().callSmartContract({
            fee: 0,
            gasPrice: 0,
            maxGas: 200000,
            parallelCoins: 0,
            sequentialCoins: 0,
            targetAddress: scAddress,
            functionName: "removePlayer",
            parameter: playerAddress,
        } as ICallData);
        const callScOperationId = callTxId[0];
        console.log(`Called smart contract with operation ID ${(callScOperationId)}`);

        // await final state
        await web3Client.smartContracts().awaitRequiredOperationStatus(callScOperationId, EOperationStatus.FINAL);

        // poll events
        const events = await EventPoller.getEventsOnce({
            start: null,
            end: null,
            original_operation_id: callScOperationId,
            original_caller_address: null,
            emitter_address: null,
        } as IEventFilter, web3Client);

        console.log("REMOVE PLAYER EVENTS ", events);
        

        // ========================================================================= 

        // poll sc events

        /*
        let nodeStatusInfo: INodeStatus|null|undefined = null;
        try {
          nodeStatusInfo = await web3Client.publicApi().getNodeStatus();
        } catch(ex) {
          console.log("Error getting node status");
          throw ex;
        }
        const last_slot = (nodeStatusInfo as INodeStatus).last_slot;
        const eventsFilter = {
            start: last_slot,
            end: null,
            original_operation_id: null,
            original_caller_address: null,
            emitter_address: scAddress,
            eventsNameRegex: null,
            is_final: true // only listen for final game events here
          } as IEventRegexFilter;
      
          const gameEventsPoller = EventPoller.startEventsPolling(
            eventsFilter,
            100,
            web3Client
          );
          gameEventsPoller.on(ON_MASSA_EVENT_DATA, (events: Array<IEvent>) => {
              const update = events[events.length - 1];
              console.log("BATCH LEN", events.length);
              if (events.length <= 10) {
                events.forEach((e) => console.log("DATA", e.data));
              }
              //console.log("EVENTS (LEN ---- UPDATE)", events.length, update);
          });
          gameEventsPoller.on(ON_MASSA_EVENT_ERROR, (ex) => console.log("ERROR ", ex));
        */

        

        // ========================================================================= 

        // set player coordinates
        /*
        console.log(`Calling smart contract function...`);
        const callTxId = await web3Client.smartContracts().callSmartContract({
            fee: 0,
            gasPrice: 0,
            maxGas: 200000,
            parallelCoins: 0,
            sequentialCoins: 0,
            targetAddress: scAddress,
            functionName: "setAbsCoors",
            parameter: `{"uuid":"uuid-1205432386623302912","address":"A1vEpk323ApQe49fc62BFCFQWATKV5pg1XaXVDg839WRi435HLu","x":1.0,"y":2.0,"rot":90.0,"cbox":30.0,"tokensCollected":0.0}`,
        } as ICallData);
        const callScOperationId = callTxId[0];
        console.log(`Called smart contract with operation ID ${(callScOperationId)}`);
        
        // await final state
        await web3Client.smartContracts().awaitRequiredOperationStatus(callScOperationId, EOperationStatus.FINAL);

        // poll events
        const events = await EventPoller.getEventsOnce({
            start: null,
            end: null,
            original_operation_id: callScOperationId,
            original_caller_address: null,
            emitter_address: null,
        } as IEventFilter, web3Client);

        console.log("SET PLAYER COORDS EVENTS ", events);
        */
        
        // ========================================================================= 

        // get player pos
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

        // ========================================================================= 

        // get player uuid
        /*
        console.log(`Reading a smart contract state...`);
        const readTxId = await web3Client.smartContracts().readSmartContract({
            fee: 0,
            maxGas: 200000,
            simulatedGasPrice: 0,
            targetAddress: scAddress,
            targetFunction: "getRegisteredPlayerUuid",
            parameter: playerAddress,
            callerAddress: playerAddress
        } as IReadData);
        console.log(`Called read contract with operation ID ${(JSON.stringify(readTxId, null, 4))}`);
        console.log("DATA ", readTxId[0].output_events[0].data);
        */

        // ========================================================================= 

        // is player registered
        /*
        console.log(`Reading a smart contract state...`);
        const readTxId = await web3Client.smartContracts().readSmartContract({
            fee: 0,
            maxGas: 200000,
            simulatedGasPrice: 0,
            targetAddress: scAddress,
            targetFunction: "isPlayerRegistered",
            parameter: playerAddress,
            callerAddress: playerAddress
        } as IReadData);
        console.log(`Called read contract with operation ID ${(JSON.stringify(readTxId, null, 4))}`);
        console.log("DATA ", readTxId[0].output_events[0].data);
        */

        // ========================================================================= 

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