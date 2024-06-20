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
    payloadType: 1,
    type: 1,
    seq_num: 2,
    timestamp: 4,
    ssrc: 4,
    duration: 4,
}

export class MediaPacket<T extends EncodedAudioChunk | EncodedVideoChunk> {
    ssrc?: number
    chunk?: T
    seq_num?: number
    payloadType?: 'audio' | 'video'

    constructor(payloadType?: 'audio' | 'video', chunk?: T, seq_num?: number, ssrc?: number) {
        this.chunk = chunk
        this.seq_num = seq_num
        this.ssrc = ssrc
        this.payloadType = payloadType
    }

    get length() {
        return 1 + 1 + 2 + 4 + 4 + 4 + this.chunk!.byteLength
    }

    static getSSRC(payload: Uint8Array) {
        const dataView = new DataView(payload.buffer);
        return dataView.getUint16(2, true)
    }

    public toBytes() {
        if (!this.chunk || !this.seq_num || !this.ssrc) {
            throw new Error('packet is not initialized with chunk,ssrc or seq number')
        }
        // Calculate the size of the message buffer
        // payload_type +packet_type+ seq_num + timestamp+ssrc + duration + payload
        const messageBuffer = new ArrayBuffer(this.length);

        // Create a DataView to write into the buffer
        const dataView = new DataView(messageBuffer);

        // Write metadata into the buffer
        dataView.setUint8(0, this.payloadType === 'video' ? 1 : 0);
        dataView.setUint8(1, this.chunk.type === 'key' ? 1 : 0);
        dataView.setUint16(2, this.seq_num, true)
        dataView.setUint32(4, this.chunk.timestamp, true)
        dataView.setUint32(8, this.ssrc, true);
        dataView.setUint32(12, this.chunk.duration!, true);

        // Write binary data into the buffer
        const dataArray = new Uint8Array(messageBuffer);
        const tempBuffer = new Uint8Array(this.chunk.byteLength)
        this.chunk.copyTo(tempBuffer)
        dataArray.set(tempBuffer, 16);
        return dataArray;
    }

    public fromBytes(msg: Uint8Array) {
        // Parse metadata from the buffer
        const dataView = new DataView(msg.buffer);
        const payloadType = dataView.getUint8(0) === 1 ? 'video' : 'audio';
        const type = dataView.getUint8(1) === 1 ? 'key' : 'delta';
        const seq_num = dataView.getUint16(2, true)
        const timestamp = dataView.getUint32(4, true);
        const ssrc = dataView.getUint32(8, true);
        const duration = dataView.getUint32(12, true);

        // Extract binary data from the buffer
        const payload = msg.slice(16);

        // console.log('seq_num', seq_num, "timestamp:", timestamp, 'duration:', duration, 'type:', type, 'ssrc:', ssrc);

        this.payloadType = payloadType
        this.seq_num = seq_num
        this.ssrc = ssrc
        this.chunk = payloadType === 'video' ? new EncodedVideoChunk({
            data: payload,
            timestamp,
            duration,
            type,
        }) : new EncodedAudioChunk({
            data: payload,
            timestamp,
            type,
            duration
        }) as any
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

export class Packetizer<T extends EncodedAudioChunk | EncodedVideoChunk> {
    ssrc: number
    sequencer: Sequencer
    kind: "audio" | "video"
    buffer: TransformStream<T, { keyframe: boolean, data: Uint8Array }>

    constructor(ssrc: number, kind: 'audio' | 'video') {
        this.ssrc = ssrc
        this.sequencer = new Sequencer()
        this.buffer = new TransformStream<T>({
            transform: this.#transform.bind(this)
        })
        this.kind = kind
    }

    #transform(chunk: T, controller: TransformStreamDefaultController<{ keyframe: boolean, data: Uint8Array }>) {
        const pkt = new MediaPacket<T>(this.kind, chunk, this.sequencer.get_seq_number(), this.ssrc)
        controller.enqueue({ keyframe: pkt.chunk?.type === 'key', data: pkt.toBytes() })
    }

}

export class DePacketizer<T extends EncodedAudioChunk | EncodedVideoChunk> {
    ssrc: number
    buffer: TransformStream<Uint8Array, MediaPacket<T>>

    constructor(ssrc: number) {
        this.ssrc = ssrc
        this.buffer = new TransformStream({
            transform: this.#transform.bind(this)
        })
    }

    #transform(chunk: Uint8Array, controller: TransformStreamDefaultController<MediaPacket<T>>) {
        const pkt = new MediaPacket<T>()
        pkt.fromBytes(chunk)
        controller.enqueue(pkt)
    }

}