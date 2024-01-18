package main

import (
	"context"
	"errors"
	"io"
	"log"
	"time"

	"github.com/quic-go/webtransport-go"
)

type Webtransport struct {
	direction TransportDirection
	session   *webtransport.Session
	sink      chan []byte
}

func NewWebtransport(session *webtransport.Session, direction TransportDirection) *Webtransport {
	return &Webtransport{
		session:   session,
		direction: direction,
	}
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
	buffer := make([]byte, 1<<12)
	length := 0
	defer func() {
		wt.sink <- buffer[:length]
	}()
	for {
		// Handle incoming data on the stream
		data := make([]byte, 1<<12) // 1<<14 = 16384 Bytes, 16KB
		n, err := stream.Read(data)
		if err != nil {
			if errors.Is(err, io.EOF) {
				return
			}
			log.Printf("Error reading from stream: %+v", err)
			return
		}
		if len(data) <= 0 {
			continue
		}
		log.Println("got packet len:", n, "current length", length)

		copy(buffer[length:length+n], data[:n])
		length += n

		// // Echo the data back to the client
		// _, err = stream.Write(data[:n])
		// if err != nil {
		// 	log.Println("Error writing to stream:", err)
		// 	return
		// }
	}
}
