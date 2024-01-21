package main

import (
	"context"
	"encoding/binary"
	"errors"
	"io"
	"log"
	"sync/atomic"
	"time"

	"github.com/quic-go/webtransport-go"
)

type Webtransport struct {
	direction TransportDirection
	session   *webtransport.Session
	sink      chan []byte
	buffer    atomic.Value
}

func NewWebtransport(session *webtransport.Session, direction TransportDirection) *Webtransport {
	wt := &Webtransport{
		session:   session,
		direction: direction,
		buffer:    atomic.Value{},
	}
	wt.buffer.Store(make([]byte, 1<<18))
	return wt
}

func (wt *Webtransport) setSink(sink chan []byte) {
	wt.sink = sink
}

func (wt *Webtransport) handleRecv() {
	for {
		select {
		case <-wt.session.Context().Done():
			return
		default:
			stream, err := wt.session.AcceptUniStream(context.Background())
			if err != nil {
				log.Println("Error accepting stream:", err)
				return
			}
			go wt.handleRecvStream(stream)
		}
	}
}

func (wt *Webtransport) Write(data []byte) (int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	stream, err := wt.session.OpenUniStreamSync(ctx)
	if err != nil {
		return 0, err
	}
	i, err := stream.Write(data)
	if err != nil {
		return i, err
	}
	return i, stream.Close()
}

func (wt *Webtransport) handleRecvStream(stream webtransport.ReceiveStream) {
	length := 0
	requiredLen := 0

	processData := func(data []byte, n int) {
		// FIXME: this is under assumption that it will never read less than 4 byte
		// but that's wrong, if it ever read anything less than 4 after flush then
		// we are fcuked
		if requiredLen == 0 {
			requiredLen = int(binary.LittleEndian.Uint32(data[:4])) + 4
		}
		log.Println("got packet len:", n, "current length", length, "required length", requiredLen, "pkt", data[:4])
		readTill := min(n, requiredLen)
		buf := wt.buffer.Load().([]byte)
		copy(buf[length:length+readTill], data[:readTill])
		length += readTill
		requiredLen -= readTill
		if requiredLen == 0 {
			wt.flush(length)
			log.Println("flushed, len:", length)
			length = n - readTill
			if length > 0 {
				buf := wt.buffer.Load().([]byte)
				copy(buf[:length], data[readTill:n])
			}
		}
	}
	for {
		// Handle incoming data on the stream
		data := make([]byte, 1<<12) // 1<<14 = 16384 Bytes, 16KB
		// data := []byte{}

		n, err := stream.Read(data)
		if err != nil {
			if n > 0 {
				log.Println("see if this happens ever")
				processData(data, n)
			}
			if errors.Is(err, io.EOF) {
				log.Println("did I get EOF?")
				return
			}
			log.Printf("Error reading from stream: %+v", err)
			return
		}
		if len(data) <= 0 {
			log.Println("why the f*** the data size is 0?")
			continue
		}
		processData(data, n)
	}
}

func (wt *Webtransport) flush(length int) {
	old := wt.buffer.Swap(make([]byte, 1<<16)).([]byte)
	wt.sink <- old[:length]
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
