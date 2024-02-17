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
 * seq_num = 32 bit (4 byte)
 * timestamp = 32 bit (4 byte)
 * duration = 32 bit (4 byte)
 * data = remaining space
 *
 * total size of each EncodedVideoChunk = 1024 byte
 * 
 */

export class MediaPacket {
    chunk?: EncodedVideoChunk
    seq_num?: number

    constructor(chunk?: EncodedVideoChunk, seq_num?: number) {
        this.chunk = chunk
        this.seq_num = seq_num
    }

    get length() {
        return 1 + 4 + 4 + 4 + this.chunk!.byteLength
    }

    public toBytes() {
        if (!this.chunk || !this.seq_num) {
            throw new Error('packet is not initialized with chunk or seq number')
        }
        // Calculate the size of the message buffer
        // type + timestamp + duration + payload
        const messageBuffer = new ArrayBuffer(1 + 4 + 4 + 4 + this.chunk.byteLength);

        // Create a DataView to write into the buffer
        const dataView = new DataView(messageBuffer);

        // Write metadata into the buffer
        dataView.setUint8(0, this.chunk.type === 'key' ? 1 : 0);
        dataView.setUint32(1, this.seq_num, true)
        dataView.setUint32(5, this.chunk.timestamp, true);
        dataView.setUint32(9, this.chunk.duration!, true);

        // Write binary data into the buffer
        const dataArray = new Uint8Array(messageBuffer);
        const tempBuffer = new Uint8Array(this.chunk.byteLength)
        this.chunk.copyTo(tempBuffer)
        dataArray.set(tempBuffer, 13);
        return dataArray;
    }

    public fromBytes(msg: Uint8Array) {
        // Parse metadata from the buffer
        const dataView = new DataView(msg.buffer);
        const type = dataView.getUint8(0) === 1 ? 'key' : 'delta';
        const seq_num = dataView.getUint32(1, true)
        const timestamp = dataView.getUint32(5, true);
        const duration = dataView.getUint32(9, true);

        // Extract binary data from the buffer
        const payload = msg.slice(13);

        // console.log('seq_num', seq_num, "timestamp:", timestamp, 'duration:', duration, 'type:', type);

        this.seq_num = seq_num
        this.chunk = new EncodedVideoChunk({
            data: payload,
            timestamp,
            duration,
            type
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
    sequencer: Sequencer
    buffer: TransformStream<EncodedVideoChunk, { keyframe: boolean, data: Uint8Array }>

    constructor() {
        this.sequencer = new Sequencer()
        this.buffer = new TransformStream({
            transform: this.#transform.bind(this)
        })
    }

    #transform(chunk: EncodedVideoChunk, controller: TransformStreamDefaultController<{ keyframe: boolean, data: Uint8Array }>) {
        const pkt = new MediaPacket(chunk, this.sequencer.get_seq_number())
        controller.enqueue({ keyframe: pkt.chunk?.type === 'key', data: pkt.toBytes() })
    }

}