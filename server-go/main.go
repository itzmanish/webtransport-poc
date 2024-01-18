package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/quic-go/quic-go"
	"github.com/quic-go/quic-go/http3"
	"github.com/quic-go/webtransport-go"
)

type TransportDirection uint

const (
	Publisher TransportDirection = iota
	Subscriber
)

func main() {
	// Define flags
	addr := flag.String("addr", ":4443", "address to listen on")
	keyFile := flag.String("key", "", "path to the key file")
	certFile := flag.String("cert", "", "path to the certificate file")
	flag.Parse()

	// Validate flags
	if *keyFile == "" || *certFile == "" {
		fmt.Println("Error: Both -key and -cert flags are required.")
		flag.PrintDefaults()
		os.Exit(1)
	}

	// create a new webtransport.Server, listening on (UDP) port 443
	s := webtransport.Server{
		H3: http3.Server{
			Addr:       *addr,
			QuicConfig: &quic.Config{},
		},
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	var streams map[string]*Stream = make(map[string]*Stream)

	// Create a new HTTP endpoint /.
	http.HandleFunc("/publish", func(w http.ResponseWriter, r *http.Request) {
		session, err := s.Upgrade(w, r)
		if err != nil {
			log.Printf("upgrading failed: %s", err)
			w.WriteHeader(500)
			return
		}
		query := r.URL.Query()
		streamId := query.Get("stream_id")
		sm, existing := getOrCreateStream(streamId, streams)
		if existing {
			fmt.Fprintln(w, "publisher already exists")
			w.WriteHeader(409)
			return
		}
		wt := NewWebtransport(session, Publisher)
		pub := NewReceiveStream(wt)
		pub.onClose(func() {
			delete(streams, streamId)
		})

		sm.publish(pub)
		streams[streamId] = sm
		go pub.startRecieveLoop()
		// // Handle the connection. Here goes the application logic.
		// go handleWebTransport(session, Publisher, streamId)
	})

	http.HandleFunc("/subscribe", func(w http.ResponseWriter, r *http.Request) {
		session, err := s.Upgrade(w, r)
		if err != nil {
			log.Printf("upgrading failed: %s", err)
			w.WriteHeader(500)
			return
		}
		query := r.URL.Query()
		streamId := query.Get("stream_id")
		sm, found := streams[streamId]
		if !found {
			log.Printf("publisher stream id not found: %s", streamId)
			w.WriteHeader(404)
			return
		}
		wt := NewWebtransport(session, Subscriber)
		sub := NewSendStream(wt)
		sm.subscribe(sub)
		// Handle the connection. Here goes the application logic.
		// go handleWebTransport(session, streamId)
	})

	log.Printf("Webtransport server listening at %s", *addr)
	if err := s.ListenAndServeTLS(*certFile, *keyFile); err != nil {
		log.Println("failed to start webtransport h3 server:", err)
	}
}

func handleWebTransport(session *webtransport.Session, streamId string) {
	go func() {
		for {
			stream, err := session.AcceptStream(context.Background())
			if err != nil {
				log.Println("Error accepting stream:", err)
				return
			}

			go handleBidiStream(stream, streamId)
		}
	}()
}

func handleBidiStream(stream webtransport.Stream, streamId string) {
	for {
		// Handle incoming data on the stream
		data := make([]byte, 1<<12) // 16384 Bytes, 16KB
		n, err := stream.Read(data)
		if err != nil {
			if errors.Is(err, io.EOF) {
				return
			}
			log.Printf("Error reading from stream: %+v", err)
			return
		}

		log.Println("got bidi stream packet len:", n)

		// Echo the data back to the client
		_, err = stream.Write(data[:n])
		if err != nil {
			log.Println("Error writing to stream:", err)
			return
		}
	}
}

func getOrCreateStream(id string, streams map[string]*Stream) (*Stream, bool) {
	stream, found := streams[id]
	if !found {
		stream = NewStream(id)
	}
	return stream, found
}
