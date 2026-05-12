use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::Mutex;

/// Manages the Discord Rich Presence IPC connection.
/// Thread-safe via internal Mutex — all methods are blocking but fast.
pub struct DiscordRPC {
    client: Mutex<Option<DiscordIpcClient>>,
}

impl DiscordRPC {
    pub fn new() -> Self {
        Self {
            client: Mutex::new(None),
        }
    }

    /// Connect to Discord using the given application client ID.
    /// Returns an error if Discord is not running or the pipe cannot be opened.
    pub fn connect(&self, client_id: &str) -> Result<(), String> {
        let mut guard = self.client.lock().map_err(|e| e.to_string())?;

        // Disconnect first if already connected
        if let Some(mut c) = guard.take() {
            let _ = c.close();
        }

        let mut client = DiscordIpcClient::new(client_id);
        client.connect().map_err(|e| format!("Discord RPC connect failed: {}", e))?;
        *guard = Some(client);
        Ok(())
    }

    /// Disconnect from Discord and clear any activity.
    pub fn disconnect(&self) {
        if let Ok(mut guard) = self.client.lock() {
            if let Some(mut c) = guard.take() {
                let _ = c.clear_activity();
                let _ = c.close();
            }
        }
    }

    /// Returns `true` if we are currently connected to Discord.
    pub fn is_connected(&self) -> bool {
        self.client.lock().map(|g| g.is_some()).unwrap_or(false)
    }

    /// Set a rich presence activity.
    ///
    /// - `state`: short status line (e.g. "Season 1 Episode 3")
    /// - `details`: longer description (e.g. "The Mandalorian")
    /// - `large_text`: tooltip for the large image (e.g. "Nuvio Desktop")
    /// - `small_text`: tooltip for the small image (e.g. "Playing")
    /// - `start_timestamp`: if `Some`, displays elapsed time; if `None`, no timer
    /// - `large_image`: custom asset key from Discord Developer Portal (defaults to "nuvio")
    pub fn set_presence(
        &self,
        state: &str,
        details: &str,
        large_text: &str,
        small_text: &str,
        start_timestamp: Option<i64>,
        large_image: Option<&str>,
    ) -> Result<(), String> {
        let mut guard = self.client.lock().map_err(|e| e.to_string())?;
        let client = guard.as_mut().ok_or("Discord RPC not connected")?;

        let assets = activity::Assets::new()
            .large_image(large_image.unwrap_or("nuvio"))
            .large_text(large_text)
            .small_image("play")
            .small_text(small_text);

        let mut act = activity::Activity::new()
            .state(state)
            .details(details)
            .assets(assets);

        if let Some(ts) = start_timestamp {
            act = act.timestamps(activity::Timestamps::new().start(ts));
        }

        client.set_activity(act).map_err(|e| e.to_string())
    }

    /// Clear the current activity (set the user's status back to nothing).
    pub fn clear_presence(&self) -> Result<(), String> {
        let mut guard = self.client.lock().map_err(|e| e.to_string())?;
        match guard.as_mut() {
            Some(c) => c.clear_activity().map_err(|e| e.to_string()),
            None => Ok(()),
        }
    }
}
