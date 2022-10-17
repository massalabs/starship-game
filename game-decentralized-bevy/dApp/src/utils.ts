import { Client, DefaultProviderUrls, IAccount, INodeStatus, IProvider, ProviderType, WalletClient } from "@massalabs/massa-web3";

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

export const wait = async (timeMilli: number): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearTimeout(timeout);
      return resolve();
    }, timeMilli);
  });
};
  
export async function withTimeoutRejection(promise: Promise<any>, timeout: number):  Promise<any> {
  const sleep = new Promise((resolve, reject) =>
    setTimeout(() => reject(new Error(`Timeout of ${timeout} has passed and promised did not resolve`)), timeout),
  );
  return Promise.race([promise, sleep]);
}

export const networks = {
  TESTNET: {
    value: 'TESTNET',
    label: 'Testnet',
  },
  LABNET: {
    value: 'LABNET',
    label: 'Labnet',
  },
  IMMONET: {
    value: 'IMMONET',
    label: 'Immonet',
  }
}

export const getProviderUrl = (seclectedNetworkName: string): Array<IProvider> => {
  let providers: Array<IProvider> = [];
  switch (seclectedNetworkName) {
    case networks.TESTNET.value: {
      providers = [
        {
            url: DefaultProviderUrls.TESTNET,
            type: ProviderType.PUBLIC
        } as IProvider,
        {
          url: DefaultProviderUrls.TESTNET,
            type: ProviderType.PRIVATE
        } as IProvider
      ];
      break;
    }
    case networks.IMMONET.value: {
      providers = [
        {
            url: "https://inno.massa.net/test13",
            type: ProviderType.PUBLIC
        } as IProvider,
        {
            url: "https://inno.massa.net/test13",
            type: ProviderType.PRIVATE
        } as IProvider
      ];
      break;
    }
    case networks.LABNET.value: {
      providers = [
        {
            url: DefaultProviderUrls.LABNET,
            type: ProviderType.PUBLIC
        } as IProvider,
        {
          url: DefaultProviderUrls.LABNET,
            type: ProviderType.PRIVATE
        } as IProvider
      ];
      break;
    }
    default: {
      throw new Error(`Unknown provider`);
    }
  }
  return providers;
}

export const networkValues = Array.from((new Map(Object.entries(networks))).values());

export class PollTimeout {
	constructor(timeoutMil: number, playerAddress: string, callback: (playerAddress: string) => void) {
		this.clear = this.clear.bind(this);

		const that = this;
		this.isCleared = false;
		this.isCalled = false;
		this.timeoutHook = setTimeout(() => {
			if (!that.isCleared) {
				this.isCalled = true;
				callback(playerAddress);
			}
		}, timeoutMil);
	}
	private isCleared: boolean;
	private isCalled: boolean;
	private timeoutHook: NodeJS.Timer;

	public clear(): void {
		if (!this.isCleared) {
			clearTimeout(this.timeoutHook);
			this.isCleared = true;
		}
	}
}
