
export class Decoder {
    private config: VideoDecoderConfig;
    private decoder!: VideoDecoder;
    private keyFramePending: boolean;

    public frames: TransformStream<EncodedVideoChunk, VideoFrame>

    get codecState() {
        return this.decoder.state
    }

    constructor(config: VideoDecoderConfig) {
        this.config = config
        this.keyFramePending = true
        this.frames = new TransformStream({
            start: this.start.bind(this),
            transform: this.transform.bind(this),
            flush: this.flush.bind(this)
        })
    }

    private start(controller: TransformStreamDefaultController<VideoFrame>) {
        this.decoder = new VideoDecoder({
            output: (data: VideoFrame) => {
                this.enqueue(controller, data)
            },
            error: this.onError.bind(this)
        })
        this.decoder.configure(this.config)
    }

    private transform(chunk: EncodedVideoChunk) {
        if (this.keyFramePending && chunk.type !== 'key') {
            return
        }
        if (chunk.type === 'key') this.keyFramePending = false
        const decoder = this.decoder
        decoder.decode(chunk)
    }

    private flush() {
        this.decoder.close()
    }

    private enqueue(controller: TransformStreamDefaultController<VideoFrame>, frame: VideoFrame) {
        controller.enqueue(frame)
    }

    private onError(error: Error) {
        throw error;
    }


}