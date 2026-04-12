use std::fs::File;
use std::io::Write;
use reqwest::blocking::Client;
use std::path::Path;

pub fn download_vlc(dest_dir: &Path) -> Result<String, String> {
    std::fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;
    
    // URL VLC portable
    let url = "https://downloads.videolan.org/pub/videolan/vlc/last/win64/vlc-last-win64.7z";
    
    println!("📥 Download VLC da: {}", url);
    
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;
    
    let response = client.get(url).send().map_err(|e| e.to_string())?;
    let bytes = response.bytes().map_err(|e| e.to_string())?;
    
    let temp_7z = dest_dir.join("vlc.7z");
    let mut file = File::create(&temp_7z).map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    
    println!("📦 Estrazione VLC...");
    
    // Cerca 7z.exe
    let seven_zip_paths = [
        r"C:\Program Files\7-Zip\7z.exe",
        r"C:\Program Files (x86)\7-Zip\7z.exe",
    ];
    
    let seven_zip = seven_zip_paths.iter().find(|p| std::path::Path::new(p).exists());
    
    if let Some(seven_zip) = seven_zip {
        use std::process::Command;
        let output = Command::new(seven_zip)
            .args(["x", temp_7z.to_str().unwrap(), &format!("-o{}", dest_dir.to_str().unwrap()), "-y"])
            .output()
            .map_err(|e| format!("Errore estrazione: {}", e))?;
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Estrazione fallita: {}", stderr));
        }
    } else {
        return Err("7-Zip non trovato. Installa 7-Zip da https://www.7-zip.org/".to_string());
    }
    
    // Trova vlc.exe
    let vlc_exe = dest_dir.join("vlc.exe");
    if !vlc_exe.exists() {
        // Cerca nella sottocartella estratta
        for entry in std::fs::read_dir(dest_dir).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if path.is_dir() && path.file_name().unwrap().to_string_lossy().contains("vlc") {
                let exe = path.join("vlc.exe");
                if exe.exists() {
                    std::fs::rename(&exe, &vlc_exe).ok();
                }
                break;
            }
        }
    }
    
    let _ = std::fs::remove_file(temp_7z);
    
    if vlc_exe.exists() {
        println!("✅ VLC installato: {:?}", vlc_exe);
        Ok(vlc_exe.to_string_lossy().to_string())
    } else {
        Err("VLC non trovato dopo estrazione".to_string())
    }
}

pub fn download_mpv(dest_dir: &Path) -> Result<String, String> {
    std::fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;
    
    // URL mpv portable
    let url = "https://sourceforge.net/projects/mpv-player-windows/files/64bit/mpv-x86_64-20250405-git-6e6e1f5.7z/download";
    
    println!("📥 Download mpv da: {}", url);
    
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;
    
    let response = client.get(url).send().map_err(|e| e.to_string())?;
    let bytes = response.bytes().map_err(|e| e.to_string())?;
    
    let temp_7z = dest_dir.join("mpv.7z");
    let mut file = File::create(&temp_7z).map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    
    println!("📦 Estrazione mpv...");
    
    let seven_zip_paths = [
        r"C:\Program Files\7-Zip\7z.exe",
        r"C:\Program Files (x86)\7-Zip\7z.exe",
    ];
    
    let seven_zip = seven_zip_paths.iter().find(|p| std::path::Path::new(p).exists());
    
    if let Some(seven_zip) = seven_zip {
        use std::process::Command;
        let output = Command::new(seven_zip)
            .args(["x", temp_7z.to_str().unwrap(), &format!("-o{}", dest_dir.to_str().unwrap()), "-y"])
            .output()
            .map_err(|e| format!("Errore estrazione: {}", e))?;
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Estrazione fallita: {}", stderr));
        }
    } else {
        return Err("7-Zip non trovato. Installa 7-Zip da https://www.7-zip.org/".to_string());
    }
    
    // Trova mpv.exe
    let mpv_exe = dest_dir.join("mpv.exe");
    if !mpv_exe.exists() {
        for entry in std::fs::read_dir(dest_dir).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if path.is_dir() && path.file_name().unwrap().to_string_lossy().contains("mpv") {
                let exe = path.join("mpv.exe");
                if exe.exists() {
                    std::fs::rename(&exe, &mpv_exe).ok();
                }
                break;
            }
        }
    }
    
    let _ = std::fs::remove_file(temp_7z);
    
    if mpv_exe.exists() {
        println!("✅ mpv installato: {:?}", mpv_exe);
        Ok(mpv_exe.to_string_lossy().to_string())
    } else {
        Err("mpv non trovato dopo estrazione".to_string())
    }
}