#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod addon;
mod mpv_native;
mod proxy;
mod plugin;
mod discord_rpc;

use std::sync::{Arc, Mutex};
use tauri::{State, Manager};
use plugin::PluginRuntime;

pub struct AppState {
    pub native_mpv: Mutex<Option<Arc<mpv_native::MpvPlayer>>>,
    pub plugin_runtime: Arc<PluginRuntime>,
    pub discord: discord_rpc::DiscordRPC,
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

// ─── External player command ──────────────────────────────────────────────────

#[tauri::command]
async fn launch_custom_player(player_path: String, url: String, title: Option<String>) -> Result<(), String> {
    let mut cmd = std::process::Command::new(&player_path);
    cmd.arg(&url);
    if let Some(t) = &title {
        if player_path.to_lowercase().contains("vlc") { cmd.args(["--meta-title", t]); }
        else if player_path.to_lowercase().contains("mpc") { cmd.args(["/title", t]); }
    }
    cmd.spawn().map_err(|e| format!("Cannot launch {}: {}", player_path, e))?;
    Ok(())
}

// ─── MPV NATIVE commands (direct libmpv FFI) ──────────────────────────────────

#[tauri::command]
async fn mpv_native_init(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Guard against React StrictMode double-mount — return early if already
    // initialized rather than creating a second MpvPlayer racing on the same HWND.
    if state.native_mpv.lock().map_err(|e| e.to_string())?.is_some() {
        eprintln!("[mpv-native] init skipped — already initialized");
        return Ok(());
    }

    let window = app.get_webview_window("main")
        .ok_or("main window not found")?;

    // Get HWND
    #[cfg(target_os = "windows")]
    let hwnd_val: i64 = {
        let hwnd = window.hwnd().map_err(|e| format!("HWND error: {}", e))?;
        hwnd.0 as i64
    };
    #[cfg(not(target_os = "windows"))]
    let hwnd_val: i64 = 0;

    let mpv = mpv_native::MpvPlayer::new(hwnd_val)?;
    
    // Observe key properties
    mpv.observe_property("time-pos", 1, mpv_native::MPV_FORMAT_DOUBLE)?;
    mpv.observe_property("duration", 2, mpv_native::MPV_FORMAT_DOUBLE)?;
    mpv.observe_property("pause", 3, mpv_native::MPV_FORMAT_FLAG)?;
    
    let mpv_arc = Arc::new(mpv);
    
    // Start event loop
    mpv_native::start_event_loop(mpv_arc.clone(), app.clone());
    
    // Store
    *state.native_mpv.lock().map_err(|e| e.to_string())? = Some(mpv_arc);
    
    eprintln!("[mpv-native] Initialized successfully");
    Ok(())
}

#[tauri::command]
async fn mpv_native_load_url(
    state: State<'_, AppState>,
    url: String,
) -> Result<(), String> {
    let guard = state.native_mpv.lock().map_err(|e| e.to_string())?;
    let mpv = guard.as_ref().ok_or("MPV not initialized")?;
    eprintln!("[mpv-native] Loading: {}", url.chars().take(100).collect::<String>());
    mpv.load_url(&url)
}

#[tauri::command]
async fn mpv_native_toggle_pause(state: State<'_, AppState>) -> Result<(), String> {
    let guard = state.native_mpv.lock().map_err(|e| e.to_string())?;
    let mpv = guard.as_ref().ok_or("MPV not initialized")?;
    mpv.toggle_pause()
}

#[tauri::command]
async fn mpv_native_seek(state: State<'_, AppState>, seconds: f64) -> Result<(), String> {
    let guard = state.native_mpv.lock().map_err(|e| e.to_string())?;
    let mpv = guard.as_ref().ok_or("MPV not initialized")?;
    mpv.seek_absolute(seconds)
}

#[tauri::command]
async fn mpv_native_set_volume(state: State<'_, AppState>, volume: f64) -> Result<(), String> {
    let guard = state.native_mpv.lock().map_err(|e| e.to_string())?;
    let mpv = guard.as_ref().ok_or("MPV not initialized")?;
    mpv.set_volume(volume)
}

#[tauri::command]
async fn mpv_native_stop(state: State<'_, AppState>) -> Result<(), String> {
    let guard = state.native_mpv.lock().map_err(|e| e.to_string())?;
    let mpv = guard.as_ref().ok_or("MPV not initialized")?;
    mpv.stop()
}

#[tauri::command]
async fn force_transparent_webview(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("main window not found")?;
    window
        .set_background_color(Some(tauri::window::Color(0, 0, 0, 0)))
        .map_err(|e| format!("set_background_color failed: {}", e))?;
    eprintln!("[setup] WebView2 background re-forced to transparent");
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

// ─── Discord Rich Presence commands ──────────────────────────────────────────

#[tauri::command]
fn discord_connect(
    state: State<'_, AppState>,
    client_id: String,
) -> Result<(), String> {
    eprintln!("[DiscordRPC] connect called with client_id={}", client_id);
    match state.discord.connect(&client_id) {
        Ok(()) => { eprintln!("[DiscordRPC] connect OK"); Ok(()) },
        Err(e) => { eprintln!("[DiscordRPC] connect FAIL: {}", e); Err(e) },
    }
}

#[tauri::command]
fn discord_disconnect(state: State<'_, AppState>) -> Result<(), String> {
    eprintln!("[DiscordRPC] disconnect called");
    state.discord.disconnect();
    Ok(())
}

#[tauri::command]
fn discord_set_playing(
    state: State<'_, AppState>,
    details: String,
    state_str: String,
    large_text: String,
    small_text: String,
    start_timestamp: Option<i64>,
) -> Result<(), String> {
    eprintln!("[DiscordRPC] set_playing details={:?} state_str={:?}", details, state_str);
    match state.discord.set_presence(&state_str, &details, &large_text, &small_text, start_timestamp, None) {
        Ok(()) => { eprintln!("[DiscordRPC] set_playing OK"); Ok(()) },
        Err(e) => { eprintln!("[DiscordRPC] set_playing FAIL: {}", e); Err(e) },
    }
}

#[tauri::command]
fn discord_set_browsing(state: State<'_, AppState>) -> Result<(), String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    eprintln!("[DiscordRPC] set_browsing");
    state.discord.set_presence(
        "Browsing catalog",
        "Nuvio Desktop",
        "Nuvio Desktop",
        "Browsing",
        Some(now),
        Some("nuvio"),
    )
}

#[tauri::command]
fn discord_clear_presence(state: State<'_, AppState>) -> Result<(), String> {
    eprintln!("[DiscordRPC] clear_presence called");
    state.discord.clear_presence()
}

#[tauri::command]
fn discord_is_connected(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.discord.is_connected())
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



// ─── Entry point ──────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            let plugin_runtime = Arc::new(PluginRuntime::new(&app.handle()));

            app.manage(AppState {
                native_mpv: Mutex::new(None),
                plugin_runtime,
                discord: discord_rpc::DiscordRPC::new(),
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

            // Show window after setup (was hidden due to transparent+decorations:false).
            // Also force the WebView2 default background to fully transparent —
            // `transparent: true` in tauri.conf only sets the window's layered
            // style; the WebView2 controller still paints an opaque surface that
            // covers the embedded mpv HWND. set_background_color with alpha=0
            // calls put_DefaultBackgroundColor under the hood on Windows.
            if let Some(window) = app.get_webview_window("main") {
                if let Err(e) = window.set_background_color(Some(tauri::window::Color(0, 0, 0, 0))) {
                    eprintln!("[setup] Failed to set transparent webview bg: {}", e);
                } else {
                    eprintln!("[setup] WebView2 background set to transparent");
                }
                if let Err(e) = window.show() {
                    eprintln!("[setup] Failed to show window: {}", e);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fetch_manifest,
            fetch_catalog,
            fetch_meta,
            fetch_streams,
            get_proxy_url,
            launch_custom_player,
            open_url,
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
            mpv_native_init,
            mpv_native_load_url,
            mpv_native_toggle_pause,
            mpv_native_seek,
            mpv_native_set_volume,
            mpv_native_stop,
            force_transparent_webview,
            discord_connect,
            discord_disconnect,
            discord_set_playing,
            discord_set_browsing,
            discord_clear_presence,
            discord_is_connected,
        ])
        .run(tauri::generate_context!())
        .expect("error while running nuvio-desktop");
}