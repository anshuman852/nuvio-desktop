use std::process::{Child, Command};
use std::io::{Write, BufRead, BufReader};
use std::path::{Path, PathBuf};
use serde_json::Value;

pub struct MpvManager {
    pub process: Option<Child>,
    pub ipc_path: Option<String>,
    #[cfg(target_os = "windows")]
    pub ipc_writer: Option<std::fs::File>,
}

impl MpvManager {
    pub fn new() -> Self {
        MpvManager {
            process: None,
            ipc_path: None,
            #[cfg(target_os = "windows")]
            ipc_writer: None,
        }
    }

    /// Trova il binario mpv (sidecar bundled o nel PATH)
    fn find_mpv() -> Result<PathBuf, Box<dyn std::error::Error>> {
        // 1. Sidecar bundled nella cartella dell'app
        if let Ok(exe) = std::env::current_exe() {
            let dir = exe.parent().unwrap_or(Path::new("."));
            for name in &["mpv.exe", "mpv"] {
                let candidate = dir.join(name);
                if candidate.exists() {
                    return Ok(candidate);
                }
            }
        }
        // 2. Nel PATH di sistema tramite where/which
        #[cfg(target_os = "windows")]
        {
            if let Ok(out) = Command::new("where").arg("mpv.exe").output() {
                if out.status.success() {
                    let s = String::from_utf8_lossy(&out.stdout);
                    if let Some(line) = s.lines().next() {
                        return Ok(PathBuf::from(line.trim()));
                    }
                }
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            if let Ok(out) = Command::new("which").arg("mpv").output() {
                if out.status.success() {
                    let s = String::from_utf8_lossy(&out.stdout);
                    if let Some(line) = s.lines().next() {
                        return Ok(PathBuf::from(line.trim()));
                    }
                }
            }
        }
        Err("mpv non trovato. Scarica mpv da https://mpv.io e mettilo nella cartella dell'app.".into())
    }

    fn ipc_name() -> String {
        #[cfg(target_os = "windows")]
        return format!("\\\\.\\pipe\\nuvio-mpv-{}", std::process::id());
        #[cfg(not(target_os = "windows"))]
        return format!("/tmp/nuvio-mpv-{}.sock", std::process::id());
    }

    fn base_args(url: &str, title: Option<&str>, ipc: &str) -> Vec<String> {
        let is_magnet = url.starts_with("magnet:");
        let mut args = vec![
            url.to_string(),
            format!("--input-ipc-server={}", ipc),
            "--no-terminal".to_string(),
            "--force-window=yes".to_string(),
            "--keep-open=yes".to_string(),
        ];
        if let Some(t) = title {
            args.push(format!("--force-media-title={}", t));
        }
        if is_magnet {
            // Per i magnet, mpv usa il protocollo torrent se disponibile
            args.push("--ytdl=no".to_string());
        }
        args
    }

    /// Lancia mpv in finestra separata (external mode)
    pub fn launch(&mut self, url: &str, title: Option<&str>) -> Result<(), Box<dyn std::error::Error>> {
        self.stop();
        let mpv = Self::find_mpv()?;
        let ipc = Self::ipc_name();
        let mut args = Self::base_args(url, title, &ipc);
        args.push("--ontop=yes".to_string());
        args.push("--geometry=900x506+100+100".to_string());

        let child = Command::new(&mpv).args(&args).spawn()?;
        self.process = Some(child);
        self.ipc_path = Some(ipc);

        // Aspetta che la pipe sia pronta
        std::thread::sleep(std::time::Duration::from_millis(500));
        Ok(())
    }

    /// Lancia mpv embedded nella finestra Tauri tramite HWND (Windows only)
    #[cfg(target_os = "windows")]
    pub fn launch_embedded(&mut self, url: &str, title: Option<&str>, hwnd: isize) -> Result<(), Box<dyn std::error::Error>> {
        self.stop();
        let mpv = Self::find_mpv()?;
        let ipc = Self::ipc_name();
        let mut args = Self::base_args(url, title, &ipc);

        // Embedding: usa HWND del panel nativo
        args.push(format!("--wid={}", hwnd));
        args.push("--no-border".to_string());
        args.push("--no-osc".to_string());
        args.push("--no-input-default-bindings".to_string());
        args.push("--keepaspect=yes".to_string());
        args.push("--video-unscaled=downscale-big".to_string());

        let child = Command::new(&mpv).args(&args).spawn()?;
        self.process = Some(child);
        self.ipc_path = Some(ipc);
        std::thread::sleep(std::time::Duration::from_millis(500));
        Ok(())
    }

    pub fn send_command(&self, cmd: &str, args: &[Value]) -> Result<Value, Box<dyn std::error::Error>> {
        let ipc = match &self.ipc_path {
            Some(p) => p.clone(),
            None => return Err("mpv non in esecuzione".into()),
        };

        let mut command_args = vec![Value::String(cmd.to_string())];
        command_args.extend_from_slice(args);
        let payload = serde_json::json!({ "command": command_args });
        let msg = format!("{}\n", payload.to_string());

        #[cfg(target_os = "windows")]
        {
            use std::fs::OpenOptions;
            let mut f = OpenOptions::new().read(true).write(true).open(&ipc)?;
            f.write_all(msg.as_bytes())?;
            f.flush()?;
            let mut response = String::new();
            BufReader::new(f).read_line(&mut response)?;
            let v: Value = serde_json::from_str(&response).unwrap_or(Value::Null);
            return Ok(v.get("data").cloned().unwrap_or(Value::Null));
        }

        #[cfg(not(target_os = "windows"))]
        {
            use std::os::unix::net::UnixStream;
            let stream = UnixStream::connect(&ipc)?;
            let mut writer = stream.try_clone()?;
            writer.write_all(msg.as_bytes())?;
            let mut response = String::new();
            BufReader::new(stream).read_line(&mut response)?;
            let v: Value = serde_json::from_str(&response).unwrap_or(Value::Null);
            return Ok(v.get("data").cloned().unwrap_or(Value::Null));
        }
    }

    pub fn get_position(&self) -> f64 {
        self.send_command("get_property", &[serde_json::json!("time-pos")])
            .map(|v| v.as_f64().unwrap_or(0.0))
            .unwrap_or(0.0)
    }

    pub fn get_duration(&self) -> f64 {
        self.send_command("get_property", &[serde_json::json!("duration")])
            .map(|v| v.as_f64().unwrap_or(0.0))
            .unwrap_or(0.0)
    }

    pub fn stop(&mut self) {
        if let Some(ref _ipc) = self.ipc_path {
            let _ = self.send_command("quit", &[]);
        }
        if let Some(mut child) = self.process.take() {
            std::thread::sleep(std::time::Duration::from_millis(200));
            let _ = child.kill();
        }
        self.ipc_path = None;
    }
}
