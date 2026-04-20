// src-tauri/src/plugin/ipc.rs
use tauri::ipc::Channel;

#[tauri::command]
pub fn test_ipc() -> Result<String, String> {
    eprintln!("[IPC] test_ipc called successfully");
    Ok("IPC working!".to_string())
}