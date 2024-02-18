import { decimalToBytes } from "./utils";

export type TransportDirection = 'send' | 'recv';
export class Transport {
  private transport: WebTransport;
  private mediaStream?: WritableStream<Uint8Array>;
  private pingStream?: WebTransportBidirectionalStream;
  private pingTimer?: NodeJS.Timeout;
  public direction: TransportDirection;
  public readable: ReadableStream<Uint8Array>

  constructor(direction: TransportDirection, url: string, fingerprint: Uint8Array) {
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
    }).finally(this.close.bind(this))

    this.readable = new ReadableStream({
      start: this.start.bind(this),
      cancel: this.cancel.bind(this),
    })
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
  }


  async send(pkt: Uint8Array, reset: boolean) {
    if (reset || !this.mediaStream) {
      this.mediaStream?.close()
      this.mediaStream = await this.transport.createUnidirectionalStream();
    }
    const buffer = new Uint8Array(pkt.length + 4)
    const pktLen = decimalToBytes(pkt.length)
    buffer.set(pktLen, 0)
    buffer.set(pkt, 4)
    // console.log("got packet to write, buffer:", buffer, "pkt", pkt, "pktLen:", pktLen);
    let chunkSize = 2048
    if (buffer.length > chunkSize) {
      // Send the message in chunks of 1024 bytes
      for (let i = 0; i < buffer.length; i += chunkSize) {
        let end = i + chunkSize
        if (end > buffer.length) {
          end = buffer.length
        }
        const chunk = buffer.slice(i, end)
        // console.debug("sending chunk of size:", chunk.length, "from:", i, "to:", end);
        const writer = this.mediaStream.getWriter() as WritableStreamDefaultWriter<Uint8Array>;
        await this._send(writer, chunk)
      }
    } else {
      const writer = this.mediaStream.getWriter() as WritableStreamDefaultWriter<Uint8Array>;
      await this._send(writer, buffer)
    }
  }

  async _send(writer: WritableStreamDefaultWriter<Uint8Array>, pkt: Uint8Array) {
    await writer.ready;
    // console.log("writer is ready to write");
    await writer.write(pkt);
    // console.log("packet written..");
    await writer.ready
    // console.log("releasing the writer lock");
    writer.releaseLock()
    // console.log("writer lock released..");
  }

  // async handleIncomingMediaPackets() {
  //   const reader = this.transport.incomingUnidirectionalStreams.getReader();
  //   while (true) {
  //     // value is readable stream
  //     const { done, value } = await reader.read();
  //     if (done) {
  //       break;
  //     }
  //     this.readFromStream(value)
  //   }
  // }

  async readFromStream(stream: ReadableStream<Uint8Array>, controller: ReadableStreamDefaultController<Uint8Array>) {
    const reader = stream.getReader()
    const value = await this.readAll(reader)
    // console.debug("len of incoming packet:", value.length, "value:", value);
    reader.releaseLock()
    if (value.length > 0) {
      controller.enqueue(value.slice(4))
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

  // ref - https://github.com/kixelated/moq-js/blob/353bb7acc24cc0e38e33ab5dcf36c8a7102f1798/lib/transport/stream.ts#L46-L63
  async read(reader: ReadableStreamBYOBReader, dst: Uint8Array, offset: number, size: number): Promise<Uint8Array> {
    while (offset < size) {
      const empty = new Uint8Array(dst.buffer, dst.byteOffset + offset, size - offset)
      const { value, done } = await reader.read(empty)
      if (done) {
        throw new Error(`short buffer`)
      }

      dst = new Uint8Array(value.buffer, value.byteOffset - offset)
      offset += value.byteLength
    }

    reader.releaseLock()

    return dst
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

  async start(controller: ReadableStreamDefaultController<Uint8Array>) {
    if (this.direction !== 'recv') {
      return
    }
    console.log("starting reading incoming streams", this, this.transport);
    const reader = this.transport.incomingUnidirectionalStreams.getReader();
    while (true) {
      // value is readable stream
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      this.readFromStream(value, controller)
    }
  }

  cancel(reason?: any): void {
    this.transport.close({ reason })
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
