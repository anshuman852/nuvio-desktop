#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod addon;
mod mpv;

use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub mpv: Mutex<mpv::MpvManager>,
}

#[tauri::command]
async fn fetch_manifest(url: String) -> Result<serde_json::Value, String> {
    addon::fetch_manifest(&url).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_catalog(
    addon_url: String,
    type_: String,
    id: String,
    extra: Option<String>,
) -> Result<serde_json::Value, String> {
    addon::fetch_catalog(&addon_url, &type_, &id, extra.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_meta(
    addon_url: String,
    type_: String,
    id: String,
) -> Result<serde_json::Value, String> {
    addon::fetch_meta(&addon_url, &type_, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_streams(
    addon_url: String,
    type_: String,
    id: String,
) -> Result<serde_json::Value, String> {
    addon::fetch_streams(&addon_url, &type_, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn launch_mpv(
    url: String,
    title: Option<String>,
    state: State<AppState>,
) -> Result<(), String> {
    state
        .mpv
        .lock()
        .unwrap()
        .launch(&url, title.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn mpv_command(
    cmd: String,
    args: Vec<serde_json::Value>,
    state: State<AppState>,
) -> Result<(), String> {
    state
        .mpv
        .lock()
        .unwrap()
        .send_command(&cmd, &args)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn mpv_stop(state: State<AppState>) {
    state.mpv.lock().unwrap().stop();
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            mpv: Mutex::new(mpv::MpvManager::new()),
        })
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            fetch_manifest,
            fetch_catalog,
            fetch_meta,
            fetch_streams,
            launch_mpv,
            mpv_command,
            mpv_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running nuvio-desktop");
}
