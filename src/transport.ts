import { EventEmitter } from "events";

export class Transport extends EventEmitter {
  private transport: WebTransport;
  private bidiStream?: WebTransportBidirectionalStream;

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
  }

  get ready() {
    return this.transport.ready;
  }

  async connect() {
    const stream = await this.transport.createBidirectionalStream();
    this.bidiStream = stream;
    this.startIncomingPacketLoop();
  }

  async send(pkt: Uint8Array) {
    const writer =
      this.bidiStream?.writable.getWriter() as WritableStreamDefaultWriter<Uint8Array>;
    await writer.ready;
    await writer.write(pkt);
    await writer.ready;
    writer.releaseLock();
  }

  async startIncomingPacketLoop() {
    const reader = this.bidiStream!.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      // value is an instance of Uint8Array
      this.emit("incoming-packet", value);
    }
  }
}
