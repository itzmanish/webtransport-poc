use std::collections::HashMap;

use crate::{publisher::Publisher, subscriber::Subscriber, wt::WebTransport};

pub struct Session<'static> {
    id: String,
    publishers: HashMap<u8, &'a Publisher>,
    subscribers: HashMap<u8, &'a Subscriber>,
}

impl Session {
    pub fn new(id: String) -> Self {
        Session {
            id,
            publishers: Vec::new(),
            subscribers: Vec::new(),
        }
    }

    pub fn add_publisher(&mut self, p: Publisher) {
        self.publishers.push(p);
    }

    pub fn remove_publisher(&mut self, id: String) {}
}
