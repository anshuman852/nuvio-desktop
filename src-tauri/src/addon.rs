use anyhow::Result;
use reqwest::Client;
use std::time::Duration;

fn client() -> Client {
    Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("NuvioDesktop/0.1")
        .build()
        .expect("failed to build reqwest client")
}

fn normalize(url: &str) -> String {
    url.trim_end_matches('/').to_string()
}

/// GET manifest — accetta l'URL completo (con o senza /manifest.json)
pub async fn fetch_manifest(manifest_url: &str) -> Result<serde_json::Value> {
    // Normalizza: rimuove slash finale, assicura che finisca con /manifest.json
    let base = normalize(manifest_url).replace("/manifest.json", "");
    let url = format!("{}/manifest.json", base);
    Ok(client().get(&url).send().await?.error_for_status()?.json().await?)
}

/// GET /catalog/{type}/{id}.json
pub async fn fetch_catalog(
    base_url: &str,
    type_: &str,
    id: &str,
    extra: Option<&str>,
) -> Result<serde_json::Value> {
    let extra_segment = extra
        .filter(|s| !s.is_empty())
        .map(|s| format!("/{}", s))
        .unwrap_or_default();
    let url = format!(
        "{}/catalog/{}/{}{}.json",
        normalize(base_url), type_, id, extra_segment
    );
    Ok(client().get(&url).send().await?.error_for_status()?.json().await?)
}

/// GET /meta/{type}/{id}.json
pub async fn fetch_meta(base_url: &str, type_: &str, id: &str) -> Result<serde_json::Value> {
    let url = format!("{}/meta/{}/{}.json", normalize(base_url), type_, id);
    Ok(client().get(&url).send().await?.error_for_status()?.json().await?)
}

/// GET /stream/{type}/{id}.json
pub async fn fetch_streams(base_url: &str, type_: &str, id: &str) -> Result<serde_json::Value> {
    let url = format!("{}/stream/{}/{}.json", normalize(base_url), type_, id);
    Ok(client().get(&url).send().await?.error_for_status()?.json().await?)
}
