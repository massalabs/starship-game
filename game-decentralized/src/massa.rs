use massa_models::address::Address;
use massa_models::amount::Amount;
use massa_models::api::{EventFilter, OperationInput, ReadOnlyCall};
use massa_models::error::ModelsError;
use massa_models::execution::ExecuteReadOnlyResponse;
use massa_models::operation::{
    Operation, OperationId, OperationSerializer, OperationType, WrappedOperation,
};
use massa_models::output_event::{EventExecutionContext, SCOutputEvent};
use massa_models::slot::Slot;
use massa_models::wrapped::WrappedContent;
use massa_sdk::Client;
use massa_signature::KeyPair;
use massa_time::MassaTime;
use massa_wallet::WalletError;
use std::cmp::Ordering;
use std::collections::HashMap;
use std::sync::Arc;
use std::{
    net::{IpAddr, Ipv4Addr},
    sync::mpsc::Sender,
};

use crate::entities::PlayerEntityOnchain;

pub async fn get_thread_to_execute_from(client: &Client) -> anyhow::Result<u8> {
    let cfg = match client.public.get_status().await {
        Ok(node_status) => node_status,
        Err(e) => return Err(anyhow::anyhow!(e.to_string())),
    };

    let thread_to_exec_from = (cfg.next_slot.thread + 2) % cfg.config.thread_count;
    Ok(thread_to_exec_from)
}

pub async fn generate_thread_addresses_hashmap(
    client: &Client
) -> anyhow::Result<HashMap<u8, KeyPair>> {
    let cfg = match client.public.get_status().await {
        Ok(node_status) => node_status,
        Err(e) => return Err(anyhow::anyhow!(e.to_string())),
    };

    let mut thread_addresses_map: HashMap<u8, KeyPair> = HashMap::new();
    while thread_addresses_map.keys().len() != cfg.config.thread_count as usize {
        let key_pair = KeyPair::generate();
        let address = Address::from_public_key(&key_pair.get_public_key());
        let thread_number = address.get_thread(cfg.config.thread_count);
        thread_addresses_map.insert(thread_number, key_pair);
    }
    Ok(thread_addresses_map)
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

    pub async fn read_is_player_registered(
        &self,
        sc_address: &Address,
        player_address: &Address,
    ) -> anyhow::Result<ExecuteReadOnlyResponse> {
        let res = self
            .client
            .public
            .execute_read_only_call(ReadOnlyCall {
                max_gas: 70000000,
                simulated_gas_price: Amount::zero(),
                target_address: *sc_address,
                target_function: "isPlayerRegistered".to_string(),
                parameter: player_address.to_string(),
                caller_address: None,
            })
            .await;
        match res {
            Ok(res) => Ok(res),
            Err(e) => return Err(anyhow::anyhow!(e.to_string())),
        }
    }

    pub async fn fetch_events_once(
        &self,
        event_filter: EventFilter,
    ) -> anyhow::Result<Vec<SCOutputEvent>> {
        let events_res = self
            .client
            .public
            .get_filtered_sc_output_event(event_filter)
            .await;
        match events_res {
            Ok(res) => Ok(res),
            Err(e) => return Err(anyhow::anyhow!(e.to_string())),
        }
    }

    pub async fn call_register_player(
        &self,
        sc_address: &Address,
        player_address: &Address,
        sender_keypair: &KeyPair,
    ) -> anyhow::Result<Vec<OperationId>> {
        send_operation(
            &self.client,
            sender_keypair,
            OperationType::CallSC {
                target_addr: *sc_address,
                target_func: "registerPlayer".to_owned(),
                param: player_address.to_string(),
                max_gas: 70000000,
                sequential_coins: Amount::zero(),
                parallel_coins: Amount::zero(),
                gas_price: Amount::zero(),
            },
            Amount::zero(),
        )
        .await
    }

    pub async fn call_set_player_pos(
        &self,
        sc_address: &Address,
        player_entity: &PlayerEntityOnchain,
        sender_keypair: &KeyPair,
    ) -> anyhow::Result<Vec<OperationId>> {
        send_operation(
            &self.client,
            sender_keypair,
            OperationType::CallSC {
                target_addr: *sc_address,
                target_func: "setAbsCoors".to_owned(),
                param: serde_json::to_string(player_entity).unwrap(),
                max_gas: 70000000,
                sequential_coins: Amount::zero(),
                parallel_coins: Amount::zero(),
                gas_price: Amount::zero(),
            },
            Amount::zero(),
        )
        .await
    }
}

async fn send_operation(
    client: &Client,
    sender_keypair: &KeyPair,
    op: OperationType,
    fee: Amount,
) -> anyhow::Result<Vec<OperationId>> {
    let cfg = match client.public.get_status().await {
        Ok(node_status) => node_status,
        Err(e) => return Err(anyhow::anyhow!(e.to_string())),
    }
    .config;

    let address = Address::from_public_key(&sender_keypair.get_public_key());

    let slot = get_current_latest_block_slot(cfg.thread_count, cfg.t0, cfg.genesis_timestamp, 0)? // clock compensation is zero
        .unwrap_or_else(|| Slot::new(0, 0));
    let mut expire_period = slot.period + cfg.operation_validity_periods;

    let thread_number = address.get_thread(cfg.thread_count);

    if slot.thread >= thread_number {
        expire_period += 1;
    };

    let op = create_operation(
        Operation {
            fee,
            expire_period,
            op,
        },
        sender_keypair,
    )?;

    match client
        .public
        .send_operations(vec![OperationInput {
            creator_public_key: op.creator_public_key,
            serialized_content: op.serialized_data,
            signature: op.signature,
        }])
        .await
    {
        Ok(operation_ids) => Ok(operation_ids),
        Err(e) => return Err(anyhow::anyhow!(e.to_string())),
    }
}

fn create_operation(
    content: Operation,
    sender_keypair: &KeyPair,
) -> Result<WrappedOperation, WalletError> {
    Ok(Operation::new_wrapped(content, OperationSerializer::new(), sender_keypair).unwrap())
}

fn get_current_latest_block_slot(
    thread_count: u8,
    t0: MassaTime,
    genesis_timestamp: MassaTime,
    clock_compensation: i64,
) -> Result<Option<Slot>, ModelsError> {
    get_latest_block_slot_at_timestamp(
        thread_count,
        t0,
        genesis_timestamp,
        MassaTime::now(clock_compensation)?,
    )
}

fn get_latest_block_slot_at_timestamp(
    thread_count: u8,
    t0: MassaTime,
    genesis_timestamp: MassaTime,
    timestamp: MassaTime,
) -> Result<Option<Slot>, ModelsError> {
    if let Ok(time_since_genesis) = timestamp.checked_sub(genesis_timestamp) {
        let thread: u8 = time_since_genesis
            .checked_rem_time(t0)?
            .checked_div_time(t0.checked_div_u64(thread_count as u64)?)?
            as u8;
        return Ok(Some(Slot::new(
            time_since_genesis.checked_div_time(t0)?,
            thread,
        )));
    }
    Ok(None)
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
