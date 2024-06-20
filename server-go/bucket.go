package main

import (
	"sync"
	"time"
)

type Kind string

const (
	Kind_Audio Kind = "audio"
	Kind_Video Kind = "video"
)

type Packet struct {
	SSRC   uint32
	Length uint32
	Kind

	ArrivalTime time.Time
	rawPayload  []byte
}

func NewPacket(raw []byte) {

}

type Bucket struct {
	SSRC uint32
	Kind

	Buffer []Packet
}

func NewBucket(ssrc uint32, kind Kind) *Bucket {
	return &Bucket{
		SSRC:   ssrc,
		Kind:   kind,
		Buffer: make([]Packet, 500),
	}
}

func (b *Bucket) Close() {
	clear(b.Buffer)
	bucketPool.Put(b)
}

// global bucket pool
var bucketPool = sync.Pool{} // *Bucket

func GetOrCreateBucket(ssrc uint32, kind Kind) *Bucket {
	bucket := bucketPool.Get()
	if bucket == nil {
		return NewBucket(ssrc, kind)
	}
	return bucket.(*Bucket)
}
