use ffmpeg_next as ffmpeg;
use ffmpeg_next::format::{input, Pixel};
use ffmpeg_next::software::scaling::context::Context as ScalingContext;
use ffmpeg_next::util::frame::video::Video;
use std::sync::Arc;
use std::sync::Mutex;
use std::thread;
use tauri::Window;

pub struct NativeStreamer {
    window: Window,
    running: Arc<Mutex<bool>>,
}

impl NativeStreamer {
    pub fn new(window: Window) -> Self {
        ffmpeg::init().unwrap();
        Self {
            window,
            running: Arc::new(Mutex::new(false)),
        }
    }
    
    pub fn play(&self, url: &str, referrer: Option<&str>) -> Result<(), String> {
        *self.running.lock().unwrap() = true;
        let running = self.running.clone();
        let window = self.window.clone();
        let url = url.to_string();
        let referrer = referrer.map(|s| s.to_string());
        
        thread::spawn(move || {
            // Costruisci headers HTTP
            let mut headers = vec![
                "Origin: https://supervideo.cc".to_string(),
                "Referer: https://supervideo.cc/".to_string(),
                "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36".to_string(),
                "Accept: */*".to_string(),
                "Accept-Language: it-IT,it;q=0.9,en;q=0.8".to_string(),
                "Connection: keep-alive".to_string(),
            ];
            
            if let Some(r) = referrer {
                headers.push(format!("Referer: {}", r));
            }
            
            let headers_str = headers.join("\r\n");
            
            // Apri input con headers
            let mut ictx = match input(&url) {
                Ok(ctx) => ctx,
                Err(e) => {
                    let _ = window.emit("streamer_error", format!("Errore apertura stream: {}", e));
                    return;
                }
            };
            
            // Trova stream video
            let input_stream = match ictx.streams().best(ffmpeg::media::Type::Video) {
                Some(stream) => stream,
                None => {
                    let _ = window.emit("streamer_error", "Nessuno stream video trovato");
                    return;
                }
            };
            
            let decoder = ffmpeg::codec::context::Context::from_parameters(input_stream.parameters())
                .decoder()
                .video()?;
            
            // Ottieni finestra Tauri
            let window_clone = window.clone();
            
            // Decodifica e invia frame
            let mut packets = ictx.packets();
            while *running.lock().unwrap() {
                if let Some((stream, packet)) = packets.next() {
                    if stream.index() == input_stream.index() {
                        if let Ok(mut frame) = decoder.decode(&packet) {
                            // Invia frame alla finestra
                            let _ = window_clone.emit("video_frame", frame.data().to_vec());
                        }
                    }
                }
            }
        });
        
        Ok(())
    }
    
    pub fn stop(&self) {
        *self.running.lock().unwrap() = false;
    }
}