#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod addon;
mod mpv;

use std::sync::Mutex;
use tauri::{State, Emitter};

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

#[tauri::command]
async fn launch_mpv(state: State<'_, AppState>, url: String, title: Option<String>) -> Result<(), String> {
    let mut mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    mpv.launch(&url, title.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
async fn launch_mpv_embedded(
    state: State<'_, AppState>,
    window: tauri::Window,
    url: String,
    title: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
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

/// Lancia mpv per qualsiasi stream: HLS, HTTP, magnet, debrid, WebStreamr, ecc.
/// Emette eventi Tauri: mpv_position, mpv_duration, mpv_ended per il player React
#[tauri::command]
async fn launch_mpv_stream(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    url: String,
    title: Option<String>,
    referrer: Option<String>,
) -> Result<(), String> {
    // Trova mpv
    let mpv_path = std::env::current_exe()
        .ok()
        .and_then(|exe| {
            let dir = exe.parent()?.to_owned();
            let candidate = dir.join("mpv.exe");
            if candidate.exists() { Some(candidate.to_string_lossy().to_string()) }
            else { None }
        })
        .unwrap_or_else(|| "mpv".to_string());

    let ipc = format!("\\\\.\\pipe\\nuvio-mpv-{}", std::process::id());

    let mut args: Vec<String> = vec![
        url.clone(),
        format!("--input-ipc-server={}", ipc),
        "--no-terminal".to_string(),
        "--force-window=yes".to_string(),
        "--keep-open=yes".to_string(),
        "--ontop=yes".to_string(),
        "--geometry=1280x720+100+50".to_string(),
        format!("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"),
        "--network-timeout=30".to_string(),
        "--cache=yes".to_string(),
        "--demuxer-max-bytes=150M".to_string(),
        "--hwdec=auto".to_string(),
    ];

    // Non usare ytdl per stream HTTP normali (rallenta); tienilo per magnet
    if !url.starts_with("magnet:") {
        args.push("--ytdl=no".to_string());
    }

    if let Some(ref t) = title {
        args.push(format!("--force-media-title={}", t));
    }

    // Referrer: se fornito, altrimenti auto-detect WebStreamr
    if let Some(ref r) = referrer {
        args.push(format!("--referrer={}", r));
    } else if url.contains("127.0.0.1:11470") || url.contains("supervideo") || url.contains("streamvid") {
        args.push("--referrer=https://supervideo.cc/".to_string());
    }

    let child = std::process::Command::new(&mpv_path)
        .args(&args)
        .spawn()
        .map_err(|e| format!("mpv non trovato: {}. Scarica mpv.exe e mettilo nella cartella dell'app.", e))?;

    {
        let mut mpv = state.mpv.lock().map_err(|e| e.to_string())?;
        mpv.stop();
        mpv.process = Some(child);
        mpv.ipc_path = Some(ipc);
    }

    // Aspetta che mpv apra la pipe IPC
    std::thread::sleep(std::time::Duration::from_millis(800));

    // Avvia polling IPC in background: emette eventi Tauri ogni 1s
    let app_handle = app.clone();
    let state_clone: tauri::State<'_, AppState> = app.state();
    // Non possiamo clonare State, usiamo un thread separato con AppHandle
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            // Leggi posizione e durata via IPC
            let pos_result = {
                let state: tauri::State<'_, AppState> = app_handle.state();
                let mpv = state.mpv.lock();
                match mpv {
                    Ok(m) => m.get_position(),
                    Err(_) => break,
                }
            };
            let dur_result = {
                let state: tauri::State<'_, AppState> = app_handle.state();
                let mpv = state.mpv.lock();
                match mpv {
                    Ok(m) => m.get_duration(),
                    Err(_) => break,
                }
            };

            let _ = app_handle.emit("mpv_position", pos_result);
            let _ = app_handle.emit("mpv_duration", dur_result);

            // Se mpv è terminato (posizione == durata e > 0), notifica
            if dur_result > 0.0 && pos_result >= dur_result - 1.0 {
                let _ = app_handle.emit("mpv_ended", ());
            }

            // Controlla se il processo è ancora in esecuzione
            let still_running = {
                let state: tauri::State<'_, AppState> = app_handle.state();
                let mut mpv = match state.mpv.lock() {
                    Ok(m) => m,
                    Err(_) => break,
                };
                match mpv.process {
                    Some(ref mut child) => {
                        matches!(child.try_wait(), Ok(None))
                    }
                    None => false,
                }
            };
            if !still_running {
                let _ = app_handle.emit("mpv_ended", ());
                break;
            }
        }
    });

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

#[tauri::command]
async fn stream_magnet(
    state: State<'_, AppState>,
    magnet: String,
    title: Option<String>,
) -> Result<String, String> {
    let mut mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    mpv.launch(&magnet, title.as_deref()).map_err(|e| e.to_string())?;
    Ok("mpv".to_string())
}

#[tauri::command]
async fn resolve_stream_url(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(15))
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    let resp = client.head(&url).header("User-Agent", ua).send().await;
    match resp {
        Ok(r) if r.status().as_u16() < 400 => Ok(r.url().to_string()),
        _ => {
            let r2 = client.get(&url).header("User-Agent", ua)
                .header("Range", "bytes=0-0").send().await
                .map_err(|e| e.to_string())?;
            Ok(r2.url().to_string())
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(AppState { mpv: Mutex::new(mpv::MpvManager::new()) })
        .invoke_handler(tauri::generate_handler![
            fetch_manifest, fetch_streams,
            launch_mpv, launch_mpv_embedded, launch_custom_player,
            launch_mpv_stream,
            mpv_command, mpv_stop, mpv_get_position, mpv_get_duration,
            open_url, stream_magnet, resolve_stream_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running nuvio-desktop");
}

fn main() { run(); }
