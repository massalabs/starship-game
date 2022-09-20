use massa_models::address::Address;
use massa_models::api::EventFilter;
use massa_models::output_event::{EventExecutionContext, SCOutputEvent};
use massa_models::slot::Slot;
use massa_sdk::Client;
use massa_signature::KeyPair;
use std::cmp::Ordering;
use std::collections::HashMap;
use std::sync::Arc;
use std::{
    net::{IpAddr, Ipv4Addr},
    sync::mpsc::Sender,
};

pub const THREAD_COUNT: u8 = 32;

pub fn generate_thread_addresses_hashmap() -> HashMap<u8, KeyPair> {
    let mut thread_addresses_map: HashMap<u8, KeyPair> = HashMap::new();
    while thread_addresses_map.keys().len() != THREAD_COUNT as usize {
        let keypair = KeyPair::generate();
        let address = Address::from_public_key(&keypair.get_public_key());
        let thread_number = address.get_thread(THREAD_COUNT);
        let a = address.to_string();
        thread_addresses_map.insert(thread_number, keypair);
        //let b = Address::from_str(&a).unwrap();
    }
    thread_addresses_map
}

pub fn sort_by_thread_and_period(
    a: &Slot,
    b: &Slot,
) -> Ordering {
    let period_order = a.period.cmp(&b.period);
    if period_order == Ordering::Equal {
        let thread_order = a.thread.cmp(&b.thread);
        return thread_order;
    }

    period_order
}

#[derive(Debug, Clone)]
pub enum PollResult {
    Events(Vec<SCOutputEvent>),
    Error(String),
}

pub struct ExtendedEventFilter {
    pub event_regex: Option<Vec<String>>,
    pub event_filter: EventFilter,
}

pub struct MassaClient {
    pub client: Client,
}

impl MassaClient {
    pub async fn new_default(
        ip: IpAddr,
        public_port: u16,
        private_port: u16,
    ) -> MassaClient {
        let massa_client = Client::new(ip, public_port, private_port).await;
        Self {
            client: massa_client,
        }
    }

    pub async fn new_testnet() -> MassaClient {
        let testnet_ip = IpAddr::V4(Ipv4Addr::new(51, 75, 131, 129));
        MassaClient::new_default(testnet_ip, 33035, 33034).await
    }

    pub async fn register_player(
        &self,
        player_address: &str,
    ) {
    }
}

pub async fn poll_contract_events(
    massa_client: Arc<MassaClient>,
    event_extended_filter: ExtendedEventFilter,
    tx: Sender<PollResult>,
) {
    tokio::spawn(async move {
        let mut last_slot: Option<Slot> = None;
        loop {
            let event_filter = event_extended_filter.event_filter.clone();
            let events_res = massa_client
                .client
                .public
                .get_filtered_sc_output_event(event_filter)
                .await;
            match events_res {
                Ok(events) => {
                    let mut filtered_events = events
                        .into_iter()
                        .filter(|event| {
                            let is_after_last_slot = last_slot
                                .as_ref()
                                .map(|last_slot| {
                                    let is_after_last_slot =
                                        sort_by_thread_and_period(&event.context.slot, last_slot)
                                            .eq(&Ordering::Greater);

                                    let meets_regex = event_extended_filter
                                        .event_regex
                                        .as_ref()
                                        .and_then(|regex| {
                                            Some(regex.iter().any(|item| event.data.contains(item)))
                                        })
                                        .unwrap_or_else(|| true);

                                    is_after_last_slot && meets_regex
                                })
                                .unwrap_or_else(|| true);
                            is_after_last_slot
                        })
                        .collect::<Vec<_>>();

                    if !filtered_events.is_empty() {
                        filtered_events.sort_unstable_by(|a, b| {
                            sort_by_thread_and_period(&a.context.slot, &b.context.slot)
                        });

                        last_slot = filtered_events.last().map(|s| &s.context.slot).cloned();

                        tx.send(PollResult::Events(filtered_events)).unwrap();
                    }
                }
                Err(e) => {
                    tx.send(PollResult::Error(e.to_string())).unwrap();
                }
            }
        }
    });
}
