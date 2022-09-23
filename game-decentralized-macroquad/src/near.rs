use near_jsonrpc_client::{
    errors::JsonRpcError,
    methods::{self, status::RpcStatusError},
    JsonRpcClient,
};
use near_primitives::views::StatusResponse;

pub struct NearClient {
    pub client: JsonRpcClient,
}

impl NearClient {
    pub async fn new(url: &str) -> NearClient {
        let client = JsonRpcClient::connect(url);
        Self { client: client }
    }

    fn testnet() -> Self {
        let testnet_client = JsonRpcClient::connect("https://rpc.testnet.near.org");
        Self {
            client: testnet_client,
        }
    }

    fn mainnet() -> Self {
        let testnet_client = JsonRpcClient::connect("https://rpc.mainnet.near.org");
        Self {
            client: testnet_client,
        }
    }

    pub async fn rpc_status_request(&self) -> Result<StatusResponse, JsonRpcError<RpcStatusError>> {
        let status_request = methods::status::RpcStatusRequest;
        let server_status = self.client.call(status_request).await?;
        Ok(server_status)
    }
}
