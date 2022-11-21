import { Client, EOperationStatus, EventPoller, IAccount, ICallData, IContractStorageData, IDatastoreEntryInput, IEventFilter, INodeStatus, IReadData, WalletClient } from "@massalabs/massa-web3";
import { IPlayerOnchainEntity } from "./entities/PlayerEntity";
import { IPlayerLasersRequest } from "./entities/PlayerLasers";
import { ITokenOnchainEntity } from "./entities/TokenEntity";

export const registerPlayer = async (web3Client: Client, gameAddress: string, playerName: string, playerAddress: string, executors: string, awaitFinalization: boolean): Promise<IPlayerOnchainEntity|undefined> => {
    const callTxIds = await web3Client.smartContracts().callSmartContract({
      fee: 0,
      gasPrice: 0,
      maxGas: 200000,
      parallelCoins: 0,
      sequentialCoins: 0,
      targetAddress: gameAddress,
      functionName: "registerPlayer",
      parameter: `{"name":"${playerName}","address":"${playerAddress}", "executors":"${executors}"}`,
    } as ICallData);
    const callScOperationId = callTxIds[0];
  
    console.log("Registered player opId ", callScOperationId);

    // await final state
    if (awaitFinalization) {
      await web3Client.smartContracts().awaitRequiredOperationStatus(callScOperationId, EOperationStatus.FINAL);

      const events = await EventPoller.getEventsOnce({
        start: null,
        end: null,
        original_operation_id: callScOperationId,
        original_caller_address: null,
        emitter_address: null,
      } as IEventFilter, web3Client);
  
      let playerEntity: IPlayerOnchainEntity|undefined = undefined;
      try {
        const eventMessageData = events[0].data.split("=");
        const eventName = eventMessageData.at(0);
        const eventData = eventMessageData.at(1);
        //console.log("EVENT PARTS ", eventName, eventData)
        if (eventName === "PLAYER_ADDED") {
          playerEntity = JSON.parse(eventData as string);
        } else {
          throw new Error("Missing expected event PLAYER ADDED");
        }
      } catch (ex) {
        console.error("Error parsing data for player entity", events[0].data);
        throw ex;
      }
  
      console.log("Registered player", playerEntity);
  
      return playerEntity as IPlayerOnchainEntity;
    }

    return undefined;
}

export const getPlayerPos = async (web3Client: Client, gameAddress: string, playerAddress: string): Promise<IPlayerOnchainEntity> => {
    const readTxData = await web3Client.smartContracts().readSmartContract({
        fee: 0,
        maxGas: 200000,
        simulatedGasPrice: 0,
        targetAddress: gameAddress,
        targetFunction: "getPlayerPos",
        parameter: playerAddress,
        callerAddress: playerAddress
    } as IReadData);

    const eventData = readTxData[0].output_events[0].data;
    let playerEntity: IPlayerOnchainEntity|undefined = undefined;
    try {
        playerEntity = JSON.parse(eventData);
    } catch (ex) {
        console.error("Error parsing data for player entity", eventData);
        throw ex;
    }

    return playerEntity as IPlayerOnchainEntity;
}

export const getPlayerExecutors = async (web3Client: Client, gameAddress: string, playerAddress: string): Promise<Map<number, IAccount>> => {
  const readTxData = await web3Client.smartContracts().readSmartContract({
      fee: 0,
      maxGas: 200000,
      simulatedGasPrice: 0,
      targetAddress: gameAddress,
      targetFunction: "getPlayerExecutors",
      parameter: playerAddress,
      callerAddress: playerAddress
  } as IReadData);

  const eventData = readTxData[0].output_events[0].data;
  let playerExecutors: Array<string> = [];
  try {
    playerExecutors = eventData.split(",");
  } catch (ex) {
      console.error("Error splitting data for player executors", eventData);
      throw ex;
  }

  let threadAddressesMap = new Map<number, IAccount>();
  for (const executorSecretKey of playerExecutors) {
    const executorAccount = await WalletClient.getAccountFromSecretKey(executorSecretKey);
    threadAddressesMap.set(executorAccount.createdInThread as number, executorAccount);
  }

  return threadAddressesMap;
}

export const getPlayerCandidatePositionFromStore = async (web3Client: Client, gameAddress: string, playerAddress: string): Promise<IPlayerOnchainEntity|null> => {
  let scStorageData: IContractStorageData[] = [];
  try {
    scStorageData = await web3Client.publicApi().getDatastoreEntries([{address: gameAddress, key: `registered_players_states_key::${playerAddress}` } as IDatastoreEntryInput]);
  } catch (ex) {
      console.error("Error parsing data for player entity", ex);
      throw ex;
  }

  if (!scStorageData || !scStorageData[0] || !scStorageData[0].candidate) {
    return null;
  }
  const candidatePos = scStorageData[0].candidate;
  let playerEntity: IPlayerOnchainEntity|undefined = undefined;
  try {
      playerEntity = JSON.parse(candidatePos as string);
  } catch (ex) {
      console.error("Error parsing data for player entity", candidatePos);
      throw ex;
  }
  return playerEntity as IPlayerOnchainEntity;
}

export const getPlayerCandidateLasersPositionFromStore = async (web3Client: Client, gameAddress: string, playerAddress: string): Promise<IPlayerLasersRequest|null> => {
  let scStorageData: IContractStorageData[] = [];
  try {
    scStorageData = await web3Client.publicApi().getDatastoreEntries([{address: gameAddress, key: `registered_players_lasers_key::${playerAddress}` } as IDatastoreEntryInput]);
  } catch (ex) {
      console.error("Error parsing data for player entity", ex);
      throw ex;
  }

  if (!scStorageData || !scStorageData[0] || !scStorageData[0].candidate) {
    return null;
  }
  const candidatePos = scStorageData[0].candidate;
  let playerLasersRequest: IPlayerLasersRequest|undefined = undefined;
  try {
    playerLasersRequest = JSON.parse(candidatePos as string);
  } catch (ex) {
      console.error("Error parsing data for player lasers request", candidatePos);
      throw ex;
  }
  return playerLasersRequest as IPlayerLasersRequest;
}


export const isPlayerRegistered = async (web3Client: Client, gameAddress: string, playerAddress: string): Promise<boolean> => {
    const readTxData = await web3Client.smartContracts().readSmartContract({
        fee: 0,
        maxGas: 200000,
        simulatedGasPrice: 0,
        targetAddress: gameAddress,
        targetFunction: "isPlayerRegistered",
        parameter: playerAddress,
        callerAddress: playerAddress
    } as IReadData);
    //console.log("Is Player Registered ? ", readTxData);
    const isRegistered = readTxData[0].output_events[0].data.toLowerCase() === "true" ? true : false;
    return isRegistered;
}

export const getActivePlayersCount = async (web3Client: Client, gameAddress: string, playerAddress: string): Promise<number> => {
  const readTxData = await web3Client.smartContracts().readSmartContract({
      fee: 0,
      maxGas: 200000,
      simulatedGasPrice: 0,
      targetAddress: gameAddress,
      targetFunction: "getActivePlayersCount",
      parameter: playerAddress,
      callerAddress: playerAddress
  } as IReadData);
  return parseInt(readTxData[0].output_events[0].data, 10);
}


// this method will return both candidate and final states
export const getActivePlayersCountFromStore = async (web3Client: Client, gameAddress: string, candidate: boolean = true): Promise<number|null> => {
  let scStorageData: IContractStorageData[] = [];
  try {
    scStorageData = await web3Client.publicApi().getDatastoreEntries([{address: gameAddress, key: `active_players_key`} as IDatastoreEntryInput]);
  } catch (ex) {
      console.error("Error parsing data for player entity", ex);
      throw ex;
  }

  if (!scStorageData || !scStorageData[0]) {
    return null;
  }

  let data: string | null = null;

  // check for candidate data only
  if (candidate && !scStorageData[0].candidate) {
    data = scStorageData[0].candidate;
    return null;
  }

  // check for the opposite: final data only
  if (!candidate && !scStorageData[0].final) {
    data = scStorageData[0].final;
    return null;
  }

  if (!data) {
    return null;
  }

  return parseInt(data, 10);
}

// this function will return candidate states only!
export const getActivePlayersAddresses = async (web3Client: Client, gameAddress: string, playerAddress: string): Promise<Array<string>> => {
  const readTxData = await web3Client.smartContracts().readSmartContract({
      fee: 0,
      maxGas: 200000,
      simulatedGasPrice: 0,
      targetAddress: gameAddress,
      targetFunction: "getActivePlayersAddresses",
      parameter: '',
      callerAddress: playerAddress
  } as IReadData);
  let addresses: Array<string> = [];
  if (readTxData[0].output_events[0].data) {
    addresses = readTxData[0].output_events[0].data.split(",");
  }
  return addresses;
}

// this method will return both candidate and final states
export const getActivePlayersAddressesFromStore = async (web3Client: Client, gameAddress: string, candidate: boolean = true): Promise<Array<string>> => {
  let scStorageData: IContractStorageData[] = [];
  try {
    scStorageData = await web3Client.publicApi().getDatastoreEntries([{address: gameAddress, key: `active_players_addresses_key`} as IDatastoreEntryInput]);
  } catch (ex) {
      console.error("Error parsing data for player entity", ex);
      throw ex;
  }

  if (!scStorageData || !scStorageData[0]) {
    return [];
  }

  let data: string | null = null;

  // check for candidate data only
  if (candidate && !scStorageData[0].candidate) {
    data = scStorageData[0].candidate;
    return [];
  }

  // check for the opposite: final data only
  if (!candidate && !scStorageData[0].final) {
    data = scStorageData[0].final;
    return [];
  }

  if (!data) {
    return [];
  }

  let addresses: Array<string> = (data as string).split(",");

  return addresses;
}

export const getMaximumPlayersCount = async (web3Client: Client, gameAddress: string, playerAddress: string): Promise<number> => {
  const readTxData = await web3Client.smartContracts().readSmartContract({
      fee: 0,
      maxGas: 200000,
      simulatedGasPrice: 0,
      targetAddress: gameAddress,
      targetFunction: "getMaximumPlayersCount",
      parameter: playerAddress,
      callerAddress: playerAddress
  } as IReadData);
  return parseInt(readTxData[0].output_events[0].data, 10);
}

// this method will return both candidate and final states
export const getMaximumPlayersCountFromStore = async (web3Client: Client, gameAddress: string, candidate: boolean = true): Promise<number|null> => {
  let scStorageData: IContractStorageData[] = [];
  try {
    scStorageData = await web3Client.publicApi().getDatastoreEntries([{address: gameAddress, key: `max_players_key`} as IDatastoreEntryInput]);
  } catch (ex) {
      console.error("Error parsing data for player entity", ex);
      throw ex;
  }

  if (!scStorageData || !scStorageData[0]) {
    return null;
  }

  let data: string | null = null;

  // check for candidate data only
  if (candidate && !scStorageData[0].candidate) {
    data = scStorageData[0].candidate;
    return null;
  }

  // check for the opposite: final data only
  if (!candidate && !scStorageData[0].final) {
    data = scStorageData[0].final;
    return null;
  }

  if (!data) {
    return null;
  }

  return parseInt(data, 10);
}

export const getPlayerBalance = async (web3Client: Client, gameAddress: string, playerAddress: string): Promise<number> => {
    const readTxData = await web3Client.smartContracts().readSmartContract({
        fee: 0,
        maxGas: 200000,
        simulatedGasPrice: 0,
        targetAddress: gameAddress,
        targetFunction: "getPlayerBalance",
        parameter: playerAddress,
        callerAddress: playerAddress
    } as IReadData);
    return parseInt(readTxData[0].output_events[0].data, 10);
}

export const getPlayerTokens = async (web3Client: Client, gameAddress: string, playerAddress: string): Promise<number> => {
  const readTxData = await web3Client.smartContracts().readSmartContract({
      fee: 0,
      maxGas: 200000,
      simulatedGasPrice: 0,
      targetAddress: gameAddress,
      targetFunction: "getPlayerTokens",
      parameter: playerAddress,
      callerAddress: playerAddress
  } as IReadData);
  return parseInt(readTxData[0].output_events[0].data, 10);
}

export const disconnectPlayer = async (web3Client: Client, gameAddress: string, playerAddress: string): Promise<string> => {
  const callTxId = await web3Client.smartContracts().callSmartContract({
    fee: 0,
    gasPrice: 0,
    maxGas: 200000,
    parallelCoins: 0,
    sequentialCoins: 0,
    targetAddress: gameAddress,
    functionName: "removePlayer",
    parameter: playerAddress,
  } as ICallData);
  const callScOperationId = callTxId[0];
  //console.log("Disconnect player opId ", callScOperationId);

  // await final state
  await web3Client.smartContracts().awaitRequiredOperationStatus(callScOperationId, EOperationStatus.FINAL);

  return callScOperationId;
}

export const getCollectiblesState = async (web3Client: Client, gameAddress: string, playerAddress: string): Promise<Array<ITokenOnchainEntity>> => {
  const readTxData = await web3Client.smartContracts().readSmartContract({
      fee: 0,
      maxGas: 200000,
      simulatedGasPrice: 0,
      targetAddress: gameAddress,
      targetFunction: "getCollectiblesState",
      parameter: "",
      callerAddress: playerAddress
  } as IReadData);

  return readTxData[0].output_events[0].data.split("@").map(event => {
    return JSON.parse(event) as ITokenOnchainEntity
  });
}

export const getPlayerLasersUuids = async (web3Client: Client, gameAddress: string, playerAddress: string): Promise<Array<string>> => {
  const readTxData = await web3Client.smartContracts().readSmartContract({
      fee: 0,
      maxGas: 200000,
      simulatedGasPrice: 0,
      targetAddress: gameAddress,
      targetFunction: "getPlayerLasersUuids",
      parameter: playerAddress,
      callerAddress: playerAddress
  } as IReadData);

  return readTxData[0].output_events[0].data.split(",");
}

const stringifyAndFormatNumbers = (input: any): string => {
  for (let key of Object.keys(input)) {
    if (typeof input[key] === "number") input[key] = input[key].toFixed(2);
  }
  return JSON.stringify(input);
}

export const setPlayerPositionOnchain = async (web3Client: Client, gameAddress: string, threadAddressesMap: Map<string, IAccount>, playerUpdate: IPlayerOnchainEntity): Promise<string|undefined> => {
    //console.log("UPDATE ", stringifyAndFormatNumbers(playerUpdate));
  
    // evaluate thread from which to send
    let nodeStatusInfo: INodeStatus|null|undefined = null;
    try {
      nodeStatusInfo = await web3Client.publicApi().getNodeStatus();
    } catch(ex) {
      console.log("Error getting node status");
      throw ex;
    }

    const threadForNextOp = ((nodeStatusInfo as INodeStatus).next_slot.thread + 2) % (nodeStatusInfo as INodeStatus).config.thread_count;
    //console.log("Next thread to execute op with = ", threadForNextOp);
    const executor = threadAddressesMap.get(threadForNextOp.toString());
    let opIds;
    try {
      opIds = await web3Client?.smartContracts().callSmartContract({
        /// storage fee for taking place in books
        fee: 0,
        /// The maximum amount of gas that the execution of the contract is allowed to cost.
        maxGas: 200000,
        /// The price per unit of gas that the caller is willing to pay for the execution.
        gasPrice: 0,
        /// Extra coins that are spent from the caller's parallel balance and transferred to the target
        parallelCoins: 0,
        /// Extra coins that are spent from the caller's sequential balance and transferred to the target
        sequentialCoins: 0,
        /// Target smart contract address
        targetAddress: gameAddress,
        /// Target function name. No function is called if empty.
        functionName: "setPlayerAbsCoors",
        /// Parameter to pass to the target function
        parameter: stringifyAndFormatNumbers(playerUpdate)
      } as ICallData, executor as IAccount);
    } catch (ex) {
      console.error(`Error setting object coords to sc`, ex);
      throw ex;
    }
    //console.log("Updated Blockchain Coords OP_ID", opIds);
    return opIds ? opIds[0] : undefined;
  }

  export const setPlayerLasersOnchain = async (web3Client: Client, gameAddress: string, threadAddressesMap: Map<string, IAccount>, playerLasersUpdate: IPlayerLasersRequest): Promise<string|undefined> => {
     // evaluate thread from which to send
    let nodeStatusInfo: INodeStatus|null|undefined = null;
    try {
      nodeStatusInfo = await web3Client.publicApi().getNodeStatus();
    } catch(ex) {
      console.log("Error getting node status");
      throw ex;
    }

    const threadForNextOp = ((nodeStatusInfo as INodeStatus).next_slot.thread + 2) % (nodeStatusInfo as INodeStatus).config.thread_count;
    //console.log("Next thread to execute op with = ", threadForNextOp);
    const executor = threadAddressesMap.get(threadForNextOp.toString());
    let opIds;
    try {
      opIds = await web3Client?.smartContracts().callSmartContract({
        /// storage fee for taking place in books
        fee: 0,
        /// The maximum amount of gas that the execution of the contract is allowed to cost.
        maxGas: 200000,
        /// The price per unit of gas that the caller is willing to pay for the execution.
        gasPrice: 0,
        /// Extra coins that are spent from the caller's parallel balance and transferred to the target
        parallelCoins: 0,
        /// Extra coins that are spent from the caller's sequential balance and transferred to the target
        sequentialCoins: 0,
        /// Target smart contract address
        targetAddress: gameAddress,
        /// Target function name. No function is called if empty.
        functionName: "setLaserPos",
        /// Parameter to pass to the target function
        parameter: stringifyAndFormatNumbers(playerLasersUpdate)
      } as ICallData, executor as IAccount);
    } catch (ex) {
      console.error(`Error setting object coords to sc`, ex);
      throw ex;
    }
    //console.log("Updated Blockchain Coords OP_ID", opIds);
    return opIds ? opIds[0] : undefined;
  }