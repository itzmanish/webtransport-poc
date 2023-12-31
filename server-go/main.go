package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/quic-go/quic-go/http3"
	"github.com/quic-go/webtransport-go"
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
			Addr: *addr,
		},
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	// Create a new HTTP endpoint /.
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		session, err := s.Upgrade(w, r)
		if err != nil {
			log.Printf("upgrading failed: %s", err)
			w.WriteHeader(500)
			return
		}
		// Handle the connection. Here goes the application logic.
		go handleWebTransport(session)
	})

	log.Printf("Webtransport server listening at %s", *addr)
	if err := s.ListenAndServeTLS(*certFile, *keyFile); err != nil {
		log.Println("failed to start webtransport h3 server:", err)
	}
}

func handleWebTransport(session *webtransport.Session) {
	// Handle streams within the session
	for {
		stream, err := session.AcceptStream(context.Background())
		if err != nil {
			log.Println("Error accepting stream:", err)
			return
		}

		go handleStream(stream)
	}
}

func handleStream(stream webtransport.Stream) {
	for {
		// Handle incoming data on the stream
		data := make([]byte, 4096)
		n, err := stream.Read(data)
		if err != nil {
			log.Println("Error reading from stream:", err)
			return
		}

		log.Println("got packet", data[:n])

		// Echo the data back to the client
		_, err = stream.Write(data[:n])
		if err != nil {
			log.Println("Error writing to stream:", err)
			return
		}
	}
}
