use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::path::PathBuf;
use rquickjs::{Runtime, Context, Value, Function};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScraperInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub filename: String,
    pub supported_types: Vec<String>,
    pub enabled: bool,
    pub manifest_enabled: bool,
    pub logo: Option<String>,
    pub content_language: Vec<String>,
    pub repository_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct StreamResult {
    pub name: Option<String>,
    pub title: Option<String>,
    pub url: String,
    pub quality: Option<String>,
    pub size: Option<String>,
    pub info_hash: Option<String>,
    pub file_idx: Option<u32>,
    pub headers: Option<HashMap<String, String>>,
}

#[derive(Clone)]
pub struct ScraperManager {
    scrapers: HashMap<String, ScraperInfo>,
    storage_path: PathBuf,
}

impl ScraperManager {
    pub fn new(app_handle: &tauri::AppHandle) -> Self {
        let storage_path = app_handle
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        if !storage_path.exists() {
            let _ = std::fs::create_dir_all(&storage_path);
        }
        let mut manager = Self { scrapers: HashMap::new(), storage_path };
        let _ = manager.load_scrapers();
        manager
    }

    pub fn get_scrapers(&self) -> Vec<ScraperInfo> {
        self.scrapers.values().cloned().collect()
    }

    pub fn reload(&mut self) {
        self.scrapers.clear();
        let _ = self.load_scrapers();
    }

    pub fn set_scraper_enabled(&mut self, scraper_id: &str, enabled: bool) -> Result<(), String> {
        if let Some(scraper) = self.scrapers.get_mut(scraper_id) {
            scraper.enabled = enabled;
            
            let meta_path = self.storage_path.join(format!("scraper_{}.meta.json", scraper_id));
            if let Ok(data) = std::fs::read_to_string(&meta_path) {
                if let Ok(mut json) = serde_json::from_str::<serde_json::Value>(&data) {
                    json["enabled"] = serde_json::Value::Bool(enabled);
                    let _ = std::fs::write(&meta_path, serde_json::to_string_pretty(&json).unwrap_or(data));
                }
            }
            Ok(())
        } else {
            Err(format!("Scraper not found: {}", scraper_id))
        }
    }

    /// Esecuzione SINCRONA dello scraper JS - chiamare da spawn_blocking
    pub fn execute_scraper_sync(
        &self,
        scraper_id: &str,
        media_type: &str,
        tmdb_id: &str,
        season: Option<u32>,
        episode: Option<u32>,
    ) -> Result<Vec<StreamResult>, String> {
        let scraper = self.scrapers.get(scraper_id)
            .ok_or_else(|| format!("Scraper not found: {}", scraper_id))?;
        
        if !scraper.enabled {
            return Ok(vec![]);
        }

        let code_path = self.storage_path.join(format!("scraper_{}.js", scraper.id));
        let code = std::fs::read_to_string(&code_path)
            .map_err(|e| format!("Failed to read scraper JS: {}", e))?;

        let scraper_id_str = scraper_id.to_string();
        let tmdb_id = tmdb_id.to_string();
        let media_type = media_type.to_string();

        let rt = Runtime::new().map_err(|e| format!("JS Runtime error: {}", e))?;
        let ctx = Context::full(&rt).map_err(|e| format!("JS Context error: {}", e))?;

        ctx.with(|ctx| -> Result<Vec<StreamResult>, String> {
            let globals = ctx.globals();

            // Polyfill minimale per console
            ctx.eval::<(), _>(r#"
                globalThis.console = {
                    log: function(...args) { 
                        var msg = args.map(function(a) { return String(a); }).join(' ');
                        if (globalThis.__consoleLog) globalThis.__consoleLog(msg);
                    },
                    error: function(...args) { 
                        var msg = '[ERR] ' + args.map(function(a) { return String(a); }).join(' ');
                        if (globalThis.__consoleLog) globalThis.__consoleLog(msg);
                    },
                    warn: function(...args) { 
                        var msg = '[WARN] ' + args.map(function(a) { return String(a); }).join(' ');
                        if (globalThis.__consoleLog) globalThis.__consoleLog(msg);
                    }
                };
                globalThis.__nuvio_result = undefined;
                globalThis.__nuvio_done = false;
                globalThis.__nuvio_error = null;
            "#).map_err(|e| format!("Init error: {}", e))?;

            // __consoleLog bridge
            let sid = scraper_id_str.clone();
            let log_fn = Function::new(ctx.clone(), move |msg: String| -> rquickjs::Result<()> {
                eprintln!("[Scraper {}] {}", sid, msg);
                Ok(())
            }).map_err(|e| format!("log fn: {}", e))?;
            globals.set("__consoleLog", log_fn).map_err(|e| format!("set __consoleLog: {}", e))?;

            // __fetchSync - chiamata HTTP sincrona
            let fetch_fn = Function::new(ctx.clone(), |url: String| -> rquickjs::Result<String> {
                let client = reqwest::blocking::Client::builder()
                    .timeout(std::time::Duration::from_secs(30))
                    .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                    .build()
                    .map_err(|_| rquickjs::Error::Exception)?;

                match client.get(&url).send() {
                    Ok(resp) => {
                        let status = resp.status().as_u16();
                        let ok = status >= 200 && status < 300;
                        let body = resp.text().unwrap_or_default();
                        Ok(format!(r#"{{"status":{},"ok":{},"body":{}}}"#,
                            status, ok,
                            serde_json::to_string(&body).unwrap_or_else(|_| "\"\"".to_string())))
                    }
                    Err(e) => Ok(format!(r#"{{"status":0,"ok":false,"body":"","error":"{}"}}"#, e))
                }
            }).map_err(|e| format!("fetch fn: {}", e))?;
            globals.set("__fetchSync", fetch_fn).map_err(|e| format!("set __fetchSync: {}", e))?;

            // fetch polyfill
            ctx.eval::<(), _>(r#"
                globalThis.fetch = function(url, options) {
                    try {
                        var raw = __fetchSync(typeof url === 'string' ? url : String(url));
                        var data = JSON.parse(raw);
                        return Promise.resolve({
                            ok: data.ok,
                            status: data.status,
                            statusText: data.ok ? 'OK' : 'Error',
                            text: function() { return Promise.resolve(data.body); },
                            json: function() { return Promise.resolve(JSON.parse(data.body)); }
                        });
                    } catch(e) {
                        return Promise.reject(e);
                    }
                };
            "#).map_err(|e| format!("Fetch polyfill error: {}", e))?;

            // Esegui lo scraper
            eprintln!("[Scraper {}] Evaluating JS...", scraper_id_str);
            match ctx.eval::<(), _>(code.as_str()) {
                Ok(_) => eprintln!("[Scraper {}] JS evaluated OK", scraper_id_str),
                Err(e) => {
                    let msg = format!("{:?}", e);
                    eprintln!("[Scraper {}] JS eval error: {}", scraper_id_str, msg);
                    return Err(format!("Scraper eval error: {}", msg));
                }
            }

            // Chiama getStreams
            let season_js = season.map(|s| s.to_string()).unwrap_or_else(|| "undefined".into());
            let episode_js = episode.map(|e| e.to_string()).unwrap_or_else(|| "undefined".into());
            let tmdb_json = serde_json::to_string(&tmdb_id).unwrap_or_default();
            let mtype_json = serde_json::to_string(&media_type).unwrap_or_default();

            let call_code = format!(r#"
                (function() {{
                    try {{
                        var fn = null;
                        if (typeof getStreams === 'function') {{
                            fn = getStreams;
                        }} else if (typeof module !== 'undefined' && module && module.exports) {{
                            if (typeof module.exports.getStreams === 'function') fn = module.exports.getStreams;
                            else if (typeof module.exports.default === 'function') fn = module.exports.default;
                        }} else if (typeof exports !== 'undefined') {{
                            if (typeof exports.getStreams === 'function') fn = exports.getStreams;
                            else if (typeof exports.default === 'function') fn = exports.default;
                        }}
                        if (!fn) {{
                            globalThis.__nuvio_error = 'getStreams not found';
                            globalThis.__nuvio_done = true;
                            return;
                        }}
                        Promise.resolve(fn({tmdb}, {mtype}, {season}, {episode}))
                            .then(function(r) {{
                                globalThis.__nuvio_result = Array.isArray(r) ? r : [];
                                globalThis.__nuvio_done = true;
                            }})
                            .catch(function(e) {{
                                globalThis.__nuvio_error = String(e);
                                globalThis.__nuvio_done = true;
                            }});
                    }} catch(e) {{
                        globalThis.__nuvio_error = String(e);
                        globalThis.__nuvio_done = true;
                    }}
                }})();
            "#,
                tmdb = tmdb_json,
                mtype = mtype_json,
                season = season_js,
                episode = episode_js,
            );

            ctx.eval::<(), _>(call_code.as_str()).map_err(|e| format!("Call error: {}", e))?;

            // Drive event loop con timeout
            for _ in 0..50_000 {
                match rt.execute_pending_job() {
                    Ok(true) => continue,
                    Ok(false) => break,
                    Err(_) => break,
                }
            }

            let js_err: Option<String> = globals.get("__nuvio_error").ok().flatten();
            if let Some(err) = js_err {
                eprintln!("[Scraper {}] JS error: {}", scraper_id_str, err);
                return Ok(vec![]);
            }

            let result_val: Value = globals.get("__nuvio_result")
                .map_err(|e| format!("Failed to read result: {}", e))?;
            let streams = parse_stream_array(result_val);
            eprintln!("[Scraper {}] Found {} streams", scraper_id_str, streams.len());
            Ok(streams)
        })
    }

    fn load_scrapers(&mut self) -> Result<(), String> {
        let entries = match std::fs::read_dir(&self.storage_path) {
            Ok(e) => e,
            Err(_) => return Ok(()),
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if !filename.starts_with("scraper_") || !filename.ends_with(".meta.json") {
                continue;
            }
            match std::fs::read_to_string(&path) {
                Ok(data) => match serde_json::from_str::<ScraperInfo>(&data) {
                    Ok(scraper) => { self.scrapers.insert(scraper.id.clone(), scraper); }
                    Err(e) => eprintln!("[ScraperManager] Parse error {}: {}", filename, e),
                },
                Err(e) => eprintln!("[ScraperManager] Read error {}: {}", filename, e),
            }
        }
        eprintln!("[ScraperManager] Loaded {} scrapers", self.scrapers.len());
        Ok(())
    }
}

fn parse_stream_array(value: Value) -> Vec<StreamResult> {
    let mut streams = Vec::new();
    let arr = match value.as_array() {
        Some(a) => a,
        None => return streams,
    };
    for item in arr.iter::<Value>().filter_map(|v| v.ok()) {
        let obj = match item.as_object() {
            Some(o) => o,
            None => continue,
        };
        let url: String = match obj.get("url") {
            Ok(u) => u,
            Err(_) => continue,
        };
        if url.is_empty() { continue; }
        streams.push(StreamResult {
            name: obj.get("name").ok(),
            title: obj.get("title").ok(),
            url,
            quality: obj.get("quality").ok(),
            size: obj.get("size").ok(),
            info_hash: obj.get("infoHash").ok(),
            file_idx: obj.get("fileIdx").ok(),
            headers: obj.get("headers").ok(),
        });
    }
    streams
}