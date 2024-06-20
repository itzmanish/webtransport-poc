use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};

use anyhow::{format_err, Error};
pub struct PortManager {
    current: u16,
    max: u16,
}

impl PortManager {
    pub fn new(current: u16, max: u16) -> PortManager {
        PortManager { current, max }
    }

    pub fn get_address(&mut self) -> Result<SocketAddr, anyhow::Error> {
        while self.current < self.max {
            if check_port_availibility(self.current).is_ok() {
                return Ok(SocketAddr::new(
                    IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)),
                    self.current,
                ));
            }
            self.current += 1;
        }
        return Err(format_err!("failed to get free port"));
    }
}

fn check_port_availibility(port: u16) -> Result<(), Error> {
    match UdpSocket::bind(("127.0.0.1", port)) {
        Ok(_) => Ok(()),
        Err(e) => Err(e.into()),
    }
}

#[cfg(test)]
mod tests {
    use super::check_port_availibility;

    #[test]
    fn check_port_availibility_test() {
        assert!(check_port_availibility(3000).is_ok());
    }
}
