use std::sync::Arc;
use tokio::sync::Mutex;
use crate::plugin::scraper::{ScraperManager, StreamResult};
use crate::plugin::repository::RepositoryManager;

pub struct PluginRuntime {
    pub scraper_manager: Arc<Mutex<ScraperManager>>,
    pub repository_manager: Arc<Mutex<RepositoryManager>>,
    enabled: Mutex<bool>,
}

impl PluginRuntime {
    pub fn new(app_handle: &tauri::AppHandle) -> Self {
        eprintln!("[PluginRuntime] Initializing...");
        let instance = Self {
            scraper_manager: Arc::new(Mutex::new(ScraperManager::new(app_handle))),
            repository_manager: Arc::new(Mutex::new(RepositoryManager::new(app_handle))),
            enabled: Mutex::new(true),
        };
        
        // blocking_lock() per contesti non async
        let count = instance.scraper_manager.blocking_lock().get_scrapers().len();
        eprintln!("[PluginRuntime] Initialized with {} scrapers", count);
        instance
    }

    pub async fn is_enabled(&self) -> bool {
        *self.enabled.lock().await
    }

    pub async fn set_enabled(&self, enabled: bool) {
        *self.enabled.lock().await = enabled;
    }

    pub async fn reload_scrapers(&self) {
        eprintln!("[PluginRuntime] reload_scrapers called");
        let mut manager = self.scraper_manager.lock().await;
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
        eprintln!("[PluginRuntime] get_streams: media_type={}, tmdb_id={}", media_type, tmdb_id);

        if !self.is_enabled().await {
            eprintln!("[PluginRuntime] Plugins disabled");
            return vec![];
        }

        let normalized_type = match media_type {
            "series" | "other" => "tv",
            other => other,
        }.to_string();

        let scrapers: Vec<_> = {
            let manager = self.scraper_manager.lock().await;
            manager.get_scrapers().into_iter().filter(|s| s.enabled).collect()
        };

        eprintln!("[PluginRuntime] Running {} enabled scrapers", scrapers.len());

        let mut tasks = vec![];

        for scraper in scrapers {
            let scraper_id = scraper.id.clone();
            let scraper_name = scraper.name.clone();
            let tmdb_clone = tmdb_id.to_string();
            let mtype_clone = normalized_type.clone();
            let manager_arc = self.scraper_manager.clone();
            let season_clone = season;
            let episode_clone = episode;

            let task = tokio::task::spawn_blocking(move || {
                let manager = manager_arc.blocking_lock();
                manager.execute_scraper_sync(
                    &scraper_id,
                    &mtype_clone,
                    &tmdb_clone,
                    season_clone,
                    episode_clone,
                )
            });
            tasks.push((scraper_name, task));
        }

        let mut all_streams = vec![];
        for (name, task) in tasks {
            match task.await {
                Ok(Ok(streams)) => {
                    eprintln!("[PluginRuntime] Scraper {} → {} streams", name, streams.len());
                    all_streams.extend(streams);
                }
                Ok(Err(e)) => eprintln!("[PluginRuntime] Scraper {} failed: {}", name, e),
                Err(e) => eprintln!("[PluginRuntime] Scraper {} panicked: {}", name, e),
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

        let scraper_id_clone = scraper_id.to_string();
        let manager_arc = self.scraper_manager.clone();

        let result = tokio::task::spawn_blocking(move || {
            let manager = manager_arc.blocking_lock();
            manager.execute_scraper_sync(&scraper_id_clone, "movie", "tt1375666", None, None)
        }).await;

        match result {
            Ok(Ok(streams)) => {
                eprintln!("[PluginRuntime] test_scraper → {} streams", streams.len());
                Ok((streams, vec![]))
            }
            Ok(Err(e)) => Err(e),
            Err(e) => Err(format!("Task panicked: {}", e)),
        }
    }
}