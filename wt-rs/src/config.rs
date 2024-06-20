use std::{env, sync::OnceLock};

pub struct Config {
    pub tls_cert: String,
    pub tls_key: String,
    port_range: [u16; 2],
}

impl Config {
    pub fn build() -> Config {
        let tls_cert = env::var("TLS_CERT_PATH").unwrap_or("../localhost.crt".to_string());
        let tls_key = env::var("TLS_KEY_PATH").unwrap_or("../localhost.key".to_string());
        let port_range = env::var("QUIC_PORT_RANGE").unwrap_or("40000,50000".to_string());
        let range = port_range
            .split(",")
            .map(|v| v.parse::<u16>().unwrap_or(0))
            .collect::<Vec<u16>>();
        return Config {
            tls_key,
            tls_cert,
            port_range: [range[0], range[1]],
        };
    }
}

pub fn get_config() -> &'static Config {
    static CONFIG: OnceLock<Config> = OnceLock::new();
    CONFIG.get_or_init(|| Config::build())
}

#[cfg(test)]
mod tests {
    use super::get_config;

    #[test]
    fn build() {
        let config = get_config();
        assert_eq!(config.tls_key, "../localhost.key");
        assert_eq!(config.port_range, [40000, 50000]);
    }
}
