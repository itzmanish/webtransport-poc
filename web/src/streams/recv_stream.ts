import { DePacketizer, MediaPacket, Packetizer } from "../packet"
import { Decoder as VideoDecoder } from "../decoder/video"
import { Transport } from "../transport"
import { VideoTrack } from "../track"

const DefaultVideoEncoderConfig: VideoEncoderConfig = {
    codec: 'vp8',
    width: 640,
    height: 480,
    bitrate: 1_000_000, // 1 Mbps
    framerate: 30,
    latencyMode: 'realtime',
}

export class VideoRecvStream {
    ssrc: number
    track: VideoTrack
    decoder: VideoDecoder
    dePacketizer: DePacketizer
    transport: Transport

    buffer: TransformStream<MediaPacket, EncodedVideoChunk>

    constructor(ssrc: number, config: VideoDecoderConfig, transport: Transport) {
        this.ssrc = ssrc
        this.track = new VideoTrack("random")
        this.decoder = new VideoDecoder(config)
        this.dePacketizer = new DePacketizer(this.ssrc)
        this.buffer = new TransformStream({
            transform: this.#transform.bind(this),
        })
        this.transport = transport
        this.transport.readable
            .pipeThrough(this.dePacketizer.buffer)
            .pipeThrough(this.buffer)
            .pipeThrough(this.decoder.frames)
            .pipeTo(this.track.writable)
    }

    #transform(chunk: MediaPacket, controller: TransformStreamDefaultController<EncodedVideoChunk>) {
        if (chunk.ssrc !== this.ssrc) {
            return
        }
        if (chunk.chunk) controller.enqueue(chunk.chunk)
    }


}