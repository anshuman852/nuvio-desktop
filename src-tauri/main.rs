fn main() {
    tauri::Builder::default()
        .manage(AppState {
            mpv: Mutex::new(mpv::MpvManager::new()),
        })
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())   // <-- add this
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