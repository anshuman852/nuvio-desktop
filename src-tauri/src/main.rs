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
async fn launch_mpv(
    state: State<'_, AppState>,
    url: String,
    title: Option<String>,
) -> Result<(), String> {
    let mut mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    mpv.launch(&url, title.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
async fn launch_custom_player(
    player_path: String,
    url: String,
    title: Option<String>,
) -> Result<(), String> {
    use std::process::Command;
    let mut cmd = Command::new(&player_path);
    cmd.arg(&url);
    if let Some(t) = &title {
        // Prova argomenti comuni per vari player
        if player_path.to_lowercase().contains("vlc") {
            cmd.arg("--meta-title").arg(t);
        } else if player_path.to_lowercase().contains("mpc") {
            cmd.arg("/title").arg(t);
        }
    }
    cmd.spawn().map_err(|e| format!("Impossibile avviare {}: {}", player_path, e))?;
    Ok(())
}

#[tauri::command]
async fn mpv_command(
    state: State<'_, AppState>,
    cmd: String,
    args: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    mpv.send_command(&cmd, &args).map_err(|e| e.to_string())
}

#[tauri::command]
async fn mpv_stop(state: State<'_, AppState>) -> Result<(), String> {
    let mut mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    mpv.stop().map_err(|e| e.to_string())
}

// Apre URL nel browser di sistema
#[tauri::command]
async fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(AppState {
            mpv: Mutex::new(mpv::MpvManager::new()),
        })
        .invoke_handler(tauri::generate_handler![
            fetch_manifest,
            fetch_catalog,
            fetch_meta,
            fetch_streams,
            launch_mpv,
            launch_custom_player,
            mpv_command,
            mpv_stop,
            open_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running nuvio-desktop");
}

fn main() {
    run();
}
