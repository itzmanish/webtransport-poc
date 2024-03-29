import { Packetizer } from "../packet"
import { Encoder as VideoEncoder } from "../encoder/video"
import { Transport } from "../transport"
import { generateSsrc } from "../utils"

const DefaultVideoEncoderConfig: VideoEncoderConfig = {
    codec: 'vp8',
    width: 640,
    height: 480,
    bitrate: 1_000_000, // 1 Mbps
    framerate: 30,
    latencyMode: 'realtime',
}

export class VideoSendStream {
    ssrc: number
    track: MediaStreamVideoTrack
    trackProcessor: MediaStreamTrackProcessor<VideoFrame>
    encoder: VideoEncoder
    packetizer: Packetizer
    transport: Transport

    #sink: WritableStream<{ keyframe: boolean, data: Uint8Array }>

    constructor(track: MediaStreamVideoTrack, transport: Transport) {
        this.ssrc = generateSsrc()
        this.track = track
        this.trackProcessor = new MediaStreamTrackProcessor({ track })
        this.encoder = new VideoEncoder(DefaultVideoEncoderConfig)
        this.packetizer = new Packetizer(this.ssrc)
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
        // console.log("got packet to send for ssrc:%d, pkt:%o", this.ssrc, chunk);
        this.transport.send(chunk.data, chunk.keyframe).catch((e) => {
            console.error("failed to send packets over webtransport, error:", e.message);
        })
    }
}