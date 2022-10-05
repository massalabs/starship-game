import { Client, IAccount, INodeStatus, WalletClient } from "@massalabs/massa-web3";

export const generateThreadAddressesMap = async (web3Client: Client): Promise<Map<number, IAccount>> => {

    //  get the total number of threads
    let nodeStatusInfo: INodeStatus|null|undefined = null;
    try {
      nodeStatusInfo = await web3Client?.publicApi().getNodeStatus();
    } catch(ex) {
      console.log("Error getting node status");
      throw ex;
    }

    // generate a dynamic hashmap with len = thread_count
    const addressesMap: Map<number, IAccount> = new Map();
    while(true) {
        const randomAccount: IAccount = await WalletClient.walletGenerateNewAccount();
        addressesMap.set(randomAccount.createdInThread as number, randomAccount);
        if (addressesMap.size === nodeStatusInfo.config.thread_count) {
            break;
        }
    }
    return addressesMap;
  }