import { Packetizer, Sequencer } from "./packet"
import { Encoder as VideoEncoder } from "./encoder/video"
import { Transport } from "./transport"

const DefaultVideoEncoderConfig: VideoEncoderConfig = {
    codec: 'vp8',
    width: 640,
    height: 480,
    bitrate: 1_000_000, // 1 Mbps
    framerate: 30,
    latencyMode: 'realtime',
}

export class VideoStream extends ReadableStream<Uint8Array> {
    track: MediaStreamVideoTrack
    trackProcessor: MediaStreamTrackProcessor<VideoFrame>
    encoder: VideoEncoder
    packetizer: Packetizer
    transport: Transport

    #sink: WritableStream<{ keyframe: boolean, data: Uint8Array }>

    constructor(track: MediaStreamVideoTrack, transport: Transport) {
        super()
        this.track = track
        this.trackProcessor = new MediaStreamTrackProcessor({ track })
        this.encoder = new VideoEncoder(DefaultVideoEncoderConfig)
        this.packetizer = new Packetizer()
        this.#sink = new WritableStream({
            write: this.#write.bind(this)
        })
        this.transport = transport
    }

    start() {
        return this.trackProcessor.readable
            .pipeThrough(this.encoder.frames)
            .pipeThrough(this.packetizer.buffer)
            .pipeTo(this.#sink)
    }

    #write(chunk: { keyframe: boolean, data: Uint8Array }) {
        console.log("got packet to send,pkt:", chunk);
        this.transport.send(chunk.data, chunk.keyframe).catch((e) => {
            console.error("failed to send packets over webtransport, error:", e.message);
            this.cancel("failed to send packet")
        })
    }

}