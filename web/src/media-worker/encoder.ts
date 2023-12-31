import { isEmpty } from "../utils";

export class Encoder {
    private encoder: VideoEncoder;
    private config: VideoEncoderConfig;
    private keyframe: boolean;
    private source: ReadableStream<VideoFrame>;
    private onEncoded: (chunk: EncodedVideoChunk) => void;

    public constructor(config: VideoEncoderConfig, source: ReadableStream<VideoFrame>, onEncode: (_: EncodedVideoChunk) => void) {
        this.encoder = new VideoEncoder({
            output: this.onEncodedPackets.bind(this),
            error: this.onError.bind(this),
        })
        this.config = config
        this.encoder.configure(config)
        this.keyframe = true
        this.source = source
        this.onEncoded = onEncode
        this.readAndEncode()
    }

    public getKeyFrame() {
        this.keyframe = true;
    }

    public encode(chunk: VideoFrame) {
        this.encoder.encode(chunk, { keyFrame: this.keyframe });
        if (this.keyframe) {
            this.keyframe = false
        }
    }

    public onEncodedPackets(chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) {
        if (metadata && !isEmpty(metadata)) {
            self.postMessage({ type: 'log', data: `got metadata: ${JSON.stringify(metadata, null, 2)}` })
        }
        this.onEncoded(chunk)
    }

    public onError(error: Error) {
        throw error;
    }

    private async readAndEncode() {
        const reader = this.source.getReader()
        const result = await reader.read()
        // App handling for stream closure.
        if (result.done)
            return;
        //   self.postMessage({ type: 'media', data: result.value })
        this.encode(result.value)
        result.value.close()
        reader.releaseLock()
        // Keep reading until the stream closes.
        this.readAndEncode();
    }
}

