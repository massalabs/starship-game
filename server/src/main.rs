use std::collections::HashMap;
use std::net::{Ipv4Addr, SocketAddrV4};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use futures_util::stream::SplitSink;
use shared::{ClientMessage, RemoteState, ServerMessage};
use tokio::sync::{mpsc, RwLock};
use warp::ws::{Message, WebSocket};
use warp::Filter;

static NEXT_USER_ID: AtomicUsize = AtomicUsize::new(1);

type OutBoundChannel = mpsc::UnboundedSender<Result<Message, warp::Error>>;
type Users = Arc<RwLock<HashMap<usize, OutBoundChannel>>>;
type States = Arc<RwLock<HashMap<usize, RemoteState>>>;

async fn user_connected(
    ws: WebSocket,
    users: Users,
    states: States,
) {
    use futures_util::StreamExt;

    let (ws_sender, mut ws_receiver) = ws.split();

    let send_channel = create_send_channel(ws_sender);

    let my_id = send_welcome(&send_channel).await;

    users.write().await.insert(my_id, send_channel);

    log::debug!("new user connected. Id = {}", my_id);

    // block and receive messages from the user about his position in the game
    while let Some(result) = ws_receiver.next().await {
        let msg = match result {
            Ok(msg) => msg,
            Err(e) => {
                log::warn!("websocket receive error: {}", e);
                break;
            }
        };
        log::debug!("user sent message {:?}", msg);

        // parse the received message from the connected user and update server state
        if let Some(msg) = parse_message(msg) {
            user_message(my_id, msg, &states).await;
        }
    }

    // remove user sender channel from hashmap
    log::debug!("user disconnected: {}", my_id);
    users.write().await.remove(&my_id);
    states.write().await.remove(&my_id);

    // broadcast a msg that the user has left
    broadcast(ServerMessage::GoodBye(my_id), &users).await;
}

fn parse_message(msg: Message) -> Option<ClientMessage> {
    if msg.is_binary() {
        let msg = msg.into_bytes();
        serde_json::from_slice::<ClientMessage>(msg.as_slice()).ok()
    } else {
        None
    }
}

async fn user_message(
    my_id: usize,
    msg: ClientMessage,
    states: &States,
) {
    match msg {
        ClientMessage::State(state) => {
            let msg = RemoteState {
                id: my_id,
                position: state.pos,
                rotation: state.r,
            };
            states.write().await.insert(msg.id, msg);
        }
    }
}

fn create_send_channel(ws_sender: SplitSink<WebSocket, Message>) -> OutBoundChannel {
    use futures_util::FutureExt;
    use futures_util::StreamExt;
    use tokio_stream::wrappers::UnboundedReceiverStream;

    let (sender, receiver) = mpsc::unbounded_channel();
    let rx = UnboundedReceiverStream::new(receiver);

    tokio::task::spawn(rx.forward(ws_sender).map(|result| {
        if let Err(e) = result {
            log::error!("websocket send error: {}", e);
        }
    }));

    sender
}

async fn broadcast(
    msg: ServerMessage,
    users: &Users,
) {
    let users = users.read().await;
    for (_, tx) in users.iter() {
        send_msg(tx, &msg).await;
    }
}

async fn send_welcome(out: &OutBoundChannel) -> usize {
    let id = NEXT_USER_ID.fetch_add(1, Ordering::Relaxed);
    let states = ServerMessage::Welcome(id);
    send_msg(out, &states).await;
    id
}

async fn send_msg(
    tx: &OutBoundChannel,
    msg: &ServerMessage,
) {
    let buffer = serde_json::to_vec(msg).unwrap();
    let msg = Message::binary(buffer);
    tx.send(Ok(msg)).unwrap();
}

async fn update_loop(
    users: Users,
    states: States,
) {
    loop {
        let states: Vec<RemoteState> = states.read().await.values().cloned().collect();

        if !states.is_empty() {
            for (&uid, tx) in users.read().await.iter() {
                let states = states
                    .iter()
                    .filter_map(|state| {
                        if state.id != uid {
                            Some(state.clone())
                        } else {
                            None
                        }
                    })
                    .collect();

                let msg = ServerMessage::Update(states);
                send_msg(tx, &msg).await;
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }
}

#[tokio::main]
async fn main() {
    pretty_env_logger::init();

    let users = Users::default();
    let states = States::default();

    let arc_users = users.clone();
    let arc_states = states.clone();

    let arc_users2 = users.clone();
    let arc_states2 = states.clone();

    let users_resource = warp::any().map(move || arc_users.clone());
    let states_resource = warp::any().map(move || arc_states.clone());

    tokio::spawn(async move {
        update_loop(arc_users2, arc_states2).await;
    });

    let game = warp::path!("game")
        .and(warp::ws())
        .and(users_resource)
        .and(states_resource)
        .map(|ws: warp::ws::Ws, users, states| {
            ws.on_upgrade(move |socket| user_connected(socket, users, states))
        });

    let status = warp::path!("status").map(|| warp::reply::html("hello"));
    let routes = game.or(status);

    let socket = SocketAddrV4::new(Ipv4Addr::new(0, 0, 0, 0), 3100);
    log::info!("Game server started!");
    warp::serve(routes).bind(socket).await;

    //warp::serve(routes).run(([0, 0, 0, 0], 3100)).await;
}
