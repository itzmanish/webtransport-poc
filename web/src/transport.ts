import { EventEmitter } from "events";

export type TransportDirection = 'send' | 'recv';
export class Transport extends EventEmitter {
  private transport: WebTransport;
  private pingStream?: WebTransportBidirectionalStream;
  private pingTimer?: NodeJS.Timeout;
  public direction: TransportDirection;

  constructor(direction: TransportDirection, url: string, fingerprint: Uint8Array) {
    super();
    this.direction = direction;
    this.transport = new WebTransport(url, {
      serverCertificateHashes: [
        {
          algorithm: "sha-256",
          value: fingerprint,
        },
      ],
    });
    this.transport.closed.then(() => {
      console.log(`The HTTP/3 connection to ${url} closed gracefully.`);
    }).catch((e) => {
      console.error("error on closing:", e)
    }).finally(this.close)
  }

  get ready() {
    return this.transport.ready;
  }

  close() {
    if (this.pingTimer) {
      clearTimeout(this.pingTimer)
    }
    console.log("transport closed..");
  }

  async init() {
    await this.ready;

    if (this.direction === 'recv') {
      this.handleIncomingMediaPackets()
    }
    // this.startPingPongLoop()
  }


  async send(pkt: Uint8Array) {
    const stream = await this.transport.createUnidirectionalStream();
    let chunkSize = 2048 // 4 bytes is for length prefix
    if (pkt.length > chunkSize) {
      console.debug("doing chunking of packet");
      // Send the message in chunks of 1024 bytes
      for (let i = 0; i < pkt.length; i += chunkSize) {
        let end = i + chunkSize
        if (end > pkt.length) {
          end = pkt.length
        }
        const chunk = pkt.slice(i, end)
        // chunk.set(decimalToBytes(pkt.length), 0)
        console.debug("sending chunk of size:", chunk.length, "from:", i, "to:", end);
        const writer = stream.getWriter() as WritableStreamDefaultWriter<Uint8Array>;
        await this._send(writer, chunk)
      }
    } else {
      const writer = stream.getWriter() as WritableStreamDefaultWriter<Uint8Array>;
      await this._send(writer, pkt)
    }
    await stream.close()
  }

  async _send(writer: WritableStreamDefaultWriter<Uint8Array>, pkt: Uint8Array) {
    await writer.ready;
    console.log("writer is ready to write");
    await writer.write(pkt);
    // console.log("packet written..");
    await writer.ready;
    // console.log("releasing the writer lock");
    writer.releaseLock();
    // console.log("writer lock released..");
  }

  async handleIncomingMediaPackets() {
    const reader = this.transport.incomingUnidirectionalStreams.getReader();
    while (true) {
      // value is readable stream
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      this.readFromStream(value)
    }
  }

  async readFromStream(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader()
    const value = await this.readAll(reader)
    console.debug("len of incoming packet:", value.length);
    reader.releaseLock()
    if (value.length > 0) {
      this.emit('packet', value)
    }
  }

  async readAll(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<Uint8Array> {
    let buf = new Uint8Array(0)
    for (; ;) {
      const { value, done } = await reader.read()
      if (done) break

      if (buf.byteLength > 0) {
        const append = new Uint8Array(buf.byteLength + value.byteLength)
        append.set(buf)
        append.set(value, buf.byteLength)
        buf = append
      } else {
        buf = value
      }
    }
    return buf
  }

  async receiveBidirectional() {
    const reader = this.transport.incomingBidirectionalStreams.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      console.log("received bidirection stream initiated by server");

      // value is an instance of WebTransportBidirectionalStream
      // await readData(value.readable);
    }
  }


  // Ping Pong handlers
  private async startPingPongLoop() {
    if (this.pingTimer) {
      clearTimeout(this.pingTimer)
    }
    this.pingStream = await this.transport.createBidirectionalStream()
    this.pongHandlerLoop()
    this.pingLoop()
  }

  private async pingLoop() {
    const pingFn = () => {
      console.log("sending ping message..");
      this._send(this.pingStream!.writable.getWriter(), new Uint8Array([1])).catch(e => {
        console.error("failed to send ping message", e);
      })
      this.pingLoop()
    }
    this.pingTimer = setTimeout(pingFn, 5000)
  }

  private async pongHandlerLoop() {
    const reader = this.pingStream!.readable.getReader()
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      console.log("got pong response:", value);
    }
  }
}
