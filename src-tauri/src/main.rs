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
async fn fetch_streams(addon_url: String, type_: String, id: String) -> Result<serde_json::Value, String> {
    addon::fetch_streams(&addon_url, &type_, &id).await.map_err(|e| e.to_string())
}

/// Lancia mpv in finestra separata
#[tauri::command]
async fn launch_mpv(state: State<'_, AppState>, url: String, title: Option<String>) -> Result<(), String> {
    let mut mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    mpv.launch(&url, title.as_deref()).map_err(|e| e.to_string())
}

/// Lancia mpv embedded nella finestra Tauri (Windows: HWND injection)
#[tauri::command]
async fn launch_mpv_embedded(
    state: State<'_, AppState>,
    window: tauri::Window,
    url: String,
    title: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // Ottieni HWND della finestra Tauri
        let hwnd = window.hwnd().map_err(|e| e.to_string())?;
        let mut mpv = state.mpv.lock().map_err(|e| e.to_string())?;
        mpv.launch_embedded(&url, title.as_deref(), hwnd.0 as isize)
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let mut mpv = state.mpv.lock().map_err(|e| e.to_string())?;
        mpv.launch(&url, title.as_deref()).map_err(|e| e.to_string())
    }
}

#[tauri::command]
async fn launch_custom_player(player_path: String, url: String, title: Option<String>) -> Result<(), String> {
    use std::process::Command;
    let mut cmd = Command::new(&player_path);
    cmd.arg(&url);
    if let Some(t) = &title {
        if player_path.to_lowercase().contains("vlc") { cmd.args(["--meta-title", t]); }
        else if player_path.to_lowercase().contains("mpc") { cmd.args(["/title", t]); }
    }
    cmd.spawn().map_err(|e| format!("Impossibile avviare {}: {}", player_path, e))?;
    Ok(())
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
    #[cfg(target_os = "windows")]
    std::process::Command::new("cmd").args(["/C", "start", "", &url]).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(&url).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(&url).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

/// Streama un magnet link via webtorrent-cli o aria2c come HTTP locale
/// Restituisce l'URL HTTP locale da passare a mpv
#[tauri::command]
async fn stream_magnet(
    state: State<'_, AppState>,
    magnet: String,
    title: Option<String>,
) -> Result<String, String> {
    // Strategia 1: prova webtorrent-cli (npm install -g webtorrent-cli)
    let wt_cmd = if cfg!(target_os = "windows") { "webtorrent.cmd" } else { "webtorrent" };
    if let Ok(out) = std::process::Command::new(wt_cmd).arg("--version").output() {
        if out.status.success() {
            // Trova porta libera
            let port = 8888u16;
            // Lancia webtorrent con output HTTP
            let _ = std::process::Command::new(wt_cmd)
                .args([&magnet, "--mpv", "--port", &port.to_string()])
                .spawn()
                .map_err(|e| e.to_string())?;
            // Dai tempo per avviarsi
            std::thread::sleep(std::time::Duration::from_millis(2000));
            // Ritorna URL locale che mpv usa
            return Ok(format!("http://localhost:{}", port));
        }
    }

    // Strategia 2: passa magnet direttamente a mpv (funziona se il sistema ha un client torrent)
    let mut mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    mpv.launch(&magnet, title.as_deref()).map_err(|e| e.to_string())?;
    Ok("mpv".to_string()) // segnala che mpv è stato già avviato
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(AppState { mpv: Mutex::new(mpv::MpvManager::new()) })
        .invoke_handler(tauri::generate_handler![
            fetch_manifest, fetch_streams,
            launch_mpv, launch_mpv_embedded, launch_custom_player,
            mpv_command, mpv_stop, mpv_get_position, mpv_get_duration,
            open_url, stream_magnet, resolve_stream_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running nuvio-desktop");
}

fn main() { run(); }

#[tauri::command]
async fn resolve_stream_url(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(15))
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    
    // Prova prima HEAD, poi GET con Range se HEAD fallisce
    let ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    
    let resp = client
        .head(&url)
        .header("User-Agent", ua)
        .send()
        .await;
    
    match resp {
        Ok(r) if r.status().as_u16() < 400 => Ok(r.url().to_string()),
        _ => {
            // Fallback: GET con Range per non scaricare l'intero file
            let r2 = client
                .get(&url)
                .header("User-Agent", ua)
                .header("Range", "bytes=0-0")
                .send()
                .await
                .map_err(|e| e.to_string())?;
            Ok(r2.url().to_string())
        }
    }
}
