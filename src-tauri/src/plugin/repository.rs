use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::Manager;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepositoryInfo {
    pub id: String,
    pub name: String,
    pub url: String,
    pub description: Option<String>,
    pub enabled: bool,
    pub last_updated: u64,
    pub scraper_count: usize,
}

#[derive(Debug, Deserialize)]
struct Manifest {
    name: String,
    #[allow(dead_code)]
    version: String,
    description: Option<String>,
    #[allow(dead_code)]
    author: Option<String>,
    scrapers: Vec<ManifestScraper>,
}

#[derive(Debug, Deserialize)]
struct ManifestScraper {
    id: String,
    name: String,
    description: Option<String>,
    version: String,
    filename: String,
    #[serde(default)]
    supported_types: Vec<String>,
    #[serde(default)]
    enabled: bool,
    #[serde(default)]
    logo: Option<String>,
    #[serde(default)]
    content_language: Vec<String>,
}

pub struct RepositoryManager {
    repositories: HashMap<String, RepositoryInfo>,
    storage_path: PathBuf,
    #[allow(dead_code)]
    app_handle: tauri::AppHandle,
}

impl RepositoryManager {
    pub fn new(app_handle: &tauri::AppHandle) -> Self {
        let storage_path = app_handle
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."));

        // Crea la cartella se non esiste (necessario sia in dev che nel .exe)
        if !storage_path.exists() {
            let _ = std::fs::create_dir_all(&storage_path);
        }

        let mut manager = Self {
            repositories: HashMap::new(),
            storage_path,
            app_handle: app_handle.clone(),
        };
        let _ = manager.load_repositories();
        manager
    }

    /// Normalizza l'URL base: rimuove slash finale e /manifest.json se presenti
    fn normalize_base_url(url: &str) -> String {
        let url = url.trim_end_matches('/');
        let url = url.trim_end_matches("/manifest.json");
        url.to_string()
    }

    pub async fn add_repository(&mut self, url: String) -> Result<RepositoryInfo, String> {
        let base_url = Self::normalize_base_url(&url);
        let manifest_url = format!("{}/manifest.json", base_url);

        eprintln!("[Plugin] Fetching manifest from: {}", manifest_url);

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        let response = client
            .get(&manifest_url)
            .header("User-Agent", "Nuvio-Desktop/2.0")
            .send()
            .await
            .map_err(|e| format!("Failed to fetch manifest: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP {} — {}", response.status(), manifest_url));
        }

        let manifest: Manifest = response
            .json()
            .await
            .map_err(|e| format!("Invalid manifest JSON: {}", e))?;

        let id = format!("repo_{}", Utc::now().timestamp());
        let repo = RepositoryInfo {
            id: id.clone(),
            name: manifest.name,
            url: base_url.clone(),
            description: manifest.description,
            enabled: true,
            last_updated: Utc::now().timestamp() as u64,
            scraper_count: manifest.scrapers.len(),
        };

        for scraper in &manifest.scrapers {
            self.download_scraper(&base_url, scraper, &id).await?;
        }

        self.repositories.insert(id.clone(), repo.clone());
        self.save_repositories()?;

        Ok(repo)
    }

    async fn download_scraper(
        &self,
        repo_url: &str,
        scraper: &ManifestScraper,
        repo_id: &str,
    ) -> Result<(), String> {
        let scraper_url = format!("{}/{}", repo_url, scraper.filename);
        eprintln!(
            "[Plugin] Downloading scraper: {} from {}",
            scraper.name, scraper_url
        );

        // Assicurati che la cartella esista prima di scrivere
        if !self.storage_path.exists() {
            std::fs::create_dir_all(&self.storage_path)
                .map_err(|e| format!("Failed to create storage dir: {}", e))?;
        }

        let client = reqwest::Client::new();
        let code = client
            .get(&scraper_url)
            .header("User-Agent", "Nuvio-Desktop/2.0")
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await
            .map_err(|e| format!("Failed to download scraper {}: {}", scraper.name, e))?
            .text()
            .await
            .map_err(|e| format!("Failed to read scraper code: {}", e))?;

        // Salva codice JS
        let scraper_path = self
            .storage_path
            .join(format!("scraper_{}.js", scraper.id));
        std::fs::write(&scraper_path, &code)
            .map_err(|e| format!("Failed to save scraper: {}", e))?;

        // Salva metadati
        let meta = serde_json::json!({
            "id": scraper.id,
            "name": scraper.name,
            "description": scraper.description.clone().unwrap_or_default(),
            "version": scraper.version,
            "filename": scraper.filename,
            "supported_types": scraper.supported_types,
            "enabled": true,
            "manifest_enabled": scraper.enabled,
            "logo": scraper.logo,
            "content_language": scraper.content_language,
            "repository_id": repo_id,
        });

        let meta_path = self
            .storage_path
            .join(format!("scraper_{}.meta.json", scraper.id));
        std::fs::write(
            meta_path,
            serde_json::to_string_pretty(&meta).unwrap(),
        )
        .map_err(|e| format!("Failed to save scraper metadata: {}", e))?;

        Ok(())
    }

    pub fn get_repositories(&self) -> Vec<RepositoryInfo> {
        self.repositories.values().cloned().collect()
    }

    pub fn remove_repository(&mut self, repo_id: &str) -> Result<(), String> {
        if let Some(repo) = self.repositories.remove(repo_id) {
            eprintln!("[Plugin] Removing repository: {}", repo.name);
        }
        self.save_repositories()?;
        Ok(())
    }

    pub async fn refresh_repository(&mut self, repo_id: &str) -> Result<(), String> {
        let (repo_url, repo_id_owned) = {
            let repo = self
                .repositories
                .get(repo_id)
                .ok_or_else(|| format!("Repository not found: {}", repo_id))?;
            (repo.url.clone(), repo.id.clone())
        };

        let manifest_url = format!("{}/manifest.json", repo_url);
        let client = reqwest::Client::new();
        let response = client
            .get(&manifest_url)
            .header("User-Agent", "Nuvio-Desktop/2.0")
            .send()
            .await
            .map_err(|e| format!("Failed to fetch manifest: {}", e))?;

        let manifest: Manifest = response
            .json()
            .await
            .map_err(|e| format!("Invalid manifest: {}", e))?;

        for scraper in &manifest.scrapers {
            self.download_scraper(&repo_url, scraper, &repo_id_owned)
                .await?;
        }

        // Aggiorna last_updated e scraper_count
        if let Some(repo) = self.repositories.get_mut(repo_id) {
            repo.last_updated = Utc::now().timestamp() as u64;
            repo.scraper_count = manifest.scrapers.len();
        }
        self.save_repositories()?;

        Ok(())
    }

    fn save_repositories(&self) -> Result<(), String> {
        if !self.storage_path.exists() {
            std::fs::create_dir_all(&self.storage_path)
                .map_err(|e| format!("Failed to create storage dir: {}", e))?;
        }
        let path = self.storage_path.join("repositories.json");
        let data = serde_json::to_string_pretty(&self.repositories)
            .map_err(|e| format!("Failed to serialize repositories: {}", e))?;
        std::fs::write(path, data)
            .map_err(|e| format!("Failed to save repositories: {}", e))?;
        Ok(())
    }

    fn load_repositories(&mut self) -> Result<(), String> {
        let path = self.storage_path.join("repositories.json");
        if path.exists() {
            let data = std::fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read repositories: {}", e))?;
            self.repositories = serde_json::from_str(&data)
                .map_err(|e| format!("Failed to parse repositories: {}", e))?;
        }
        Ok(())
    }
}