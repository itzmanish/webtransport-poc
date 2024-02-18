
export class Decoder extends TransformStream {
    private config: AudioDecoderConfig;
    private decoder!: AudioDecoder;

    public frames: TransformStream<EncodedAudioChunk, AudioData>

    get codecState() {
        return this.decoder.state
    }

    constructor(config: AudioDecoderConfig) {
        super()
        this.config = config
        this.frames = new TransformStream({
            start: this.start.bind(this),
            transform: this.transform.bind(this),
            flush: this.flush.bind(this)
        })
    }

    private start(controller: TransformStreamDefaultController<AudioData>) {
        this.decoder = new AudioDecoder({
            output: (data: AudioData) => {
                this.enqueue(controller, data)
            },
            error: this.onError.bind(this)
        })
        this.decoder.configure(this.config)
    }

    private transform(chunk: EncodedAudioChunk) {
        const decoder = this.decoder

        decoder.decode(chunk)
    }

    private flush() {
        this.decoder.close()
    }

    private enqueue(controller: TransformStreamDefaultController<AudioData>, frame: AudioData) {
        controller.enqueue(frame)
    }

    private onError(error: Error) {
        throw error;
    }


}