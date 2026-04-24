use libmpv::{Mpv, MpvNode};

pub struct MpvPlayer {
    mpv: Mpv,
    initialized: bool,
}

impl MpvPlayer {
    pub fn new() -> Result<Self, String> {
        let mpv = Mpv::new()
            .map_err(|e| format!("Impossibile creare mpv: {}", e))?;
        
        Ok(Self {
            mpv,
            initialized: false,
        })
    }
    
    pub fn init(&mut self, width: u32, height: u32) -> Result<(), String> {
        // Configura opzioni mpv usando set_property invece di set_option_string
        // Per i magnet è necessario
        let _ = self.mpv.set_property("vo", "gpu");
        let _ = self.mpv.set_property("gpu-hwdec-interop", "auto");
        let _ = self.mpv.set_property("cache-default", 15000);
        let _ = self.mpv.set_property("cache-backbuffer", 15000);
        let _ = self.mpv.set_property("cache-secs", 10);
        let _ = self.mpv.set_property("keep-open", "yes");
        let _ = self.mpv.set_property("terminal", "yes");
        let _ = self.mpv.set_property("msg-level", "all=v");
        let _ = self.mpv.set_property("audio-fallback-to-null", "yes");
        let _ = self.mpv.set_property("no-osc", "");
        let _ = self.mpv.set_property("no-input-default-bindings", "");
        let _ = self.mpv.set_property("no-osd-bar", "");
        
        // Inizializzazione esplicita - chiamando un comando qualsiasi
        // libmpv-rs non ha init() esplicito, usa set_property/get_property
        
        self.initialized = true;
        eprintln!("[libmpv] Inizializzato {}x{}", width, height);
        
        Ok(())
    }
    
    pub fn load_url(&mut self, url: &str, referer: Option<&str>) -> Result<(), String> {
        if !self.initialized {
            return Err("Player non inizializzato".to_string());
        }
        
        // Imposta referer se fornito
        if let Some(r) = referer {
            let header = format!("Referer: {}", r);
            let _ = self.mpv.set_property("http-header-fields", &header);
        }
        
        // Carica URL
        self.mpv.command("loadfile", &[url, "replace"])
            .map_err(|e| format!("Impossibile caricare URL: {}", e))?;
        
        eprintln!("[libmpv] Caricato URL: {}", url);
        Ok(())
    }
    
    pub fn load_magnet(&mut self, magnet: &str) -> Result<(), String> {
        if !self.initialized {
            return Err("Player non inizializzato".to_string());
        }
        
        self.mpv.command("loadfile", &[magnet, "replace"])
            .map_err(|e| format!("Impossibile caricare magnet: {}", e))?;
        
        eprintln!("[libmpv] Caricato magnet");
        Ok(())
    }
    
    pub fn play(&mut self) -> Result<(), String> {
        self.mpv.set_property("pause", false)
            .map_err(|e| format!("Impossibile riprodurre: {}", e))?;
        Ok(())
    }
    
    pub fn pause(&mut self) -> Result<(), String> {
        self.mpv.set_property("pause", true)
            .map_err(|e| format!("Impossibile mettere in pausa: {}", e))?;
        Ok(())
    }
    
    pub fn toggle_pause(&mut self) -> Result<bool, String> {
        let is_paused: bool = self.mpv.get_property("pause")
            .map_err(|e| format!("Impossibile ottenere stato: {}", e))?;
        let new_state = !is_paused;
        self.mpv.set_property("pause", new_state)
            .map_err(|e| format!("Impossibile cambiare stato: {}", e))?;
        Ok(new_state)
    }
    
    pub fn seek(&mut self, seconds: f64) -> Result<(), String> {
        self.mpv.command("seek", &[&seconds.to_string(), "absolute"])
            .map_err(|e| format!("Impossibile cercare: {}", e))?;
        Ok(())
    }
    
    pub fn set_volume(&mut self, volume: i64) -> Result<(), String> {
        self.mpv.set_property("volume", volume)
            .map_err(|e| format!("Impossibile impostare volume: {}", e))?;
        Ok(())
    }
    
    pub fn get_volume(&self) -> Result<i64, String> {
        let volume: i64 = self.mpv.get_property("volume")
            .map_err(|e| format!("Impossibile ottenere volume: {}", e))?;
        Ok(volume)
    }
    
    pub fn set_speed(&mut self, speed: f64) -> Result<(), String> {
        self.mpv.set_property("speed", speed)
            .map_err(|e| format!("Impossibile impostare velocità: {}", e))?;
        Ok(())
    }
    
    pub fn get_time_pos(&self) -> Result<f64, String> {
        let pos: f64 = self.mpv.get_property("time-pos")
            .map_err(|e| format!("Impossibile ottenere posizione: {}", e))?;
        Ok(pos)
    }
    
    pub fn get_duration(&self) -> Result<f64, String> {
        let dur: f64 = self.mpv.get_property("duration")
            .map_err(|e| format!("Impossibile ottenere durata: {}", e))?;
        Ok(dur)
    }
    
    pub fn get_percent_pos(&self) -> Result<f64, String> {
        let percent: f64 = self.mpv.get_property("percent-pos")
            .map_err(|e| format!("Impossibile ottenere percentuale: {}", e))?;
        Ok(percent)
    }
    
    pub fn set_audio_track(&mut self, track_id: i64) -> Result<(), String> {
        self.mpv.set_property("aid", track_id)
            .map_err(|e| format!("Impossibile cambiare traccia audio: {}", e))?;
        Ok(())
    }
    
    pub fn set_subtitle_track(&mut self, track_id: i64) -> Result<(), String> {
        self.mpv.set_property("sid", track_id)
            .map_err(|e| format!("Impossibile cambiare sottotitolo: {}", e))?;
        Ok(())
    }
    
    pub fn get_audio_tracks(&self) -> Result<serde_json::Value, String> {
        let tracks: MpvNode = self.mpv.get_property("track-list")
            .map_err(|e| format!("Impossibile ottenere tracce: {}", e))?;
        
        // Converti MpvNode in JsonValue semplificato
        Ok(serde_json::json!({ "tracks": format!("{:?}", tracks) }))
    }
    
    pub fn shutdown(&mut self) -> Result<(), String> {
        if self.initialized {
            let _ = self.mpv.command("quit", &[] as &[&str]);
            self.initialized = false;
        }
        Ok(())
    }
    
    pub fn resize(&mut self, _width: u32, _height: u32) -> Result<(), String> {
        eprintln!("[libmpv] Resize richiesto");
        Ok(())
    }
}

impl Drop for MpvPlayer {
    fn drop(&mut self) {
        let _ = self.shutdown();
    }
}