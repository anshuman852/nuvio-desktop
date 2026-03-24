use anyhow::{anyhow, Result};
use std::io::Write;
use std::process::{Child, Command};

/// Named pipe usata per IPC con mpv su Windows.
/// Su Linux/macOS si userebbe un socket Unix (es. /tmp/mpvsocket).
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

    /// Avvia mpv con un dato URL e titolo opzionale.
    /// Uccide eventuale istanza precedente.
    pub fn launch(&mut self, url: &str, title: Option<&str>) -> Result<()> {
        self.kill_existing();

        let mut cmd = Command::new("mpv");

        cmd.arg(url)
            // IPC server per controllo remoto
            .arg(format!("--input-ipc-server={}", IPC_PATH))
            // UI / esperienza
            .arg("--force-window=yes")
            .arg("--keep-open=yes")
            .arg("--osc=yes")
            // Hardware decoding automatico
            .arg("--hwdec=auto")
            // Nasconde la console su Windows
            .arg("--no-terminal");

        if let Some(t) = title {
            cmd.arg(format!("--title=Nuvio – {}", t));
        }

        let child = cmd.spawn().map_err(|e| {
            anyhow!(
                "Impossibile avviare mpv: {}. Assicurati che mpv sia installato e nel PATH.",
                e
            )
        })?;

        self.process = Some(child);
        Ok(())
    }

    /// Invia un comando JSON all'IPC di mpv (named pipe su Windows).
    /// Esempio: send_command("seek", &[json!(30), json!("relative")])
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

    /// Ferma la riproduzione e chiude mpv.
    pub fn stop(&mut self) {
        // Prima tenta via IPC (chiusura pulita)
        let _ = self.send_command("quit", &[]);
        // Poi forza il kill se ancora in vita
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
