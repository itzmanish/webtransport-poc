import { EventEmitter } from "events";

export class Transport extends EventEmitter {
  private transport: WebTransport;
  private mediaStream?: WebTransportBidirectionalStream;
  private pingStream?: WebTransportBidirectionalStream;
  private pingTimer?: number;

  constructor(url: string, fingerprint: Uint8Array) {
    super();
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
    this.connectMediaStream()
    this.startPingPongLoop()
  }

  async connectMediaStream() {
    const stream = await this.transport.createBidirectionalStream();
    this.mediaStream = stream;
    this.handleIncomingMediaPackets();
  }

  async send(pkt: Uint8Array) {
    // if (!this.mediaStream) {
    //   await this.connectMediaStream()
    // }
    const writer =
      this.mediaStream?.writable.getWriter() as WritableStreamDefaultWriter<Uint8Array>;
    return this._send(writer, pkt)
  }

  async _send(writer: WritableStreamDefaultWriter<Uint8Array>, pkt: Uint8Array) {
    await writer.ready;
    console.log("writer is ready to write");
    await writer.write(pkt);
    console.log("packet written..");
    await writer.ready;
    console.log("releasing the writer lock");
    writer.releaseLock();
    console.log("writer lock released..");
  }

  async handleIncomingMediaPackets() {
    const reader = this.mediaStream!.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      console.log("got media packet from server:", value);

      // value is an instance of Uint8Array
      this.emit("packet", value);
    }
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
