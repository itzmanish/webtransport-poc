use std::{
    fs,
    io::{self, Read},
    net::SocketAddr,
};

use anyhow::Context;

use crate::config::get_config;
use rustls::Certificate;
use webtransport_quinn::Session;

pub struct WebTransport {
    id: String,
    transport: Session,
}

async fn prepare_tls() -> Result<rustls::ServerConfig, anyhow::Error> {
    let config = get_config();
    // Read the PEM certificate chain
    let chain = fs::File::open(config.tls_cert.as_str()).context("failed to open cert file")?;
    let mut chain = io::BufReader::new(chain);

    let chain: Vec<Certificate> = rustls_pemfile::certs(&mut chain)?
        .into_iter()
        .map(Certificate)
        .collect();

    anyhow::ensure!(!chain.is_empty(), "could not find certificate");

    // Read the PEM private key
    let mut keys = fs::File::open(config.tls_key.as_str()).context("failed to open key file")?;

    // Read the keys into a Vec so we can parse it twice.
    let mut buf = Vec::new();
    keys.read_to_end(&mut buf)?;

    // Try to parse a PKCS#8 key
    // -----BEGIN PRIVATE KEY-----
    let mut keys = rustls_pemfile::pkcs8_private_keys(&mut io::Cursor::new(&buf))?;

    // Try again but with EC keys this time
    // -----BEGIN EC PRIVATE KEY-----
    if keys.is_empty() {
        keys = rustls_pemfile::ec_private_keys(&mut io::Cursor::new(&buf))?
    };

    anyhow::ensure!(!keys.is_empty(), "could not find private key");
    anyhow::ensure!(keys.len() < 2, "expected a single key");

    //let certs = certs.into_iter().map(rustls::Certificate).collect();
    let key = rustls::PrivateKey(keys.remove(0));

    // Standard Quinn setup
    let mut tls_config = rustls::ServerConfig::builder()
        .with_safe_default_cipher_suites()
        .with_safe_default_kx_groups()
        .with_protocol_versions(&[&rustls::version::TLS13])
        .unwrap()
        .with_no_client_auth()
        .with_single_cert(chain, key)?;

    tls_config.max_early_data_size = u32::MAX;
    tls_config.alpn_protocols = vec![webtransport_quinn::ALPN.to_vec()]; // this one is important
    Ok(tls_config)
}

async fn run_quic(tls_config: rustls::ServerConfig, addr: SocketAddr) -> Result<(), anyhow::Error> {
    let server_config = quinn::ServerConfig::with_crypto(std::sync::Arc::new(tls_config));
    log::info!("listening on {}", addr);

    let server = quinn::Endpoint::server(server_config, addr)?;

    // Accept new connections.
    while let Some(conn) = server.accept().await {
        tokio::spawn(async move {
            let err = run_conn(conn).await;
            if let Err(err) = err {
                log::error!("connection failed: {}", err)
            }
        });
    }

    // TODO simple echo server

    Ok(())
}

async fn run_conn(conn: quinn::Connecting) -> anyhow::Result<()> {
    log::info!("received new QUIC connection");

    // Wait for the QUIC handshake to complete.
    let conn = conn.await.context("failed to accept connection")?;
    log::info!("established QUIC connection");

    // Perform the WebTransport handshake.
    let request = webtransport_quinn::accept(conn).await?;
    log::info!("received WebTransport request: {}", request.url());

    // Accept the session.
    let session = request.ok().await.context("failed to accept session")?;
    log::info!("accepted session");

    // Run the session
    if let Err(err) = run_session(session).await {
        log::info!("closing session: {}", err);
    }

    Ok(())
}

async fn run_session(session: Session) -> anyhow::Result<()> {
    loop {
        // Wait for a bidirectional stream or datagram.
        tokio::select! {
            res = session.accept_bi() => {
                let (mut send, mut recv) = res?;
                log::info!("accepted stream");

                // Read the message and echo it back.
                let msg = recv.read_to_end(1024).await?;
                log::info!("recv: {}", String::from_utf8_lossy(&msg));

                send.write_all(&msg).await?;
                log::info!("send: {}", String::from_utf8_lossy(&msg));
            },
            res = session.read_datagram() => {
                let msg = res?;
                log::info!("accepted datagram");
                log::info!("recv: {}", String::from_utf8_lossy(&msg));

                session.send_datagram(msg.clone())?;
                log::info!("send: {}", String::from_utf8_lossy(&msg));
            },
        };

        log::info!("echo successful!");
    }
}
