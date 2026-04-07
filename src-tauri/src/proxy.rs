//! HTTP Stream Proxy — serve stream remoti su localhost
//! Bypassa CORS e mixed-content di WebView2
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use axum::{
    Router,
    extract::{Query, State},
    response::{IntoResponse, Response},
    routing::get,
    http::{HeaderMap, HeaderName, HeaderValue, StatusCode},
};
use reqwest::Client;
use std::collections::HashMap;

#[derive(Clone)]
pub struct ProxyState {
    pub client: Client,
}

pub async fn proxy_stream(
    Query(params): Query<HashMap<String, String>>,
    axum::extract::State(state): axum::extract::State<ProxyState>,
    headers: HeaderMap,
) -> Response {
    let url = match params.get("url") {
        Some(u) => u.clone(),
        None => return (StatusCode::BAD_REQUEST, "Missing url param").into_response(),
    };

    // Forwarda Range header se presente
    let mut req = state.client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .header("Accept", "*/*")
        .header("Accept-Encoding", "identity");

    if let Some(range) = headers.get("range") {
        req = req.header("Range", range);
    }

    let resp = match req.send().await {
        Ok(r) => r,
        Err(e) => return (StatusCode::BAD_GATEWAY, e.to_string()).into_response(),
    };

    let status = resp.status();
    let resp_headers = resp.headers().clone();

    // Passa headers importanti al client
    let mut out_headers = HeaderMap::new();
    for key in &["content-type", "content-length", "content-range", "accept-ranges"] {
        if let Some(val) = resp_headers.get(*key) {
            if let Ok(k) = HeaderName::from_bytes(key.as_bytes()) {
                out_headers.insert(k, val.clone());
            }
        }
    }
    // CORS libero per WebView2
    out_headers.insert("access-control-allow-origin", HeaderValue::from_static("*"));

    let body = match resp.bytes().await {
        Ok(b) => b,
        Err(e) => return (StatusCode::BAD_GATEWAY, e.to_string()).into_response(),
    };

    (StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::OK), out_headers, body).into_response()
}

pub async fn start_proxy(port: u16) -> Result<(), String> {
    let client = Client::builder()
        .redirect(reqwest::redirect::Policy::limited(15))
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let state = ProxyState { client };

    let app = Router::new()
        .route("/proxy", get(proxy_stream))
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| e.to_string())?;

    axum::serve(listener, app)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
