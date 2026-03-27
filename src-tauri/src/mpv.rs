use anyhow::{anyhow, Result};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command};

#[cfg(target_os = "windows")]
const IPC_PATH: &str = r"\\.\pipe\nuvio-mpv";

#[cfg(not(target_os = "windows"))]
const IPC_PATH: &str = "/tmp/nuvio-mpv.sock";

pub struct MpvManager {
    process: Option<Child>,
}

impl MpvManager {
    pub fn new() -> Self {
        Self { process: None }
    }

    /// Risolve il path di mpv: prima cerca il binario bundled (sidecar),
    /// poi cade back sul PATH di sistema se l'utente lo ha installato.
    fn mpv_path() -> PathBuf {
        // Tauri mette i sidecar nella stessa cartella dell'eseguibile
        if let Ok(exe) = std::env::current_exe() {
            let bundled = exe
                .parent()
                .unwrap_or_else(|| std::path::Path::new("."))
                .join("mpv.exe");

            if bundled.exists() {
                return bundled;
            }
        }
        // Fallback: cerca nel PATH
        PathBuf::from("mpv")
    }

    pub fn launch(&mut self, url: &str, title: Option<&str>) -> Result<()> {
        self.kill_existing();

        let mpv = Self::mpv_path();

        let mut cmd = Command::new(&mpv);
        cmd.arg(url)
            .arg(format!("--input-ipc-server={}", IPC_PATH))
            .arg("--force-window=yes")
            .arg("--keep-open=yes")
            .arg("--osc=yes")
            .arg("--hwdec=auto")
            .arg("--no-terminal");

        if let Some(t) = title {
            cmd.arg(format!("--title=Nuvio – {}", t));
        }

        let child = cmd.spawn().map_err(|e| {
            anyhow!(
                "Impossibile avviare mpv ({}): {}",
                mpv.display(),
                e
            )
        })?;

        self.process = Some(child);
        Ok(())
    }

    pub fn send_command(&self, cmd: &str, args: &[serde_json::Value]) -> Result<()> {
        use std::fs::OpenOptions;

        let mut parts: Vec<serde_json::Value> =
            vec![serde_json::Value::String(cmd.to_string())];
        parts.extend_from_slice(args);

        let payload = serde_json::json!({ "command": parts });
        let mut line = serde_json::to_string(&payload)?;
        line.push('\n');

        let mut pipe = OpenOptions::new()
            .write(true)
            .open(IPC_PATH)
            .map_err(|e| anyhow!("IPC non disponibile (mpv in esecuzione?): {}", e))?;

        pipe.write_all(line.as_bytes())?;
        Ok(())
    }

    pub fn stop(&mut self) {
        let _ = self.send_command("quit", &[]);
        self.kill_existing();
    }

    fn kill_existing(&mut self) {
        if let Some(mut child) = self.process.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl Drop for MpvManager {
    fn drop(&mut self) {
        self.kill_existing();
    }
}
