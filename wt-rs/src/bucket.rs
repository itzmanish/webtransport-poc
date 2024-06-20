use std::{
    collections::HashMap,
    io::Read,
    sync::{Arc, Mutex},
};

use bytes::{buf::Reader, BytesMut};

pub enum MediaKind {
    Audio,
    Video,
}

pub struct Packet {
    ssrc: u32,
    seq_no: u32,
    payload_type: MediaKind,
    size: usize,
    payload: BytesMut,
}

pub struct Bucket {
    pub ssrc: u32,
    pub kind: MediaKind,

    buffer: Vec<Packet>,
}

impl Bucket {
    pub fn new(ssrc: u32, kind: MediaKind) -> Bucket {
        Bucket {
            ssrc,
            kind,
            buffer: Vec::new(),
        }
    }
}

impl Read for Bucket {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        self.buffer.
    }
}

pub struct BucketPool {
    buckets: HashMap<u32, Arc<Mutex<Bucket>>>,
}

impl BucketPool {
    pub fn get_or_create(&mut self, ssrc: u32, kind: MediaKind) -> Arc<Mutex<Bucket>> {
        if let Some(bucket) = self.buckets.get(&ssrc) {
            return bucket.clone();
        }
        let bucket = Arc::new(Mutex::new(Bucket::new(ssrc, kind)));
        self.buckets.insert(ssrc, bucket.clone());
        return bucket;
    }
}
