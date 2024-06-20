use crate::{track::Track, wt::WebTransport};

pub struct Publisher {
    id: String,

    track: Track,
    wt: WebTransport,
}
