import { deploySmartContract } from "@massalabs/massa-sc-utils";
import { WalletClient,
    IEvent,
    ClientFactory,
    IAccount, 
    EventPoller,
    IEventRegexFilter,
    ON_MASSA_EVENT_DATA,
    ON_MASSA_EVENT_ERROR,
    IProvider,
    ProviderType} from "@massalabs/massa-web3";

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

        const scAddress = "A12ZufE7mGz6RLt3PCN9dsbLE2bK2kvj8mnDE9ibdCycWPcg3C4z";

        console.log(`Filtering for sc events....`);
        const eventsFilter = {
            start: null,
            end: null,
            original_operation_id: null, //"tc4JeojripA3KAp8ZnoDAo3KndxQgebSrPxK65aeFyvLeAstA",
            original_caller_address: null, //"A127bjLK4kLMq3xE3BqxahRfCHGwQuzaWk52dXKFAjK4ZDTGEWbi",
            emitter_address: scAddress,
            eventsNameRegex: null, //"PLAYER_ADDED",
            is_final: true
        } as IEventRegexFilter;
                
        const eventPoller = EventPoller.startEventsPolling(
            eventsFilter,
            1000,
            web3Client
        );
        eventPoller.on(ON_MASSA_EVENT_DATA, (events: Array<IEvent>) => {
            //events.forEach((e) => console.log("DATA", e.data.substring(0, 600))); 
            
             events.filter((e) => {
                return e.data.includes("PLAYER_ADDED=");
            })
            .forEach((e) => console.log("DATA", e.data));
                          
        });
        eventPoller.on(ON_MASSA_EVENT_ERROR, (ex) => console.log("ERROR ", ex));
    } catch (ex) {
        const msg = console.log(`Error = ${(ex as Error).message}`);
        console.error(msg);
    }
})();