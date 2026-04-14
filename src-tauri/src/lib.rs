#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod addon;
mod mpv;
mod proxy;

use std::sync::Mutex;
use tauri::{State, Emitter, Manager};

pub struct AppState {
    pub mpv: Mutex<mpv::MpvManager>,
}

#[tauri::command]
async fn fetch_manifest(url: String) -> Result<serde_json::Value, String> {
    addon::fetch_manifest(&url).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_catalog(base_url: String, type_: String, id: String, extra: Option<String>) -> Result<serde_json::Value, String> {
    addon::fetch_catalog(&base_url, &type_, &id, extra.as_deref()).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_meta(base_url: String, type_: String, id: String) -> Result<serde_json::Value, String> {
    addon::fetch_meta(&base_url, &type_, &id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_streams(base_url: String, type_: String, id: String) -> Result<serde_json::Value, String> {
    addon::fetch_streams(&base_url, &type_, &id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn launch_mpv(state: State<'_, AppState>, url: String, title: Option<String>, referrer: Option<String>) -> Result<(), String> {
    let mut mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    mpv.launch_with_referrer(&url, title.as_deref(), referrer.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
async fn launch_custom_player(player_path: String, url: String, title: Option<String>) -> Result<(), String> {
    let mut cmd = std::process::Command::new(&player_path);
    cmd.arg(&url);
    if let Some(t) = &title {
        if player_path.to_lowercase().contains("vlc") { cmd.args(["--meta-title", t]); }
        else if player_path.to_lowercase().contains("mpc") { cmd.args(["/title", t]); }
    }
    cmd.spawn().map_err(|e| format!("Impossibile avviare {}: {}", player_path, e))?;
    Ok(())
}

#[tauri::command]
async fn launch_mpv_stream(
    state: State<'_, AppState>,
    url: String,
    title: Option<String>,
    referrer: Option<String>,
) -> Result<(), String> {
    let mut mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    mpv.launch_with_referrer(&url, title.as_deref(), referrer.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
async fn mpv_command(state: State<'_, AppState>, cmd: String, args: Vec<serde_json::Value>) -> Result<serde_json::Value, String> {
    let mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    mpv.send_command(&cmd, &args).map_err(|e| e.to_string())
}

#[tauri::command]
async fn mpv_stop(state: State<'_, AppState>) -> Result<(), String> {
    let mut mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    mpv.stop();
    Ok(())
}

#[tauri::command]
async fn mpv_get_position(state: State<'_, AppState>) -> Result<f64, String> {
    let mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    Ok(mpv.get_position())
}

#[tauri::command]
async fn mpv_get_duration(state: State<'_, AppState>) -> Result<f64, String> {
    let mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    Ok(mpv.get_duration())
}

#[tauri::command]
async fn open_url(url: String) -> Result<(), String> {
    std::process::Command::new("cmd").args(["/C", "start", "", &url]).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn stream_magnet(state: State<'_, AppState>, magnet: String, title: Option<String>) -> Result<String, String> {
    let mut mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    mpv.launch_with_referrer(&magnet, title.as_deref(), None).map_err(|e| e.to_string())?;
    Ok("mpv".to_string())
}

#[tauri::command]
async fn resolve_stream_url(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(15))
        .timeout(std::time::Duration::from_secs(15))
        .build().map_err(|e| e.to_string())?;
    let ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    let resp = client.head(&url).header("User-Agent", ua).send().await;
    match resp {
        Ok(r) if r.status().as_u16() < 400 => Ok(r.url().to_string()),
        _ => {
            let r2 = client.get(&url).header("User-Agent", ua).header("Range", "bytes=0-0").send().await.map_err(|e| e.to_string())?;
            Ok(r2.url().to_string())
        }
    }
}

// Nuova funzione proxy per stream HTTP
#[tauri::command]
async fn proxy_stream(url: String, referer: Option<String>) -> Result<Vec<u8>, String> {
    use reqwest::header::{HeaderMap, HeaderValue, REFERER, USER_AGENT};
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"));
    
    if let Some(r) = referer {
        headers.insert(REFERER, HeaderValue::from_str(&r).map_err(|e| e.to_string())?);
    }
    
    let response = client
        .get(&url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    Ok(bytes.to_vec())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let proxy = proxy::StreamProxy::new();
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(AppState { mpv: Mutex::new(mpv::MpvManager::new()) })
        .setup(|_app| {
            tauri::async_runtime::spawn(async move {
                if let Err(e) = proxy.start().await {
                    eprintln!("[proxy] Errore avvio: {}", e);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fetch_manifest, fetch_catalog, fetch_meta, fetch_streams,
            launch_mpv, launch_custom_player, launch_mpv_stream,
            mpv_command, mpv_stop, mpv_get_position, mpv_get_duration,
            open_url, stream_magnet, resolve_stream_url,
            proxy_stream,  // <-- AGGIUNTA
        ])
        .run(tauri::generate_context!())
        .expect("error while running nuvio-desktop");
}