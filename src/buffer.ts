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
 * timestamp = 32 bit (4 byte)
 * duration = 32 bit (4 byte)
 * data = remaining space
 *
 * total size of each EncodedVideoChunk = 1024 byte
 * 
 */

export class MediaPacket {
    static toBytes = (chunk: EncodedVideoChunk) => {
        // Calculate the size of the message buffer
        // type + timestamp + duration + payload
        const messageBuffer = new ArrayBuffer(1 + 4 + 4 + chunk.byteLength);

        // Create a DataView to write into the buffer
        const dataView = new DataView(messageBuffer);

        // Write metadata into the buffer
        dataView.setUint8(0, chunk.type === 'key' ? 1 : 0);
        dataView.setUint32(1, chunk.timestamp, true);
        dataView.setUint32(5, chunk.duration!, true);

        // Write binary data into the buffer
        const dataArray = new Uint8Array(messageBuffer);
        const tempBuffer = new Uint8Array(chunk.byteLength)
        chunk.copyTo(tempBuffer)
        dataArray.set(tempBuffer, 9);
        return dataArray;
    }

    static fromBytes = (msg: Uint8Array): EncodedVideoChunk => {
        // Parse metadata from the buffer
        const dataView = new DataView(msg.buffer);
        const type = dataView.getUint8(0) === 1 ? 'key' : 'delta';
        const timestamp = dataView.getUint32(1, true);
        const duration = dataView.getUint32(5, true);

        // Extract binary data from the buffer
        const payload = msg.slice(9);

        console.log("timestamp:", timestamp, 'duration:', duration, 'type:', type);

        return new EncodedVideoChunk({
            data: payload,
            timestamp,
            duration,
            type
        })
    }
}