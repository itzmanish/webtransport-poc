
export class Encoder extends TransformStream {
    private encoderConfig: AudioEncoderConfig;
    private decoderConfig?: AudioDecoderConfig;
    private encoder!: AudioEncoder;

    public frames: TransformStream<AudioData, EncodedAudioChunk | AudioDecoderConfig>

    get codecState() {
        return this.encoder.state
    }

    get config() {
        return this.encoderConfig
    }

    constructor(config: AudioEncoderConfig) {
        super()
        this.encoderConfig = config
        this.frames = new TransformStream({
            start: this.start.bind(this),
            transform: this.transform.bind(this),
            flush: this.flush.bind(this)
        })
    }

    private start(controller: TransformStreamDefaultController<EncodedAudioChunk | AudioDecoderConfig>) {
        this.encoder = new AudioEncoder({
            output: (frame, metadata) => {
                this.enqueue(controller, frame, metadata)
            },
            error: this.onError.bind(this)
        })
        this.encoder.configure(this.config)
    }

    private transform(frame: AudioData) {
        const encoder = this.encoder

        encoder.encode(frame)
        frame.close()
    }

    private flush() {
        this.encoder.close()
    }

    private enqueue(controller: TransformStreamDefaultController<EncodedAudioChunk | AudioDecoderConfig>, frame: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata) {
        if (!this.decoderConfig) {
            const config = metadata?.decoderConfig
            if (!config) {
                throw new Error('missing decoder config')
            }
            controller.enqueue(config)
            this.decoderConfig = config
        }

        controller.enqueue(frame)
    }

    private onError(error: Error) {
        throw error;
    }


}