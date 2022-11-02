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

        const scAddress = "A15Ji8Ky9fwwXbJGfgYCbwp1edNkyeuaYdmJUVtfXPmgxwgMTRD";
        const playerAddress = "A12CoH9XQzHFLdL8wrXd3nra7iidiYEQpqRdbLtyNXBdLtKh1jvT";
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
            parameter: `{"name":"Evgeni","address":"${playerAddress}"}`,
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
        /*
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
        */

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
            parameter: `{"uuid":"uuid-9016063961940463616","address":"A12thhcEbzPJHw5vyKyJ3Kx3Y6EsvYbeopg6Vg9V8u52mbo2PVqG","x":-200.0,"y":200.0,"rot":90.0,"cbox":64.0,"tokensCollected":0.0}`,
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

        // get active players addresses
        /*
        console.log(`Reading a smart contract state...`);
        const readTxId = await web3Client.smartContracts().readSmartContract({
            fee: 0,
            maxGas: 200000,
            simulatedGasPrice: 0,
            targetAddress: scAddress,
            targetFunction: "getActivePlayersAddresses",
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

        // get player tokens
        /*
        console.log(`Reading a smart contract state...`);
        const readTxId = await web3Client.smartContracts().readSmartContract({
            fee: 0,
            maxGas: 200000,
            simulatedGasPrice: 0,
            targetAddress: scAddress,
            targetFunction: "getPlayerTokens",
            parameter: playerAddress,
            callerAddress: playerAddress
        } as IReadData);
        console.log(`Called read contract with operation ID ${(JSON.stringify(readTxId, null, 4))}`);
        console.log("PLAYER TOKENS ", readTxId[0].output_events[0].data);
        */

        // ========================================================================= 
        /*
        // get collectibles state
        while (true) {
            console.log(`Reading a smart contract state...`);
            const readTxId = await web3Client.smartContracts().readSmartContract({
                fee: 0,
                maxGas: 200000,
                simulatedGasPrice: 0,
                targetAddress: scAddress,
                targetFunction: "getCollectiblesState",
                parameter: playerAddress,
                callerAddress: playerAddress
            } as IReadData);
            const data = readTxId[0].output_events[0].data;
            const tokensArray = data.split("@");
            console.log("PLAYER TOKENS ", tokensArray.length, tokensArray);
        }
        */

        // ========================================================================= 

        // get player balance directly from token
        
        console.log(`Reading a smart contract state...`);
        const readTxId = await web3Client.smartContracts().readSmartContract({
            fee: 0,
            maxGas: 200000,
            simulatedGasPrice: 0,
            targetAddress: scAddress,
            targetFunction: "getPlayerBalance",
            parameter: playerAddress,
            callerAddress: playerAddress
        } as IReadData);
        console.log(`Called read contract with operation ID ${(JSON.stringify(readTxId, null, 4))}`);
        console.log("PLAYER BALANCE ", readTxId[0].output_events[0].data);
        
        

        /*
        const readTxId = await web3Client.smartContracts().readSmartContract({
            fee: 0,
            maxGas: 200000,
            simulatedGasPrice: 0,
            targetAddress: "A12eGhBWxKnfV46FpzuKKYGVyw3UnS7scAZuqv6aBXSxwXcGeA5C",
            targetFunction: "balanceOf",
            parameter: playerAddress,
            callerAddress: playerAddress
        } as IReadData);
        console.log(`Called read contract with operation ID ${(JSON.stringify(readTxId, null, 4))}`);
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
        const scStorageData = await web3Client.publicApi().getDatastoreEntries([{address: scAddress, key: `registered_players_states_key::${playerAddress}` } as IDatastoreEntryInput]);
        console.log(`Got smart contract storage data for key: ${(JSON.stringify(scStorageData, null, 4))}`);
        */


        // =================MINT TOKENS==========================================

        // get player balance directly from token
        /*
        const callTxId = await web3Client.smartContracts().callSmartContract({
            fee: 0,
            gasPrice: 0,
            maxGas: 200000,
            parallelCoins: 0,
            sequentialCoins: 0,
            targetAddress: scAddress,
            functionName: "setAbsCoors",
            parameter: `{"uuid":"uuid-9016063961940463616","address":"A12thhcEbzPJHw5vyKyJ3Kx3Y6EsvYbeopg6Vg9V8u52mbo2PVqG","x":-200.0,"y":200.0,"rot":90.0,"cbox":64.0,"tokensCollected":0.0}`,
        } as ICallData);
        const callScOperationId = callTxId[0];
        console.log(`Called smart contract with operation ID ${(callScOperationId)}`);
        */

        // ============================== BALANCEOF =============================== //
        /*
        console.log(`Reading a smart contract state...`);
        const tokenAddress = "A1kUp69iNXuioUejN7tcA2Tgg7wUyZTaED12v3iTR8xtrrac266";
        const addressForBalance = "A12ZD25Mn281yRNHvq54Cy4htmvj1mT2Syp2w5jgwxiHLRvq1zsz";
        const readTxId = await web3Client.smartContracts().readSmartContract({
            fee: 0,
            maxGas: 200000,
            simulatedGasPrice: 0,
            targetAddress: tokenAddress,
            targetFunction: "balanceOf",
            parameter: addressForBalance,
            callerAddress: addressForBalance
        } as IReadData);
        console.log(`Called read contract with operation ID ${(JSON.stringify(readTxId, null, 4))}`);
        */

    } catch (ex) {
        const msg = console.log(`Error = ${(ex as Error).message}`);
        console.error(msg);
    }
})();