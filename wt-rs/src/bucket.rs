use std::{
    collections::{HashMap, VecDeque},
    sync::{Arc, Mutex},
};

use bytes::{buf::Reader, BytesMut};

#[derive(Clone, Copy)]
pub enum MediaKind {
    Audio,
    Video,
}

#[derive(Clone, Copy)]
pub struct Packet {
    ssrc: u32,
    seq_no: u32,
    payload_type: MediaKind,
    size: usize,
    payload: &'static [u8],
}

pub struct Bucket {
    pub ssrc: u32,
    pub kind: MediaKind,

    buffer: VecDeque<Packet>,
}

impl Bucket {
    pub fn new(ssrc: u32, kind: MediaKind) -> Bucket {
        Bucket {
            ssrc,
            kind,
            buffer: VecDeque::new(),
        }
    }

    pub fn read(&mut self, buf: &mut [Packet]) -> std::io::Result<usize> {
        let mut length = buf.len();
        if length > self.buffer.len() {
            length = self.buffer.len();
        }
        for i in 0..length {
            let packet = self.buffer.pop_front().unwrap();
            buf[i] = packet;
        }
        Ok(length)
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
