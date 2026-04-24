use std::sync::{Arc, Mutex};
use tokio::sync::Mutex as TokioMutex;
use crate::plugin::scraper::{ScraperManager, StreamResult};
use crate::plugin::repository::RepositoryManager;

pub struct PluginRuntime {
    pub scraper_manager: Arc<Mutex<ScraperManager>>,
    pub repository_manager: Arc<TokioMutex<RepositoryManager>>,
    enabled: Mutex<bool>,
}

impl PluginRuntime {
    pub fn new(app_handle: &tauri::AppHandle) -> Self {
        eprintln!("[PluginRuntime] Initializing...");
        let instance = Self {
            scraper_manager: Arc::new(Mutex::new(ScraperManager::new(app_handle))),
            repository_manager: Arc::new(TokioMutex::new(RepositoryManager::new(app_handle))),
            enabled: Mutex::new(true),
        };
        let count = instance.scraper_manager.lock().unwrap().get_scrapers().len();
        eprintln!("[PluginRuntime] Initialized with {} scrapers", count);
        instance
    }

    pub fn is_enabled(&self) -> bool {
        *self.enabled.lock().unwrap()
    }

    pub fn set_enabled(&self, enabled: bool) {
        *self.enabled.lock().unwrap() = enabled;
    }

    pub fn reload_scrapers(&self) {
        eprintln!("[PluginRuntime] reload_scrapers called");
        let mut manager = self.scraper_manager.lock().unwrap();
        manager.reload();
        eprintln!("[PluginRuntime] Scrapers reloaded: {} found", manager.get_scrapers().len());
    }

    pub async fn get_streams(
        &self,
        media_type: &str,
        tmdb_id: &str,
        season: Option<u32>,
        episode: Option<u32>,
    ) -> Vec<StreamResult> {
        eprintln!(
            "[PluginRuntime] get_streams: media_type={}, tmdb_id={}, season={:?}, episode={:?}",
            media_type, tmdb_id, season, episode
        );

        if !self.is_enabled() {
            eprintln!("[PluginRuntime] Plugins disabled");
            return vec![];
        }

        // Snapshot scrapers (brief lock, then released)
        let scrapers = self.scraper_manager.lock().unwrap().get_scrapers();

        let mut all_streams = vec![];

        for scraper in scrapers {
            if !scraper.enabled {
                continue;
            }

            let normalized_type = match media_type {
                "series" | "other" => "tv",
                other => other,
            }
            .to_string();

            let scraper_id    = scraper.id.clone();
            let scraper_name  = scraper.name.clone();
            let tmdb_clone    = tmdb_id.to_string();
            let manager_arc   = self.scraper_manager.clone();

            // ONE spawn_blocking per scraper — calls execute_scraper_sync (pure sync, no tokio inside)
            let result = tokio::task::spawn_blocking(move || {
                let manager = manager_arc.lock().unwrap();
                manager.execute_scraper_sync(
                    &scraper_id,
                    &normalized_type,
                    &tmdb_clone,
                    season,
                    episode,
                )
            })
            .await;

            match result {
                Ok(Ok(streams)) => {
                    eprintln!(
                        "[PluginRuntime] Scraper {} → {} streams",
                        scraper_name,
                        streams.len()
                    );
                    all_streams.extend(streams);
                }
                Ok(Err(e)) => {
                    eprintln!("[PluginRuntime] Scraper {} failed: {}", scraper_name, e);
                }
                Err(e) => {
                    eprintln!("[PluginRuntime] Scraper {} panicked: {}", scraper_name, e);
                }
            }
        }

        eprintln!("[PluginRuntime] Total streams: {}", all_streams.len());
        all_streams
    }

    pub async fn test_scraper(
        &self,
        scraper_id: &str,
    ) -> Result<(Vec<StreamResult>, Vec<String>), String> {
        eprintln!("[PluginRuntime] test_scraper: {}", scraper_id);

        let id  = scraper_id.to_string();
        let arc = self.scraper_manager.clone();

        let result = tokio::task::spawn_blocking(move || {
            let manager = arc.lock().unwrap();
            manager.execute_scraper_sync(&id, "movie", "tt1375666", None, None)
        })
        .await;

        match result {
            Ok(Ok(streams)) => {
                eprintln!("[PluginRuntime] test_scraper → {} streams", streams.len());
                Ok((streams, vec![]))
            }
            Ok(Err(e)) => Err(e),
            Err(e)     => Err(format!("Task panicked: {}", e)),
        }
    }
}