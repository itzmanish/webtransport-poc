/**
 * 
 * interface EncodedVideoChunk {
 *  readonly duration: number | null; // int64
 *  readonly timestamp: number; // int64
 *  readonly type: EncodedVideoChunkType; // 'key' | 'delta'
 *  readonly data: BufferSource; // [uint8]
 * }
 * 
 * space taken for network transmit for EncodedVideoChunk
 * type = 8 bit // key => 1, delta => 0
 * seq_num = 16 bit (2 byte)
 * timestamp = 32 bit (4 byte)
 * ssrc = 32 bit (4 byte)
 * duration = 32 bit (4 byte)
 * data = remaining space
 *
 * total size of each EncodedVideoChunk = 1024 byte
 * 
 */


const sizeMap = {
    type: 1,
    seq_num: 2,
    timestamp: 4,
    ssrc: 4,
    duration: 4,
}

export class MediaPacket {
    ssrc?: number
    chunk?: EncodedVideoChunk
    seq_num?: number

    constructor(chunk?: EncodedVideoChunk, seq_num?: number, ssrc?: number) {
        this.chunk = chunk
        this.seq_num = seq_num
        this.ssrc = ssrc
    }

    get length() {
        return 1 + 2 + 4 + 4 + 4 + this.chunk!.byteLength
    }

    public toBytes() {
        if (!this.chunk || !this.seq_num || !this.ssrc) {
            throw new Error('packet is not initialized with chunk,ssrc or seq number')
        }
        // Calculate the size of the message buffer
        // type+ seq_num + timestamp+ssrc + duration + payload
        const messageBuffer = new ArrayBuffer(1 + 2 + 4 + 4 + 4 + this.chunk.byteLength);

        // Create a DataView to write into the buffer
        const dataView = new DataView(messageBuffer);

        // Write metadata into the buffer
        dataView.setUint8(0, this.chunk.type === 'key' ? 1 : 0);
        dataView.setUint16(1, this.seq_num, true)
        dataView.setUint32(3, this.chunk.timestamp, true)
        dataView.setUint32(7, this.ssrc, true);
        dataView.setUint32(11, this.chunk.duration!, true);

        // Write binary data into the buffer
        const dataArray = new Uint8Array(messageBuffer);
        const tempBuffer = new Uint8Array(this.chunk.byteLength)
        this.chunk.copyTo(tempBuffer)
        dataArray.set(tempBuffer, 15);
        return dataArray;
    }

    public fromBytes(msg: Uint8Array) {
        // Parse metadata from the buffer
        const dataView = new DataView(msg.buffer);
        const type = dataView.getUint8(0) === 1 ? 'key' : 'delta';
        const seq_num = dataView.getUint16(1, true)
        const timestamp = dataView.getUint32(3, true);
        const ssrc = dataView.getUint32(7, true);
        const duration = dataView.getUint32(11, true);

        // Extract binary data from the buffer
        const payload = msg.slice(15);

        // console.log('seq_num', seq_num, "timestamp:", timestamp, 'duration:', duration, 'type:', type, 'ssrc:', ssrc);

        this.seq_num = seq_num
        this.ssrc = ssrc
        this.chunk = new EncodedVideoChunk({
            data: payload,
            timestamp,
            duration,
            type,
        })
    }
}

export class Sequencer {
    seq_number: number

    constructor() {
        this.seq_number = 0
    }

    get_seq_number() {
        this.seq_number += 1
        return this.seq_number
    }

    get last_seq_number() {
        return this.seq_number
    }
}

export class Packetizer {
    ssrc: number
    sequencer: Sequencer
    buffer: TransformStream<EncodedVideoChunk, { keyframe: boolean, data: Uint8Array }>

    constructor(ssrc: number) {
        this.ssrc = ssrc
        this.sequencer = new Sequencer()
        this.buffer = new TransformStream({
            transform: this.#transform.bind(this)
        })
    }

    #transform(chunk: EncodedVideoChunk, controller: TransformStreamDefaultController<{ keyframe: boolean, data: Uint8Array }>) {
        const pkt = new MediaPacket(chunk, this.sequencer.get_seq_number(), this.ssrc)
        controller.enqueue({ keyframe: pkt.chunk?.type === 'key', data: pkt.toBytes() })
    }

}

export class DePacketizer {
    ssrc: number
    buffer: TransformStream<Uint8Array, MediaPacket>

    constructor(ssrc: number) {
        this.ssrc = ssrc
        this.buffer = new TransformStream({
            transform: this.#transform.bind(this)
        })
    }

    #transform(chunk: Uint8Array, controller: TransformStreamDefaultController<MediaPacket>) {
        const pkt = new MediaPacket()
        pkt.fromBytes(chunk)
        controller.enqueue(pkt)
    }

}