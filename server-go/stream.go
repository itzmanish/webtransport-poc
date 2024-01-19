package main

import "log"

type Stream struct {
	id          string
	publisher   *ReceiveStream
	subscribers []*SendStream
}

func NewStream(id string) *Stream {
	return &Stream{
		id: id,
	}
}

func (s *Stream) publish(stream *ReceiveStream) {
	s.publisher = stream
	go func() {
		for pkt := range stream.sink {
			s.forward(pkt)
		}
	}()
}

func (s *Stream) subscribe(sub *SendStream) {
	s.subscribers = append(s.subscribers, sub)
}

func (s *Stream) forward(pkt []byte) {
	// log.Println("got packet for forwarding, len:", len(pkt), "pkt:", pkt[:4])
	// serial processing
	for _, stream := range s.subscribers {
		_, err := stream.Write(pkt)
		if err != nil {
			log.Println("failed to send the packet, error:", err)
		}
	}
}
