use hyper::{Request, Response, StatusCode};
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper_util::rt::TokioIo;
use http_body_util::Full;
use bytes::Bytes;
use std::net::SocketAddr;
use std::convert::Infallible;
use tokio::net::TcpListener;

pub const PROXY_PORT: u16 = 11473;
pub const PROXY_BASE: &str = "http://127.0.0.1:11473";

pub struct StreamProxy;

impl StreamProxy {
    pub fn new() -> Self { StreamProxy }

    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let addr: SocketAddr = ([127, 0, 0, 1], PROXY_PORT).into();
        let listener = TcpListener::bind(addr).await?;
        eprintln!("[proxy] Listening on http://127.0.0.1:{}", PROXY_PORT);

        loop {
            match listener.accept().await {
                Ok((stream, _)) => {
                    let io = TokioIo::new(stream);
                    tokio::spawn(async move {
                        let _ = http1::Builder::new()
                            .serve_connection(io, service_fn(handle_proxy))
                            .await;
                    });
                }
                Err(e) => eprintln!("[proxy] accept error: {}", e),
            }
        }
    }
}

async fn handle_proxy(req: Request<hyper::body::Incoming>) -> Result<Response<Full<Bytes>>, Infallible> {
    let path = req.uri().path().to_string();
    let query = req.uri().query().unwrap_or("").to_string();

    // ── CORS preflight ────────────────────────────────────────────────────────
    if req.method() == hyper::Method::OPTIONS {
        let resp = Response::builder()
            .status(StatusCode::NO_CONTENT)
            .header("Access-Control-Allow-Origin", "*")
            .header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
            .header("Access-Control-Allow-Headers", "Range, Origin, X-Requested-With, Content-Type, Accept, Referer, User-Agent")
            .header("Access-Control-Max-Age", "86400")
            .body(Full::new(Bytes::new()))
            .unwrap();
        return Ok(resp);
    }

    // ── /proxy?url=<encoded>&referer=<encoded>&origin=<encoded> ───────────────
    if path == "/proxy" || path.starts_with("/proxy/") {
        return Ok(handle_stream_proxy(req, &query).await);
    }

    // ── /health ───────────────────────────────────────────────────────────────
    if path == "/health" {
        return Ok(Response::builder()
            .status(200)
            .header("Access-Control-Allow-Origin", "*")
            .header("Content-Type", "text/plain")
            .body(Full::new(Bytes::from("ok")))
            .unwrap());
    }

    Ok(Response::builder()
        .status(StatusCode::NOT_FOUND)
        .header("Access-Control-Allow-Origin", "*")
        .body(Full::new(Bytes::from("Not found")))
        .unwrap())
}

async fn handle_stream_proxy(req: Request<hyper::body::Incoming>, query: &str) -> Response<Full<Bytes>> {
    // Parse query params
    let params: std::collections::HashMap<String, String> = query.split('&')
        .filter_map(|pair| {
            let mut parts = pair.splitn(2, '=');
            let k = parts.next()?;
            let v = parts.next().unwrap_or("");
            Some((
                urlencoding::decode(k).unwrap_or_default().to_string(),
                urlencoding::decode(v).unwrap_or_default().to_string(),
            ))
        })
        .collect();

    let target_url = match params.get("url").filter(|u| !u.is_empty()) {
        Some(u) => u.clone(),
        None => return error_response(400, "Missing url parameter"),
    };

    let referer  = params.get("referer").cloned().unwrap_or_default();
    let origin   = params.get("origin").cloned().unwrap_or_default();
    let is_hls   = target_url.contains(".m3u8") || params.get("type").map(|t| t == "hls").unwrap_or(false);

    eprintln!("[proxy] → {} (hls={})", &target_url[..target_url.len().min(80)], is_hls);

    // Build upstream request
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .danger_accept_invalid_certs(true)
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
    {
        Ok(c) => c,
        Err(e) => return error_response(500, &format!("Client build error: {}", e)),
    };

    let mut upstream_req = client.request(
        reqwest::Method::from_bytes(req.method().as_str().as_bytes()).unwrap_or(reqwest::Method::GET),
        &target_url,
    );

    // Forward important headers
    if !referer.is_empty() {
        upstream_req = upstream_req.header("Referer", &referer);
    }
    if !origin.is_empty() {
        upstream_req = upstream_req.header("Origin", &origin);
    }

    // Forward Range header for seeking support
    if let Some(range) = req.headers().get("range") {
        if let Ok(range_str) = range.to_str() {
            upstream_req = upstream_req.header("Range", range_str);
        }
    }

    let response = match upstream_req.send().await {
        Ok(r) => r,
        Err(e) => return error_response(502, &format!("Upstream error: {}", e)),
    };

    let status    = response.status().as_u16();
    let ct        = response.headers().get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    let cl        = response.headers().get("content-length")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let cr        = response.headers().get("content-range")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let is_hls_ct = ct.contains("mpegurl") || ct.contains("x-mpegurl");

    let body_bytes = match response.bytes().await {
        Ok(b) => b,
        Err(e) => return error_response(502, &format!("Body read error: {}", e)),
    };

    // ── Rewrite HLS manifests so segment URLs go through our proxy ────────────
    let final_body = if is_hls || is_hls_ct {
        rewrite_hls_manifest(&body_bytes, &target_url, &referer, &origin)
    } else {
        body_bytes
    };

    let mut builder = Response::builder()
        .status(status)
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        .header("Access-Control-Allow-Headers", "*")
        .header("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Type")
        .header("Content-Type", if is_hls || is_hls_ct { "application/vnd.apple.mpegurl" } else { &ct });

    if let Some(cl) = cl {
        builder = builder.header("Content-Length", cl);
    }
    if let Some(cr) = cr {
        builder = builder.header("Content-Range", cr);
    }

    builder.body(Full::new(final_body)).unwrap_or_else(|_| error_response(500, "Response build error"))
}

/// Rewrites an HLS manifest so all relative and absolute URLs are
/// routed through the local proxy (preserves the original Referer/Origin).
fn rewrite_hls_manifest(body: &Bytes, base_url: &str, referer: &str, origin: &str) -> Bytes {
    let text = match std::str::from_utf8(body) {
        Ok(s) => s,
        Err(_) => return body.clone(),
    };

    // Base URL for resolving relative paths
    let base = base_url.rfind('/').map(|i| &base_url[..=i]).unwrap_or(base_url);

    let mut out = String::with_capacity(text.len() + 512);

    for line in text.lines() {
        let trimmed = line.trim();

        // Skip comment lines (except EXT tags) and empty lines as-is
        if trimmed.is_empty() || (trimmed.starts_with('#') && !trimmed.starts_with("#EXT-X-KEY") && !trimmed.starts_with("#EXT-X-MAP")) {
            out.push_str(line);
            out.push('\n');
            continue;
        }

        // EXT-X-KEY URI= attribute
        if trimmed.starts_with("#EXT-X-KEY") {
            let rewritten = rewrite_attr_uri(line, base, referer, origin, "URI=");
            out.push_str(&rewritten);
            out.push('\n');
            continue;
        }

        // EXT-X-MAP URI= attribute
        if trimmed.starts_with("#EXT-X-MAP") {
            let rewritten = rewrite_attr_uri(line, base, referer, origin, "URI=");
            out.push_str(&rewritten);
            out.push('\n');
            continue;
        }

        // Regular tag line — leave as-is
        if trimmed.starts_with('#') {
            out.push_str(line);
            out.push('\n');
            continue;
        }

        // Segment / sub-manifest URL
        let absolute = to_absolute(trimmed, base);
        let proxied  = build_proxy_url(&absolute, referer, origin);
        out.push_str(&proxied);
        out.push('\n');
    }

    Bytes::from(out)
}

fn rewrite_attr_uri(line: &str, base: &str, referer: &str, origin: &str, attr: &str) -> String {
    if let Some(start) = line.find(attr) {
        let after = &line[start + attr.len()..];
        let (quote, inner) = if after.starts_with('"') {
            let end = after[1..].find('"').unwrap_or(after.len() - 1);
            ('"', &after[1..end + 1])
        } else {
            (' ', after.split(',').next().unwrap_or(after))
        };
        let absolute = to_absolute(inner.trim_matches(quote), base);
        let proxied  = build_proxy_url(&absolute, referer, origin);
        if quote == '"' {
            line.replacen(&format!("{}\"{}\"", attr, inner), &format!("{}\"{}\"", attr, proxied), 1)
        } else {
            line.replacen(&format!("{}{}", attr, inner), &format!("{}{}", attr, proxied), 1)
        }
    } else {
        line.to_string()
    }
}

fn to_absolute(url: &str, base: &str) -> String {
    if url.starts_with("http://") || url.starts_with("https://") {
        url.to_string()
    } else if url.starts_with('/') {
        // Absolute path — extract scheme+host from base
        if let Some(host_end) = base[8..].find('/') {
            format!("{}{}", &base[..8 + host_end], url)
        } else {
            format!("{}{}", base.trim_end_matches('/'), url)
        }
    } else {
        format!("{}{}", base, url)
    }
}

fn build_proxy_url(url: &str, referer: &str, origin: &str) -> String {
    let encoded_url = urlencoding::encode(url);
    let mut proxy = format!("{}/proxy?url={}", PROXY_BASE, encoded_url);
    if !referer.is_empty() {
        proxy.push_str(&format!("&referer={}", urlencoding::encode(referer)));
    }
    if !origin.is_empty() {
        proxy.push_str(&format!("&origin={}", urlencoding::encode(origin)));
    }
    proxy
}

fn error_response(code: u16, msg: &str) -> Response<Full<Bytes>> {
    Response::builder()
        .status(code)
        .header("Access-Control-Allow-Origin", "*")
        .header("Content-Type", "text/plain")
        .body(Full::new(Bytes::from(msg.to_string())))
        .unwrap()
}