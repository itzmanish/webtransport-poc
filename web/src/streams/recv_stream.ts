import { DePacketizer, MediaPacket, Packetizer } from "../packet"
import { Decoder as VideoDecoder } from "../decoder/video"
import { Decoder as AudioDecoder } from "../decoder/audio"
import { Transport } from "../transport"
import { AudioTrack, VideoTrack } from "../track"


export class VideoRecvStream {
    ssrc: number
    track: VideoTrack
    decoder: VideoDecoder
    dePacketizer: DePacketizer<EncodedVideoChunk>
    transport: Transport

    buffer: TransformStream<MediaPacket<EncodedVideoChunk>, EncodedVideoChunk>

    constructor(ssrc: number, config: VideoDecoderConfig, transport: Transport) {
        this.ssrc = ssrc
        this.track = new VideoTrack(`video_${ssrc}`)
        this.decoder = new VideoDecoder(config)
        this.dePacketizer = new DePacketizer(this.ssrc)
        this.buffer = new TransformStream({
            transform: this.#transform.bind(this),
        })
        this.transport = transport
        this.transport.videoReadable
            .pipeThrough(this.dePacketizer.buffer)
            .pipeThrough(this.buffer)
            .pipeThrough(this.decoder.frames)
            .pipeTo(this.track.writable)
    }

    #transform(chunk: MediaPacket<EncodedVideoChunk>, controller: TransformStreamDefaultController<EncodedVideoChunk>) {
        if (chunk.ssrc !== this.ssrc) {
            return
        }
        if (chunk.chunk) controller.enqueue(chunk.chunk)
    }


}

export class AudioRecvStream {
    ssrc: number
    track: AudioTrack
    decoder: AudioDecoder
    dePacketizer: DePacketizer<EncodedAudioChunk>
    transport: Transport

    buffer: TransformStream<MediaPacket<EncodedAudioChunk>, EncodedAudioChunk>

    constructor(ssrc: number, config: AudioDecoderConfig, transport: Transport) {
        this.ssrc = ssrc
        this.track = new AudioTrack(`audio_${ssrc}`)
        this.decoder = new AudioDecoder(config)
        this.dePacketizer = new DePacketizer(this.ssrc)
        this.buffer = new TransformStream({
            transform: this.#transform.bind(this),
        })
        this.transport = transport
        this.transport.audioReadable
            .pipeThrough(this.dePacketizer.buffer)
            .pipeThrough(this.buffer)
            .pipeThrough(this.decoder.frames)
            .pipeTo(this.track.writable)
    }

    #transform(chunk: MediaPacket<EncodedAudioChunk>, controller: TransformStreamDefaultController<EncodedVideoChunk>) {
        if (chunk.ssrc !== this.ssrc) {
            return
        }
        if (chunk.chunk) controller.enqueue(chunk.chunk)
    }


}