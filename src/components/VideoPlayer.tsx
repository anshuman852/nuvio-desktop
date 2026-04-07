// Aggiungi al Cargo.toml:
// mpv = { git = "https://github.com/ParadoxSpiral/mpv-rs" }
// reqwest = { version = "0.11", features = ["json"] }

use std::sync::Mutex;
use tauri::{Manager, Window, Emitter};
use mpv::{MpvHandler, MpvHandlerInit, Event, EventKind, LogLevel};

struct MpvState {
    player: Option<MpvHandler>,
    window: Window,
}

#[tauri::command]
async fn mpv_init(window: Window, hwnd: usize) -> Result<(), String> {
    let mpv = MpvHandlerInit::new()
        .map_err(|e| e.to_string())?
        .set_log_level(LogLevel::Debug)
        .map_err(|e| e.to_string())?
        .set_option("vo", "gpu")
        .map_err(|e| e.to_string())?
        .set_option("hwdec", "auto")
        .map_err(|e| e.to_string())?
        .set_option("cache", "yes")
        .map_err(|e| e.to_string())?
        .set_option("cache-secs", "30")
        .map_err(|e| e.to_string())?
        .set_option("demuxer-max-bytes", "150M")
        .map_err(|e| e.to_string())?
        .set_option("demuxer-max-back-bytes", "75M")
        .map_err(|e| e.to_string())?
        .set_option("network-timeout", "30")
        .map_err(|e| e.to_string())?
        .set_option("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;
    
    // Attacca alla finestra
    mpv.set_property("wid", hwnd as i64).map_err(|e| e.to_string())?;
    
    let state = MpvState { player: Some(mpv), window: window.clone() };
    window.manage(Mutex::new(state));
    
    // Avvia il loop degli eventi
    start_event_loop(window);
    
    Ok(())
}

fn start_event_loop(window: Window) {
    std::thread::spawn(move || {
        let state = window.state::<Mutex<MpvState>>();
        loop {
            let mut state = state.lock().unwrap();
            if let Some(player) = &mut state.player {
                match player.wait_event(0.1) {
                    Event::PlaybackRestart => {
                        let _ = window.emit("mpv_resumed", ());
                    }
                    Event::EndFile(_) => {
                        let _ = window.emit("mpv_ended", ());
                    }
                    Event::PropertyChange { name, data } => {
                        match name.as_str() {
                            "time-pos" => {
                                if let Some(pos) = data.as_f64() {
                                    let _ = window.emit("mpv_time", pos);
                                }
                            }
                            "duration" => {
                                if let Some(dur) = data.as_f64() {
                                    let _ = window.emit("mpv_duration", dur);
                                }
                            }
                            "pause" => {
                                if let Some(paused) = data.as_bool() {
                                    if paused {
                                        let _ = window.emit("mpv_paused", ());
                                    } else {
                                        let _ = window.emit("mpv_resumed", ());
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                    _ => {}
                }
            } else {
                break;
            }
        }
    });
}

#[tauri::command]
async fn mpv_load(window: Window, url: String, referrer: Option<String>, title: Option<String>) -> Result<(), String> {
    let state = window.state::<Mutex<MpvState>>();
    let mut state = state.lock().unwrap();
    
    if let Some(player) = &mut state.player {
        if let Some(ref r) = referrer {
            player.set_option("referrer", r).map_err(|e| e.to_string())?;
        }
        if let Some(t) = title {
            let _ = window.set_title(&t);
        }
        player.command(&["loadfile", &url, "replace"]).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn mpv_command(window: Window, cmd: String, args: Vec<String>) -> Result<(), String> {
    let state = window.state::<Mutex<MpvState>>();
    let mut state = state.lock().unwrap();
    if let Some(player) = &mut state.player {
        let full_cmd = std::iter::once(&cmd).chain(args.iter()).map(String::as_str).collect::<Vec<_>>();
        player.command(&full_cmd).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn mpv_seek(window: Window, seconds: f64) -> Result<(), String> {
    let state = window.state::<Mutex<MpvState>>();
    let mut state = state.lock().unwrap();
    if let Some(player) = &mut state.player {
        player.command(&["seek", &seconds.to_string(), "absolute"]).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn mpv_volume(window: Window, volume: i64) -> Result<(), String> {
    let state = window.state::<Mutex<MpvState>>();
    let mut state = state.lock().unwrap();
    if let Some(player) = &mut state.player {
        player.set_property("volume", volume).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn mpv_mute(window: Window, muted: bool) -> Result<(), String> {
    let state = window.state::<Mutex<MpvState>>();
    let mut state = state.lock().unwrap();
    if let Some(player) = &mut state.player {
        player.set_property("mute", muted).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn mpv_get_position(window: Window) -> Result<f64, String> {
    let state = window.state::<Mutex<MpvState>>();
    let state = state.lock().unwrap();
    if let Some(player) = &state.player {
        player.get_property("time-pos").map_err(|e| e.to_string())
    } else {
        Ok(0.0)
    }
}

#[tauri::command]
async fn mpv_get_duration(window: Window) -> Result<f64, String> {
    let state = window.state::<Mutex<MpvState>>();
    let state = state.lock().unwrap();
    if let Some(player) = &state.player {
        player.get_property("duration").map_err(|e| e.to_string())
    } else {
        Ok(0.0)
    }
}

#[tauri::command]
async fn mpv_stop(window: Window) -> Result<(), String> {
    let state = window.state::<Mutex<MpvState>>();
    let mut state = state.lock().unwrap();
    if let Some(player) = &mut state.player {
        player.command(&["stop"]).ok();
        state.player = None;
    }
    Ok(())
}

#[tauri::command]
async fn resolve_magnet_with_debrid(magnet: String) -> Result<String, String> {
    // Implementazione Real-Debrid
    let api_key = std::env::var("REAL_DEBRID_API_KEY").unwrap_or_default();
    if api_key.is_empty() {
        return Err("REAL_DEBRID_API_KEY non configurata".to_string());
    }
    
    let client = reqwest::Client::new();
    
    // 1. Aggiungi magnet
    let res: serde_json::Value = client
        .post("https://api.real-debrid.com/rest/1.0/torrents/addMagnet")
        .query(&[("magnet", &magnet)])
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    
    let torrent_id = res["id"].as_str().ok_or("No torrent id")?;
    
    // 2. Seleziona file (il più grande)
    let info: serde_json::Value = client
        .get(format!("https://api.real-debrid.com/rest/1.0/torrents/info/{}", torrent_id))
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    
    let files = info["files"].as_array().ok_or("No files")?;
    let largest = files.iter()
        .max_by_key(|f| f["bytes"].as_u64().unwrap_or(0))
        .ok_or("No files")?;
    let file_id = largest["id"].as_u64().ok_or("No file id")?;
    
    // 3. Seleziona il file
    client
        .post(format!("https://api.real-debrid.com/rest/1.0/torrents/selectFiles/{}", torrent_id))
        .query(&[("files", file_id.to_string())])
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    // 4. Attendi che sia pronto
    std::thread::sleep(std::time::Duration::from_secs(3));
    
    // 5. Ottieni link dello stream
    let stream_url = format!("https://api.real-debrid.com/rest/1.0/torrents/instantAvailability/{}", torrent_id);
    Ok(stream_url)
}