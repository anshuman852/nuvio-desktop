use tokio::net::TcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

pub struct StreamProxy {
    port: u16,
}

impl StreamProxy {
    pub fn new() -> Self {
        Self { port: 11473 }
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub async fn start(&self) -> Result<(), String> {
        let listener = TcpListener::bind(format!("127.0.0.1:{}", self.port))
            .await
            .map_err(|e| format!("Proxy bind error: {}", e))?;

        eprintln!("[proxy] Avviato su http://127.0.0.1:{}/proxy", self.port);

        let port = self.port;
        tokio::spawn(async move {
            loop {
                match listener.accept().await {
                    Ok((stream, _)) => { tokio::spawn(handle_connection(stream, port)); }
                    Err(e) => eprintln!("[proxy] Accept error: {}", e),
                }
            }
        });

        Ok(())
    }
}

async fn handle_connection(mut client: tokio::net::TcpStream, port: u16) {
    let mut buf = vec![0u8; 65536];
    let n = match client.read(&mut buf).await {
        Ok(0) | Err(_) => return,
        Ok(n) => n,
    };

    let request = String::from_utf8_lossy(&buf[..n]);
    let first_line = match request.lines().next() {
        Some(l) => l,
        None => return,
    };

    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 { return; }

    let method = parts[0];
    let full_path = parts[1];

    if method == "OPTIONS" {
        let _ = client.write_all(
            b"HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, HEAD\r\nAccess-Control-Allow-Headers: *\r\n\r\n"
        ).await;
        return;
    }

    let query = match full_path.find('?') {
        Some(i) => &full_path[i+1..],
        None => {
            let _ = client.write_all(b"HTTP/1.1 400 Bad Request\r\n\r\nMissing query").await;
            return;
        }
    };

    let mut target_url = String::new();
    let mut headers: Vec<(String, String)> = Vec::new();

    for param in query.split('&') {
        if let Some(v) = param.strip_prefix("url=") {
            target_url = urlencoding::decode(v).unwrap_or_default().to_string();
        } else if let Some(v) = param.strip_prefix("h=") {
            let decoded = urlencoding::decode(v).unwrap_or_default().to_string();
            if let Some(idx) = decoded.find(':') {
                headers.push((
                    decoded[..idx].trim().to_string(),
                    decoded[idx+1..].trim().to_string(),
                ));
            }
        }
    }

    if target_url.is_empty() {
        let _ = client.write_all(b"HTTP/1.1 400 Bad Request\r\n\r\nMissing url").await;
        return;
    }

    eprintln!("[proxy] {} {}", method, target_url);

    let http_client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap();

    let mut req = http_client
        .get(&target_url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
        .header("Accept", "*/*");

    for (k, v) in &headers {
        eprintln!("[proxy]   {}={}", k, v);
        req = req.header(k.as_str(), v.as_str());
    }

    let resp = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[proxy] Error: {}", e);
            let msg = format!(
                "HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain\r\nAccess-Control-Allow-Origin: *\r\n\r\nProxy error: {}",
                e
            );
            let _ = client.write_all(msg.as_bytes()).await;
            return;
        }
    };

    let status = resp.status().as_u16();
    let content_type = resp.headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();

    let body_bytes = match resp.bytes().await {
        Ok(b) => b,
        Err(e) => { eprintln!("[proxy] Body error: {}", e); return; }
    };

    eprintln!("[proxy] status={} bytes={}", status, body_bytes.len());

    let is_m3u8 = content_type.contains("mpegurl")
        || target_url.contains(".m3u8")
        || (body_bytes.starts_with(b"#EXTM3U"));

    let final_body: Vec<u8> = if is_m3u8 {
        let text = String::from_utf8_lossy(&body_bytes).to_string();
        rewrite_m3u8(&text, &target_url, &headers, port).into_bytes()
    } else {
        body_bytes.to_vec()
    };

    let ct = if is_m3u8 { "application/vnd.apple.mpegurl" } else { content_type.as_str() };

    let header = format!(
        "HTTP/1.1 {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: no-cache\r\n\r\n",
        status, ct, final_body.len()
    );

    let _ = client.write_all(header.as_bytes()).await;
    let _ = client.write_all(&final_body).await;
    let _ = client.flush().await;
}

fn rewrite_m3u8(content: &str, base_url: &str, headers: &[(String, String)], port: u16) -> String {
    // Base per URL relative: tutto fino all'ultimo /
    let base = base_url.rfind('/').map(|i| &base_url[..=i]).unwrap_or(base_url);

    // Dominio per URL assolute che iniziano con /
    let domain = {
        let after_scheme = base_url.find("://").map(|i| i + 3).unwrap_or(0);
        let slash = base_url[after_scheme..].find('/').map(|i| after_scheme + i).unwrap_or(base_url.len());
        &base_url[..slash]
    };

    // Costruisci header params
    let header_params: String = headers.iter()
        .map(|(k, v)| format!("&h={}", urlencoding::encode(&format!("{}:{}", k, v))))
        .collect();

    content.lines().map(|line| {
        let trimmed = line.trim();

        if trimmed.is_empty() || trimmed.starts_with('#') {
            // Gestisci #EXT-X-MAP:URI="..."
            if trimmed.starts_with("#EXT-X-MAP:URI=\"") {
                let uri_start = trimmed.find('"').unwrap_or(0) + 1;
                let uri_end = trimmed[uri_start..].find('"')
                    .map(|i| uri_start + i)
                    .unwrap_or(trimmed.len());
                let uri = &trimmed[uri_start..uri_end];
                let abs = resolve_url(uri, base, domain);
                return format!(
                    "#EXT-X-MAP:URI=\"http://127.0.0.1:{}/proxy?url={}{}\"",
                    port, urlencoding::encode(&abs), header_params
                );
            }
            return line.to_string();
        }

        // Segmento o playlist variante
        let abs = resolve_url(trimmed, base, domain);
        format!(
            "http://127.0.0.1:{}/proxy?url={}{}",
            port, urlencoding::encode(&abs), header_params
        )
    }).collect::<Vec<_>>().join("\n")
}

fn resolve_url(uri: &str, base: &str, domain: &str) -> String {
    if uri.starts_with("http://") || uri.starts_with("https://") {
        uri.to_string()
    } else if uri.starts_with('/') {
        format!("{}{}", domain, uri)
    } else {
        format!("{}{}", base, uri)
    }
}