// ---------------------------------------------------------------------------
// mpv_native.rs — Direct libmpv FFI wrapper (libloading-based)
//
// Modeled on vayou-desktop's mpv/ffi.rs + mpv/player.rs + mpv/events.rs + mpv/types.rs.
// Single-file module providing MpvPlayer + event loop for Tauri v2.
// ---------------------------------------------------------------------------

use std::ffi::{CStr, CString, c_void};
use std::os::raw::{c_char, c_double, c_int};
use std::sync::{Arc, OnceLock};

use libloading::Library;
use tauri::Emitter;

// ===========================================================================
// Section 3 — Event types and constants
// ===========================================================================

/// Raw mpv event as returned by `mpv_wait_event`.
#[repr(C)]
pub struct MpvEvent {
    pub event_id: u32,
    pub error: i32,
    pub reply_userdata: u64,
    pub data: *mut c_void,
}

/// Property change data within an mpv event.
#[repr(C)]
pub struct MpvEventProperty {
    pub name: *const c_char,
    pub format: i32,
    pub data: *mut c_void,
}

// Event identifiers — values from libmpv client.h `enum mpv_event_id`.
pub const MPV_EVENT_NONE: u32 = 0;
pub const MPV_EVENT_SHUTDOWN: u32 = 1;
pub const MPV_EVENT_END_FILE: u32 = 7;
pub const MPV_EVENT_FILE_LOADED: u32 = 8;
pub const MPV_EVENT_PROPERTY_CHANGE: u32 = 22;

// Property format identifiers
pub const MPV_FORMAT_NONE: i32 = 0;
pub const MPV_FORMAT_STRING: i32 = 1;
pub const MPV_FORMAT_FLAG: i32 = 3;
pub const MPV_FORMAT_INT64: i32 = 4;
pub const MPV_FORMAT_DOUBLE: i32 = 5;

// ===========================================================================
// Section 1 — FFI bindings (libloading-based, loaded once globally)
// ===========================================================================

type MpvHandle = *mut c_void;

/// All mpv function pointers, resolved once at startup.
/// The `Library` is kept alive to ensure pointers remain valid.
struct MpvFfi {
    _lib: Library,
    create: unsafe extern "C" fn() -> MpvHandle,
    initialize: unsafe extern "C" fn(MpvHandle) -> c_int,
    terminate_destroy: unsafe extern "C" fn(MpvHandle),
    set_option: unsafe extern "C" fn(MpvHandle, *const c_char, c_int, *const c_void) -> c_int,
    set_option_string: unsafe extern "C" fn(MpvHandle, *const c_char, *const c_char) -> c_int,
    command: unsafe extern "C" fn(MpvHandle, *const *const c_char) -> c_int,
    #[allow(dead_code)]
    command_string: unsafe extern "C" fn(MpvHandle, *const c_char) -> c_int,
    set_property: unsafe extern "C" fn(MpvHandle, *const c_char, c_int, *const c_void) -> c_int,
    set_property_string: unsafe extern "C" fn(MpvHandle, *const c_char, *const c_char) -> c_int,
    get_property: unsafe extern "C" fn(MpvHandle, *const c_char, c_int, *mut c_void) -> c_int,
    get_property_string: unsafe extern "C" fn(MpvHandle, *const c_char) -> *mut c_char,
    observe_property: unsafe extern "C" fn(MpvHandle, u64, *const c_char, c_int) -> c_int,
    unobserve_property: unsafe extern "C" fn(MpvHandle, u64) -> c_int,
    wait_event: unsafe extern "C" fn(MpvHandle, c_double) -> *mut MpvEvent,
    free: unsafe extern "C" fn(*mut c_void),
}

// Function pointers are just addresses — safe to share across threads.
unsafe impl Send for MpvFfi {}
unsafe impl Sync for MpvFfi {}

static FFI: OnceLock<MpvFfi> = OnceLock::new();

impl MpvFfi {
    /// Get the global FFI instance, or error if not yet initialized.
    fn global() -> Result<&'static Self, String> {
        FFI.get().ok_or_else(|| "mpv FFI not initialized — call MpvPlayer::new() first".to_string())
    }

    /// Load libmpv and resolve all symbols. Idempotent — only loads once.
    fn init() -> Result<&'static Self, String> {
        if let Some(ffi) = FFI.get() {
            return Ok(ffi);
        }
        let ffi = Self::load()?;
        let _ = FFI.set(ffi); // ignore race: another thread may have set it
        FFI.get()
            .ok_or_else(|| "mpv FFI failed to initialize after load".to_string())
    }

    fn load() -> Result<Self, String> {
        // Per-OS library name candidates.
        #[cfg(target_os = "windows")]
        const LIB_CANDIDATES: &[&str] = &["libmpv-2.dll", "mpv-2.dll"];
        #[cfg(target_os = "linux")]
        const LIB_CANDIDATES: &[&str] = &["libmpv.so.2", "libmpv.so.1", "libmpv.so"];
        #[cfg(target_os = "macos")]
        const LIB_CANDIDATES: &[&str] = &["libmpv.2.dylib", "libmpv.1.dylib", "libmpv.dylib"];

        let lib = unsafe {
            let exe_dir = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.to_path_buf()));
            let mut loaded = None;

            // 1. exe dir + binaries/ subfolder (where Windows bundle ships the .dll)
            if let Some(dir) = exe_dir.as_ref() {
                for name in LIB_CANDIDATES {
                    if let Ok(l) =
                        Library::new(dir.join(name)).or_else(|_| Library::new(dir.join("binaries").join(name)))
                    {
                        loaded = Some(l);
                        break;
                    }
                }
            }

            // 2. system loader (Linux/macOS; Windows fallback)
            if loaded.is_none() {
                for name in LIB_CANDIDATES {
                    if let Ok(l) = Library::new(*name) {
                        loaded = Some(l);
                        break;
                    }
                }
            }

            match loaded {
                Some(lib) => lib,
                None => {
                    return Err(format!(
                        "libmpv not found — none of {:?} could be loaded (exe dir + system loader)",
                        LIB_CANDIDATES
                    ))
                }
            }
        };

        unsafe {
            let ffi = MpvFfi {
                create: *lib.get(b"mpv_create\0").map_err(|e| format!("mpv_create: {}", e))?,
                initialize: *lib.get(b"mpv_initialize\0").map_err(|e| format!("mpv_initialize: {}", e))?,
                terminate_destroy: *lib
                    .get(b"mpv_terminate_destroy\0")
                    .map_err(|e| format!("mpv_terminate_destroy: {}", e))?,
                set_option: *lib.get(b"mpv_set_option\0").map_err(|e| format!("mpv_set_option: {}", e))?,
                set_option_string: *lib
                    .get(b"mpv_set_option_string\0")
                    .map_err(|e| format!("mpv_set_option_string: {}", e))?,
                command: *lib.get(b"mpv_command\0").map_err(|e| format!("mpv_command: {}", e))?,
                command_string: *lib
                    .get(b"mpv_command_string\0")
                    .map_err(|e| format!("mpv_command_string: {}", e))?,
                set_property: *lib
                    .get(b"mpv_set_property\0")
                    .map_err(|e| format!("mpv_set_property: {}", e))?,
                set_property_string: *lib
                    .get(b"mpv_set_property_string\0")
                    .map_err(|e| format!("mpv_set_property_string: {}", e))?,
                get_property: *lib
                    .get(b"mpv_get_property\0")
                    .map_err(|e| format!("mpv_get_property: {}", e))?,
                get_property_string: *lib
                    .get(b"mpv_get_property_string\0")
                    .map_err(|e| format!("mpv_get_property_string: {}", e))?,
                observe_property: *lib
                    .get(b"mpv_observe_property\0")
                    .map_err(|e| format!("mpv_observe_property: {}", e))?,
                unobserve_property: *lib
                    .get(b"mpv_unobserve_property\0")
                    .map_err(|e| format!("mpv_unobserve_property: {}", e))?,
                wait_event: *lib.get(b"mpv_wait_event\0").map_err(|e| format!("mpv_wait_event: {}", e))?,
                free: *lib.get(b"mpv_free\0").map_err(|e| format!("mpv_free: {}", e))?,
                _lib: lib,
            };

            eprintln!("[mpv-native] libmpv loaded — all symbols resolved");
            Ok(ffi)
        }
    }
}

// ===========================================================================
// Section 2 — MpvPlayer struct (safe wrapper around mpv_handle)
// ===========================================================================

/// Safe wrapper around a raw mpv_handle.
///
/// The mpv API is thread-safe for most operations (commands, properties)
/// with the restriction that `mpv_wait_event` must be called from a single
/// dedicated thread. Use `Arc<MpvPlayer>` to share between the event thread
/// and command-issuing threads.
pub struct MpvPlayer {
    handle: MpvHandle,
}

// mpv API is thread-safe: commands/properties from any thread,
// mpv_wait_event from one dedicated thread.
unsafe impl Send for MpvPlayer {}
unsafe impl Sync for MpvPlayer {}

impl MpvPlayer {
    /// Create a new mpv instance attached to the given window handle (HWND).
    pub fn new(hwnd: i64) -> Result<Self, String> {
        let ffi = MpvFfi::init()?;

        let handle = unsafe { (ffi.create)() };
        if handle.is_null() {
            return Err("mpv_create returned null".to_string());
        }

        eprintln!("[mpv-native] Creating mpv instance (hwnd={})", hwnd);

        // ── Pre-init options (must be set before mpv_initialize) ──

        // wid (the HWND for embedding)
        let c_name = CString::new("wid").map_err(|e| e.to_string())?;
        let rc = unsafe {
            (ffi.set_option)(
                handle,
                c_name.as_ptr(),
                MPV_FORMAT_INT64,
                &hwnd as *const i64 as *const c_void,
            )
        };
        if rc < 0 {
            return Err(format!("mpv_set_option(wid) failed: {}", rc));
        }
        eprintln!("[mpv-native] set_option(wid={}) OK", hwnd);

        // Other pre-init options
        let pre_init: &[(&str, &str)] = &[
            ("video-sync", "display-resync"),
            ("interpolation", "yes"),
            ("tscale", "oversample"),
            ("force-window", "yes"),
            ("idle", "yes"),
        ];
        for (k, v) in pre_init {
            if let (Ok(ck), Ok(cv)) = (CString::new(*k), CString::new(*v)) {
                let rc = unsafe { (ffi.set_option_string)(handle, ck.as_ptr(), cv.as_ptr()) };
                if rc < 0 {
                    eprintln!("[mpv-native] set_option_string({}={}) -> rc={}", k, v, rc);
                }
            }
        }

        // ── Initialize ──
        eprintln!("[mpv-native] Calling mpv_initialize...");
        let rc = unsafe { (ffi.initialize)(handle) };
        if rc < 0 {
            return Err(format!("mpv_initialize failed: {}", rc));
        }
        eprintln!("[mpv-native] mpv_initialize OK");

        let player = Self { handle };

        // ── Post-init configuration ──
        let post_init: &[(&str, &str)] = &[
            ("hwdec", "auto-safe"),
            ("keep-open", "yes"),
            ("osd-level", "0"),
            ("audio-fallback-to-null", "yes"),
            ("cache", "yes"),
            ("cache-secs", "120"),
            ("demuxer-max-bytes", "300M"),
            ("network-timeout", "30"),
            (
                "user-agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            ),
        ];
        for (k, v) in post_init {
            if let (Ok(k), Ok(v)) = (CString::new(*k), CString::new(*v)) {
                unsafe {
                    (ffi.set_property_string)(handle, k.as_ptr(), v.as_ptr());
                }
            }
        }

        eprintln!("[mpv-native] mpv instance created and configured");
        Ok(player)
    }

    // ── Low-level FFI wrappers ──

    /// Send a command to mpv (e.g. `["loadfile", "/path/to/file"]`).
    pub fn command(&self, args: &[&str]) -> Result<(), String> {
        let ffi = MpvFfi::global()?;
        let c_args: Vec<CString> = args
            .iter()
            .map(|s| CString::new(*s).map_err(|e| e.to_string()))
            .collect::<Result<_, _>>()?;
        let mut ptrs: Vec<*const c_char> = c_args.iter().map(|s| s.as_ptr()).collect();
        ptrs.push(std::ptr::null());

        let rc = unsafe { (ffi.command)(self.handle, ptrs.as_ptr()) };
        if rc < 0 {
            return Err(format!("mpv command {:?} failed (error {})", args, rc));
        }
        Ok(())
    }

    /// Set a property on mpv with the given format and raw bytes.
    pub fn set_property(&self, name: &str, format: i32, data: &[u8]) -> Result<(), String> {
        let ffi = MpvFfi::global()?;
        let c_name = CString::new(name).map_err(|e| e.to_string())?;
        let rc = unsafe {
            (ffi.set_property)(
                self.handle,
                c_name.as_ptr(),
                format,
                data.as_ptr() as *const c_void,
            )
        };
        if rc < 0 {
            return Err(format!("mpv_set_property({}) failed: {}", name, rc));
        }
        Ok(())
    }

    /// Get a property from mpv with the given format, returning raw bytes.
    pub fn get_property(&self, name: &str, format: i32) -> Result<Vec<u8>, String> {
        // For strings we delegate to get_property_string which handles the
        // mpv-allocated buffer correctly.
        if format == MPV_FORMAT_STRING {
            return self
                .get_property_string(name)
                .map(|s| s.into_bytes());
        }

        let ffi = MpvFfi::global()?;
        let c_name = CString::new(name).map_err(|e| e.to_string())?;

        // Allocate a buffer sized appropriately for the requested format.
        let buf_size: usize = match format {
            MPV_FORMAT_FLAG => 4,    // int
            MPV_FORMAT_INT64 => 8,   // int64_t
            MPV_FORMAT_DOUBLE => 8,  // double
            MPV_FORMAT_NONE => 0,
            _ => return Err(format!("unsupported get_property format {} for '{}'", format, name)),
        };

        if buf_size == 0 {
            return Ok(Vec::new());
        }

        let mut buf = vec![0u8; buf_size];
        let rc = unsafe {
            (ffi.get_property)(
                self.handle,
                c_name.as_ptr(),
                format,
                buf.as_mut_ptr() as *mut c_void,
            )
        };
        if rc < 0 {
            return Err(format!("mpv_get_property({}) failed: {}", name, rc));
        }
        Ok(buf)
    }

    /// Observe a property for changes (delivered via `wait_event`).
    pub fn observe_property(&self, name: &str, id: u64, format: i32) -> Result<(), String> {
        let ffi = MpvFfi::global()?;
        let c_name = CString::new(name).map_err(|e| e.to_string())?;
        let rc = unsafe { (ffi.observe_property)(self.handle, id, c_name.as_ptr(), format) };
        if rc < 0 {
            return Err(format!("mpv_observe_property({}) failed: {}", name, rc));
        }
        Ok(())
    }

    /// Unobserve a property.
    pub fn unobserve_property(&self, id: u64) -> Result<(), String> {
        let ffi = MpvFfi::global()?;
        let rc = unsafe { (ffi.unobserve_property)(self.handle, id) };
        if rc < 0 {
            return Err(format!("mpv_unobserve_property({}) failed: {}", id, rc));
        }
        Ok(())
    }

    /// Block until the next event (with timeout in seconds).
    /// Returns `Some(MpvEvent)` if an event occurred, or `None` on timeout.
    pub fn wait_event(&self, timeout: f64) -> Option<MpvEvent> {
        let ffi = match MpvFfi::global() {
            Ok(f) => f,
            Err(_) => return None,
        };
        let evt = unsafe { &*(ffi.wait_event)(self.handle, timeout) };
        if evt.event_id == MPV_EVENT_NONE {
            return None;
        }
        // Copy the event struct (data pointer remains valid until next
        // wait_event call — the caller must consume it before calling
        // wait_event again).
        Some(MpvEvent {
            event_id: evt.event_id,
            error: evt.error,
            reply_userdata: evt.reply_userdata,
            data: evt.data,
        })
    }

    // ── High-level convenience methods ──

    /// Load a URL (or file path) for playback.
    pub fn load_url(&self, url: &str) -> Result<(), String> {
        eprintln!("[mpv-native] Loading URL: {}", url);
        self.command(&["loadfile", url, "replace"])
    }

    /// Toggle pause state.
    pub fn toggle_pause(&self) -> Result<(), String> {
        self.command(&["cycle", "pause"])
    }

    /// Seek by a relative amount (positive = forward, negative = backward).
    pub fn seek_relative(&self, seconds: i64) -> Result<(), String> {
        self.command(&["seek", &seconds.to_string(), "relative"])
    }

    /// Seek to an absolute position in seconds.
    pub fn seek_absolute(&self, seconds: f64) -> Result<(), String> {
        self.command(&["seek", &seconds.to_string(), "absolute"])
    }

    /// Set volume (0.0 – 100.0).
    pub fn set_volume(&self, vol: f64) -> Result<(), String> {
        let ffi = MpvFfi::global()?;
        let c_name = CString::new("volume").map_err(|e| e.to_string())?;
        let rc = unsafe {
            (ffi.set_property)(
                self.handle,
                c_name.as_ptr(),
                MPV_FORMAT_DOUBLE,
                &vol as *const f64 as *const c_void,
            )
        };
        if rc < 0 {
            return Err(format!("mpv_set_property(volume) failed: {}", rc));
        }
        Ok(())
    }

    /// Stop playback.
    pub fn stop(&self) -> Result<(), String> {
        eprintln!("[mpv-native] Stopping playback");
        self.command(&["stop"])
    }

    // ── Private helpers ──

    /// Get a property as a string (uses the mpv-allocated string API).
    fn get_property_string(&self, name: &str) -> Result<String, String> {
        let ffi = MpvFfi::global()?;
        let c_name = CString::new(name).map_err(|e| e.to_string())?;
        let ptr = unsafe { (ffi.get_property_string)(self.handle, c_name.as_ptr()) };
        if ptr.is_null() {
            return Err(format!("mpv_get_property_string({}) returned null", name));
        }
        let s = unsafe { CStr::from_ptr(ptr).to_string_lossy().into_owned() };
        unsafe { (ffi.free)(ptr as *mut c_void) };
        Ok(s)
    }
}

impl Drop for MpvPlayer {
    fn drop(&mut self) {
        if let Ok(ffi) = MpvFfi::global() {
            eprintln!("[mpv-native] Destroying mpv instance");
            unsafe { (ffi.terminate_destroy)(self.handle) };
        }
    }
}

// ===========================================================================
// Section 4 — Event loop
// ===========================================================================

/// Spawn a background thread that polls mpv events and emits them as Tauri
/// events to the frontend.
///
/// Emitted events:
/// - `mpv:time-pos` (f64) — current playback position
/// - `mpv:duration` (f64) — media duration
/// - `mpv:pause` (bool) — pause state change
/// - `mpv:file-loaded` — a new file has started loading
/// - `mpv:end-file` — current file playback ended
pub fn start_event_loop(mpv: Arc<MpvPlayer>, app: tauri::AppHandle) {
    use std::time::Instant;
    std::thread::Builder::new()
        .name("mpv-events".into())
        .spawn(move || {
            eprintln!("[mpv-native] Event loop started");
            let mut last_pos_emit = Instant::now();
            let mut last_duration: f64 = -1.0;
            let mut has_file = false;
            let mut emit_count: u64 = 0;
            let mut last_log = Instant::now();
            
            loop {
                // Longer timeout when idle, shorter when playing
                let timeout = if has_file { 0.05 } else { 0.5 };
                let evt = match mpv.wait_event(timeout) {
                    Some(e) => e,
                    None => continue,
                };
                match evt.event_id {
                    MPV_EVENT_PROPERTY_CHANGE => {
                        let prop_ptr = evt.data as *const MpvEventProperty;
                        unsafe {
                            let name = std::ffi::CStr::from_ptr((*prop_ptr).name).to_string_lossy();
                            match name.as_ref() {
                                "time-pos" if (*prop_ptr).format == MPV_FORMAT_DOUBLE => {
                                    // Throttle: max ~10 emits per second
                                    if last_pos_emit.elapsed().as_millis() >= 100 {
                                        let val = *((*prop_ptr).data as *const f64);
                                        let _ = app.emit("mpv:time-pos", val);
                                        last_pos_emit = Instant::now();
                                        emit_count += 1;
                                        if last_log.elapsed().as_secs() >= 3 {
                                            eprintln!("[mpv-native] time-pos emits/3s={} latest={:.2}", emit_count, val);
                                            emit_count = 0;
                                            last_log = Instant::now();
                                        }
                                    }
                                }
                                "duration" if (*prop_ptr).format == MPV_FORMAT_DOUBLE => {
                                    let val = *((*prop_ptr).data as *const f64);
                                    // Only emit when duration actually changes
                                    if (val - last_duration).abs() > 0.1 {
                                        let _ = app.emit("mpv:duration", val);
                                        last_duration = val;
                                    }
                                }
                                "pause" if (*prop_ptr).format == MPV_FORMAT_FLAG => {
                                    let val = *((*prop_ptr).data as *const i32) != 0;
                                    let _ = app.emit("mpv:pause", val);
                                }
                                _ => {}
                            }
                        }
                    }
                    MPV_EVENT_FILE_LOADED => {
                        has_file = true;
                        last_pos_emit = Instant::now();
                        last_duration = -1.0;
                        eprintln!("[mpv-native] File loaded");
                        let _ = app.emit("mpv:file-loaded", ());
                    }
                    MPV_EVENT_END_FILE => {
                        has_file = false;
                        eprintln!("[mpv-native] Video ended");
                        let _ = app.emit("mpv:end-file", ());
                    }
                    MPV_EVENT_SHUTDOWN => {
                        eprintln!("[mpv-native] Shutdown event received");
                        break;
                    }
                    _ => {}
                }
            }
            eprintln!("[mpv-native] Event loop ended");
        })
        .expect("Failed to spawn mpv event loop thread");
}
