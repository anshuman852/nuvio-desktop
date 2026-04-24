use std::process::{Child, Command};
use std::io::{Write, BufRead, BufReader};
use std::path::{Path, PathBuf};
use serde_json::Value;

pub struct MpvManager {
    pub process: Option<Child>,
    pub ipc_path: Option<String>,
}

impl MpvManager {
    pub fn new() -> Self {
        MpvManager {
            process: None,
            ipc_path: None,
        }
    }

    fn find_mpv_path(&self) -> Result<PathBuf, String> {
        Self::find_mpv()
    }

    fn find_mpv() -> Result<PathBuf, String> {
        eprintln!("[mpv] Cerca mpv.exe...");
        
        // 1. Cerca nella stessa cartella dell'eseguibile
        if let Ok(exe) = std::env::current_exe() {
            let dir = exe.parent().unwrap_or(Path::new("."));
            
            let candidate = dir.join("mpv.exe");
            if candidate.exists() {
                eprintln!("[mpv] Trovato in exe dir: {}", candidate.display());
                return Ok(candidate);
            }
            
            let candidate_res = dir.join("resources").join("mpv.exe");
            if candidate_res.exists() {
                eprintln!("[mpv] Trovato in resources dir: {}", candidate_res.display());
                return Ok(candidate_res);
            }
        }

        // 2. Cerca nella cartella di lavoro corrente
        let extra_paths = [
            PathBuf::from("mpv.exe"),
            PathBuf::from("resources/mpv.exe"),
            PathBuf::from("../resources/mpv.exe"),
            PathBuf::from("../../resources/mpv.exe"),
        ];
        for p in &extra_paths {
            if p.exists() {
                eprintln!("[mpv] Trovato in path relativo: {}", p.display());
                return Ok(p.clone());
            }
        }

        // 3. Cerca nel PATH di sistema
        if let Ok(out) = Command::new("where").arg("mpv.exe").output() {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout);
                if let Some(line) = s.lines().next() {
                    let path = PathBuf::from(line.trim());
                    if path.exists() {
                        eprintln!("[mpv] Trovato in PATH: {}", path.display());
                        return Ok(path);
                    }
                }
            }
        }

        // 4. Cerca in percorsi comuni di installazione
        let common_paths = [
            "C:\\Program Files\\mpv\\mpv.exe",
            "C:\\Program Files (x86)\\mpv\\mpv.exe",
            "C:\\mpv\\mpv.exe",
            "C:\\tools\\mpv\\mpv.exe",
            "C:\\Program Files\\mpv.net\\mpv.com",
            "C:\\Program Files\\mpv.net\\mpv.exe",
        ];
        for path_str in &common_paths {
            let candidate = PathBuf::from(path_str);
            if candidate.exists() {
                eprintln!("[mpv] Trovato in percorso comune: {}", candidate.display());
                return Ok(candidate);
            }
        }
        
        // 5. Cerca nella cartella LOCALAPPDATA
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let user_paths = [
                PathBuf::from(&local_app_data).join("nuvio-desktop").join("mpv.exe"),
                PathBuf::from(&local_app_data).join("nuvio-desktop").join("resources").join("mpv.exe"),
            ];
            for candidate in &user_paths {
                if candidate.exists() {
                    eprintln!("[mpv] Trovato in LOCALAPPDATA: {}", candidate.display());
                    return Ok(candidate.clone());
                }
            }
        }

        eprintln!("[mpv] mpv.exe NON TROVATO!");
        if let Ok(cwd) = std::env::current_dir() {
            eprintln!("[mpv] Current working directory: {}", cwd.display());
        }
        if let Ok(exe) = std::env::current_exe() {
            eprintln!("[mpv] Executable path: {}", exe.display());
        }
        
        Err("mpv.exe non trovato. Scarica mpv da https://mpv.io e mettilo nella cartella dell'app.".to_string())
    }

    fn ipc_name() -> String {
        format!(
            "\\\\.\\pipe\\nuvio-mpv-{}",
            std::process::id()
        )
    }

    fn base_args(url: &str, title: Option<&str>, ipc: &str) -> Vec<String> {
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
        args
    }

    pub fn launch_with_referrer(&mut self, url: &str, title: Option<&str>, referrer: Option<&str>) -> Result<(), String> {
        eprintln!("[mpv] launch_with_referrer: {}", url);
        
        self.stop();
        
        let mpv = Self::find_mpv()?;
        let ipc = Self::ipc_name();
        
        let mut args = Self::base_args(url, title, &ipc);
        args.push("--ontop=yes".to_string());
        args.push("--geometry=900x506+100+100".to_string());
        args.push("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36".to_string());
        args.push("--network-timeout=30".to_string());
        args.push("--cache=yes".to_string());
        args.push("--demuxer-max-bytes=150M".to_string());
        args.push("--hwdec=auto".to_string());
        
        if !url.starts_with("magnet:") {
            args.push("--ytdl=no".to_string());
        }
        
        if let Some(r) = referrer {
            args.push(format!("--referrer={}", r));
            eprintln!("[mpv] referrer={}", r);
        }
        
        eprintln!("[mpv] path={}", mpv.display());
        eprintln!("[mpv] args={:?}", args);
        
        let child = Command::new(&mpv)
            .args(&args)
            .spawn()
            .map_err(|e| format!("Impossibile avviare mpv: {}", e))?;
        
        self.process = Some(child);
        self.ipc_path = Some(ipc);
        
        std::thread::sleep(std::time::Duration::from_millis(500));
        
        eprintln!("[mpv] Avviato con successo");
        Ok(())
    }

    pub fn launch(&mut self, url: &str, title: Option<&str>) -> Result<(), String> {
        self.launch_with_referrer(url, title, None)
    }

    // NUOVO METODO: launch_embedded per integrare mpv dentro la finestra Tauri
    pub fn launch_embedded(&mut self, url: &str, title: &str, referrer: Option<&str>, hwnd: isize) -> Result<(), String> {
        eprintln!("[mpv] launch_embedded: {} with hwnd={}", url, hwnd);
        
        self.stop();
        
        let mpv = Self::find_mpv()?;
        let ipc = Self::ipc_name();
        
        let mut args = vec![
            format!("--wid={}", hwnd),
            url.to_string(),
            format!("--title={}", title),
            format!("--input-ipc-server={}", ipc),
            "--no-terminal".to_string(),
            "--keep-open=yes".to_string(),
            "--no-border".to_string(),
            "--no-window-dragging".to_string(),
            "--geometry=100%x100%".to_string(),
            "--autofit=100%x100%".to_string(),
            "--cache=yes".to_string(),
            "--cache-secs=120".to_string(),
            "--demuxer-max-bytes=150M".to_string(),
            "--demuxer-readahead-secs=10".to_string(),
            "--network-timeout=30".to_string(),
            "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36".to_string(),
            "--hwdec=auto".to_string(),
            "--no-osc".to_string(),              // Nasconde l'OSC di mpv
            "--no-input-default-bindings".to_string(), // Disabilita shortcut di default
            "--no-osd-bar".to_string(),          // Nasconde la barra OSD
        ];
        
        if !url.starts_with("magnet:") && !url.starts_with("http") {
            args.push("--ytdl=no".to_string());
        }
        
        if let Some(r) = referrer {
            args.push(format!("--referrer={}", r));
            eprintln!("[mpv] referrer={}", r);
        }
        
        eprintln!("[mpv] Embedded path={}", mpv.display());
        eprintln!("[mpv] Embedded args={:?}", args);
        
        let child = Command::new(&mpv)
            .args(&args)
            .spawn()
            .map_err(|e| format!("Impossibile avviare mpv embedded: {}", e))?;
        
        self.process = Some(child);
        self.ipc_path = Some(ipc);
        
        std::thread::sleep(std::time::Duration::from_millis(500));
        
        eprintln!("[mpv] Embedded avviato con successo");
        Ok(())
    }

    pub fn send_command(&self, cmd: &str, args: &[Value]) -> Result<Value, String> {
        let ipc = match &self.ipc_path {
            Some(p) => p.clone(),
            None => return Err("mpv non in esecuzione".to_string()),
        };
        
        let mut command_args = vec![Value::String(cmd.to_string())];
        command_args.extend_from_slice(args);
        let payload = serde_json::json!({ "command": command_args });
        let msg = format!("{}\n", payload.to_string());
        
        use std::fs::OpenOptions;
        
        // Apri la pipe con timeout
        let mut f = OpenOptions::new()
            .read(true)
            .write(true)
            .open(&ipc)
            .map_err(|e| format!("Impossibile aprire pipe: {}", e))?;
        
        f.write_all(msg.as_bytes())
            .map_err(|e| format!("Errore scrittura pipe: {}", e))?;
        f.flush()
            .map_err(|e| format!("Errore flush pipe: {}", e))?;
        
        let mut response = String::new();
        let mut reader = BufReader::new(&mut f);
        
        // Leggi con timeout implicito
        reader.read_line(&mut response)
            .map_err(|e| format!("Errore lettura pipe: {}", e))?;
        
        let v: Value = serde_json::from_str(&response).unwrap_or(Value::Null);
        
        // Controlla errori nella risposta
        if let Some(error) = v.get("error") {
            if error.as_str() != Some("success") {
                eprintln!("[mpv] Command error: {:?}", error);
            }
        }
        
        Ok(v.get("data").cloned().unwrap_or(Value::Null))
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
        eprintln!("[mpv] Stopping mpv...");
        
        // Prova a mandare il comando quit via IPC
        if let Some(ref _ipc) = self.ipc_path {
            let _ = self.send_command("quit", &[]);
        }
        
        // Uccidi il processo se ancora vivo
        if let Some(mut child) = self.process.take() {
            std::thread::sleep(std::time::Duration::from_millis(200));
            let _ = child.kill();
            let _ = child.wait();
        }
        
        self.ipc_path = None;
        eprintln!("[mpv] Stopped");
    }
}

impl Default for MpvManager {
    fn default() -> Self {
        Self::new()
    }
}