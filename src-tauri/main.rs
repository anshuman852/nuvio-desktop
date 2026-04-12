#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod addon;
mod mpv;

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
async fn fetch_streams(addon_url: String, type_: String, id: String) -> Result<serde_json::Value, String> {
    addon::fetch_streams(&addon_url, &type_, &id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn launch_mpv(state: State<'_, AppState>, url: String, title: Option<String>) -> Result<(), String> {
    let mut mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    mpv.launch(&url, title.as_deref()).map_err(|e| e.to_string())
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
async fn launch_mpv_stream(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    url: String,
    title: Option<String>,
    referrer: Option<String>,
) -> Result<(), String> {
    // Trova mpv.exe nella stessa cartella dell'eseguibile
    let mpv_path = std::env::current_exe()
        .ok()
        .and_then(|exe| {
            let dir = exe.parent()?.to_owned();
            let candidate = dir.join("mpv.exe");
            eprintln!("[mpv] cercando in: {}", candidate.display());
            if candidate.exists() { Some(candidate) }
            else { None }
        })
        .unwrap_or_else(|| std::path::PathBuf::from("mpv"));

    eprintln!("[mpv] path finale: {}", mpv_path.display());

    let ipc = format!("\\\\.\\pipe\\nuvio-mpv-{}", std::process::id());

    let mut args: Vec<String> = vec![
        url.clone(),
        format!("--input-ipc-server={}", ipc),
        "--no-terminal".to_string(),
        "--force-window=yes".to_string(),
        "--keep-open=yes".to_string(),
        "--ontop=yes".to_string(),
        "--geometry=1280x720+100+50".to_string(),
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36".to_string(),
        "--network-timeout=30".to_string(),
        "--cache=yes".to_string(),
        "--demuxer-max-bytes=150M".to_string(),
        "--hwdec=auto".to_string(),
    ];

    if !url.starts_with("magnet:") {
        args.push("--ytdl=no".to_string());
    }
    if let Some(ref t) = title {
        args.push(format!("--force-media-title={}", t));
    }
    if let Some(ref r) = referrer {
        args.push(format!("--referrer={}", r));
    } else if url.contains("supervideo") || url.contains("streamvid") {
        args.push("--referrer=https://supervideo.cc/".to_string());
    }

    eprintln!("[mpv] args: {:?}", args);

    let child = std::process::Command::new(&mpv_path)
        .args(&args)
        .spawn()
        .map_err(|e| format!("Impossibile avviare mpv ({}): {}", mpv_path.display(), e))?;

    {
        let mut mpv = state.mpv.lock().map_err(|e| e.to_string())?;
        mpv.stop();
        mpv.process = Some(child);
        mpv.ipc_path = Some(ipc);
    }

    std::thread::sleep(std::time::Duration::from_millis(800));

    let app_handle = app.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(1));
            let state: tauri::State<'_, AppState> = app_handle.state();
            let (pos, dur, alive) = {
                let mut mpv = match state.mpv.lock() {
                    Ok(m) => m,
                    Err(_) => break,
                };
                let pos = mpv.get_position();
                let dur = mpv.get_duration();
                let alive = match mpv.process {
                    Some(ref mut c) => c.try_wait().map(|r| r.is_none()).unwrap_or(false),
                    None => false,
                };
                (pos, dur, alive)
            };
            let _ = app_handle.emit("mpv_position", pos);
            let _ = app_handle.emit("mpv_duration", dur);
            if !alive {
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
            launch_mpv, launch_custom_player,
            launch_mpv_stream,
            mpv_command, mpv_stop, mpv_get_position, mpv_get_duration,
            open_url, stream_magnet, resolve_stream_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running nuvio-desktop");
}

fn main() { run(); }
