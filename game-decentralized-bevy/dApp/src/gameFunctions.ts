import { Client, EOperationStatus, EventPoller, IAccount, ICallData, IEventFilter, INodeStatus, IReadData } from "@massalabs/massa-web3";
import { IPlayerOnchainEntity } from "./PlayerEntity";
import { ITokenOnchainEntity } from "./TokenEntity";

export const registerPlayer = async (web3Client: Client, gameAddress: string, playerName: string, playerAddress: string): Promise<IPlayerOnchainEntity> => {
    const callTxIds = await web3Client.smartContracts().callSmartContract({
      fee: 0,
      gasPrice: 0,
      maxGas: 200000,
      parallelCoins: 0,
      sequentialCoins: 0,
      targetAddress: gameAddress,
      functionName: "registerPlayer",
      parameter: `{"name":"${playerName}","address":"${playerAddress}"}`,
    } as ICallData);
    const callScOperationId = callTxIds[0];
  
    console.log("Registered player opId ", callScOperationId);

    // await final state
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

    console.log("Player position", playerEntity);

    return playerEntity as IPlayerOnchainEntity;
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
    console.log("Is Player Registered ? ", readTxData);
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

const formatNumbersToDecimalPrecision = (input: any): string => {
  for (let key of Object.keys(input)) {
    if (typeof input[key] === "number") input[key] = input[key].toFixed(2);
  }
  return JSON.stringify(input);
}

export const setPlayerPositionOnchain = async (web3Client: Client, gameAddress: string, threadAddressesMap: Map<string, IAccount>, playerUpdate: IPlayerOnchainEntity): Promise<string|undefined> => {
    //console.log("UPDATE ", formatNumbersToDecimalPrecision(playerUpdate));
  
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
        functionName: "setAbsCoors",
        /// Parameter to pass to the target function
        parameter: formatNumbersToDecimalPrecision(playerUpdate)
      } as ICallData, executor as IAccount);
    } catch (ex) {
      console.error(`Error setting object coords to sc`, ex);
      throw ex;
    }
    //console.log("Updated Blockchain Coords OP_ID", opIds);
    return opIds ? opIds[0] : undefined;
  }