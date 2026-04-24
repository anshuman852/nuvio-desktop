#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod addon;
mod mpv;
mod proxy;
mod plugin;

use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use tauri::{State, Manager};
use plugin::PluginRuntime;

pub struct AppState {
    pub mpv: Mutex<mpv::MpvManager>,
    pub plugin_runtime: Arc<PluginRuntime>,
}

// ─── Addon / meta commands ────────────────────────────────────────────────────

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

// ─── Proxy helper ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn get_proxy_url(url: String, referer: Option<String>, origin: Option<String>) -> Result<String, String> {
    let encoded = urlencoding::encode(&url);
    let mut proxy = format!("{}/proxy?url={}", proxy::PROXY_BASE, encoded);
    if let Some(r) = referer.filter(|r| !r.is_empty()) {
        proxy.push_str(&format!("&referer={}", urlencoding::encode(&r)));
    }
    if let Some(o) = origin.filter(|o| !o.is_empty()) {
        proxy.push_str(&format!("&origin={}", urlencoding::encode(&o)));
    }
    Ok(proxy)
}

// ─── MPV EMBEDDED commands (Windows) ─────────────────────────────────────────

#[tauri::command]
async fn launch_mpv_embedded(
    window: tauri::Window,
    state: State<'_, AppState>,
    url: String,
    title: String,
    referrer: Option<String>,
) -> Result<(), String> {
    let mut mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    
    // Su Tauri v2, dobbiamo ottenere l'HWND e passarlo come isize
    #[cfg(target_os = "windows")]
    let hwnd = {
        let hwnd_raw = window.hwnd().map_err(|e| format!("Errore HWND: {}", e))?;
        // Converte HWND a isize
        hwnd_raw.0 as isize
    };
    
    #[cfg(not(target_os = "windows"))]
    let hwnd = 0;
    
    eprintln!("[mpv] HWND per embedding: {}", hwnd);
    
    // Passa il wid per embedding
    mpv.launch_embedded(&url, &title, referrer.as_deref(), hwnd)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn launch_mpv(state: State<'_, AppState>, url: String, title: Option<String>, referrer: Option<String>) -> Result<(), String> {
    let mut mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    // Senza wid, apre finestra separata (fallback)
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
async fn mpv_pause(state: State<'_, AppState>) -> Result<(), String> {
    let mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    mpv.send_command("set", &[serde_json::json!("pause"), serde_json::json!("yes")])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn mpv_resume(state: State<'_, AppState>) -> Result<(), String> {
    let mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    mpv.send_command("set", &[serde_json::json!("pause"), serde_json::json!("no")])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn mpv_seek(state: State<'_, AppState>, seconds: f64) -> Result<(), String> {
    let mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    mpv.send_command("seek", &[serde_json::json!(seconds), serde_json::json!("absolute")])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn mpv_set_volume(state: State<'_, AppState>, volume: i64) -> Result<(), String> {
    let mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    mpv.send_command("set", &[serde_json::json!("volume"), serde_json::json!(volume)])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn mpv_set_speed(state: State<'_, AppState>, speed: f64) -> Result<(), String> {
    let mpv = state.mpv.lock().map_err(|e| e.to_string())?;
    mpv.send_command("set", &[serde_json::json!("speed"), serde_json::json!(speed)])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Utility commands ─────────────────────────────────────────────────────────

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

#[tauri::command]
async fn proxy_stream_url(url: String, referer: Option<String>) -> Result<String, String> {
    use reqwest::header::{HeaderMap, HeaderValue, REFERER, USER_AGENT};
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(30)).build().map_err(|e| e.to_string())?;
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"));
    if let Some(r) = referer {
        headers.insert(REFERER, HeaderValue::from_str(&r).map_err(|e| e.to_string())?);
    }
    let response = client.get(&url).headers(headers).send().await.map_err(|e| e.to_string())?;
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    let temp_path = std::env::temp_dir().join(format!("nuvio_stream_{}.mp4", std::process::id()));
    std::fs::write(&temp_path, bytes).map_err(|e| e.to_string())?;
    Ok(temp_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn proxy_stream(url: String, referer: Option<String>) -> Result<Vec<u8>, String> {
    use reqwest::header::{HeaderMap, HeaderValue, REFERER, USER_AGENT};
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(30)).build().map_err(|e| e.to_string())?;
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"));
    if let Some(r) = referer {
        headers.insert(REFERER, HeaderValue::from_str(&r).map_err(|e| e.to_string())?);
    }
    let response = client.get(&url).headers(headers).send().await.map_err(|e| e.to_string())?;
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    Ok(bytes.to_vec())
}

// ─── Test IPC ────────────────────────────────────────────────────────────────

#[tauri::command]
fn test_ipc() -> Result<String, String> {
    eprintln!("[IPC] test_ipc called");
    Ok("IPC working!".to_string())
}

// ─── Plugin commands ─────────────────────────────────────────────────────────

#[tauri::command]
async fn plugin_get_repositories(
    state: State<'_, AppState>,
) -> Result<Vec<crate::plugin::RepositoryInfo>, String> {
    Ok(state.plugin_runtime.repository_manager.lock().await.get_repositories())
}

#[tauri::command]
async fn plugin_add_repository(
    state: State<'_, AppState>,
    url: String,
) -> Result<crate::plugin::RepositoryInfo, String> {
    let repo = state.plugin_runtime
        .repository_manager
        .lock()
        .await
        .add_repository(url)
        .await?;

    state.plugin_runtime.reload_scrapers();
    Ok(repo)
}

#[tauri::command]
async fn plugin_remove_repository(
    state: State<'_, AppState>,
    repo_id: String,
) -> Result<(), String> {
    state.plugin_runtime.repository_manager.lock().await.remove_repository(&repo_id)
}

#[tauri::command]
async fn plugin_refresh_repository(
    state: State<'_, AppState>,
    repo_id: String,
) -> Result<(), String> {
    state.plugin_runtime
        .repository_manager
        .lock()
        .await
        .refresh_repository(&repo_id)
        .await?;

    state.plugin_runtime.reload_scrapers();
    Ok(())
}

#[tauri::command]
async fn plugin_get_scrapers(
    state: State<'_, AppState>,
) -> Result<Vec<crate::plugin::ScraperInfo>, String> {
    let manager = state.plugin_runtime.scraper_manager.lock().map_err(|e| e.to_string())?;
    Ok(manager.get_scrapers())
}

#[tauri::command]
async fn plugin_set_scraper_enabled(
    state: State<'_, AppState>,
    scraper_id: String,
    enabled: bool,
) -> Result<(), String> {
    let mut manager = state.plugin_runtime.scraper_manager.lock().map_err(|e| e.to_string())?;
    manager.set_scraper_enabled(&scraper_id, enabled)
}

#[tauri::command]
async fn plugin_get_streams(
    state: State<'_, AppState>,
    media_type: String,
    tmdb_id: String,
    season: Option<u32>,
    episode: Option<u32>,
) -> Result<Vec<crate::plugin::StreamResult>, String> {
    let streams = state.plugin_runtime
        .get_streams(&media_type, &tmdb_id, season, episode)
        .await;
    Ok(streams)
}

#[tauri::command]
async fn plugin_is_enabled(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.plugin_runtime.is_enabled())
}

#[tauri::command]
async fn plugin_set_enabled(state: State<'_, AppState>, enabled: bool) -> Result<(), String> {
    state.plugin_runtime.set_enabled(enabled);
    Ok(())
}

#[tauri::command]
async fn plugin_test_scraper(
    state: State<'_, AppState>,
    scraper_id: String,
) -> Result<serde_json::Value, String> {
    let (streams, logs) = state.plugin_runtime.test_scraper(&scraper_id).await?;
    Ok(serde_json::json!({ "streams": streams, "logs": logs }))
}

// ─── MPV helper commands ─────────────────────────────────────────────────────

#[tauri::command]
async fn check_mpv_available() -> Result<bool, String> {
    let result = std::process::Command::new("mpv")
        .arg("--version")
        .output();
    
    match result {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
async fn get_mpv_path() -> Result<String, String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| e.to_string())?;
    let app_dir = exe_path.parent().ok_or("No parent dir")?;
    
    let possible_paths = vec![
        app_dir.join("mpv.exe"),
        app_dir.join("resources/mpv.exe"),
        PathBuf::from("mpv.exe"),
        PathBuf::from("resources/mpv.exe"),
    ];
    
    for path in possible_paths {
        if path.exists() {
            return Ok(path.to_string_lossy().to_string());
        }
    }
    
    // Cerca nel PATH
    if let Ok(output) = std::process::Command::new("where").arg("mpv").output() {
        if output.status.success() {
            if let Ok(path) = String::from_utf8(output.stdout) {
                let first_line = path.lines().next().unwrap_or("").to_string();
                if !first_line.is_empty() {
                    return Ok(first_line);
                }
            }
        }
    }
    
    Err("mpv not found".to_string())
}

// ─── Entry point ──────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            let plugin_runtime = Arc::new(PluginRuntime::new(&app.handle()));

            app.manage(AppState {
                mpv: Mutex::new(mpv::MpvManager::new()),
                plugin_runtime,
            });

            let proxy = proxy::StreamProxy::new();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                if let Err(e) = proxy.start().await {
                    eprintln!("[proxy] Errore avvio: {}", e);
                } else {
                    eprintln!("[proxy] Server avviato su http://127.0.0.1:11473/proxy");
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fetch_manifest,
            fetch_catalog,
            fetch_meta,
            fetch_streams,
            get_proxy_url,
            launch_mpv_embedded,
            launch_mpv,
            launch_custom_player,
            launch_mpv_stream,
            mpv_command,
            mpv_stop,
            mpv_get_position,
            mpv_get_duration,
            mpv_pause,
            mpv_resume,
            mpv_seek,
            mpv_set_volume,
            mpv_set_speed,
            open_url,
            stream_magnet,
            resolve_stream_url,
            proxy_stream,
            proxy_stream_url,
            test_ipc,
            plugin_get_repositories,
            plugin_add_repository,
            plugin_remove_repository,
            plugin_refresh_repository,
            plugin_get_scrapers,
            plugin_set_scraper_enabled,
            plugin_get_streams,
            plugin_is_enabled,
            plugin_set_enabled,
            plugin_test_scraper,
            check_mpv_available,
            get_mpv_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running nuvio-desktop");
}