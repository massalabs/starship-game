import { Client, EOperationStatus, EventPoller, ICallData, IEventFilter, IReadData } from "@massalabs/massa-web3";
import { IPlayerOnchainEntity } from "./PlayerEntity";

export const registerPlayer = async (web3Client: Client, gameAddress: string, playerAddress: string): Promise<IPlayerOnchainEntity> => {
    const callTxIds = await web3Client.smartContracts().callSmartContract({
      fee: 0,
      gasPrice: 0,
      maxGas: 200000,
      parallelCoins: 0,
      sequentialCoins: 0,
      targetAddress: gameAddress,
      functionName: "registerPlayer",
      parameter: playerAddress,
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
      console.log("EVENT PARTS ", eventName, eventData)
      if (eventName === "PLAYER_ADDED") {
        playerEntity = JSON.parse(eventData as string);
      } else {
        throw new Error("Missing expected event PLAYER ADDED");
      }
    } catch (ex) {
      console.error("Error parsing data for player entity", events[0].data);
      throw ex;
    }

    console.log("Register player", playerEntity);

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
    console.log("Player Registered ? ", readTxData);
    const isRegistered = readTxData[0].output_events[0].data.toLowerCase() === "true" ? true : false;

    return isRegistered;
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
    return parseInt(readTxData[0].output_events[0].data, 100);
}