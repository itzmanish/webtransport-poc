
export class Encoder extends TransformStream<VideoFrame, EncodedVideoChunk> {
    private encoderConfig: VideoEncoderConfig;
    private decoderConfig?: VideoDecoderConfig;
    private encoder!: VideoEncoder;

    public keyframe: boolean;
    public keyframeCount: number;
    public frames: TransformStream<VideoFrame, EncodedVideoChunk>

    get codecState() {
        return this.encoder.state
    }

    get config() {
        return this.encoderConfig
    }

    constructor(config: VideoEncoderConfig) {
        super()
        this.encoderConfig = config
        this.keyframe = false
        this.keyframeCount = 0
        this.frames = new TransformStream({
            start: this.start.bind(this),
            transform: this.transform.bind(this),
            flush: this.flush.bind(this)
        })
    }

    private start(controller: TransformStreamDefaultController<EncodedVideoChunk>) {
        console.log("encoder starting...");
        this.encoder = new VideoEncoder({
            output: (frame, metadata) => {
                this.enqueue(controller, frame, metadata)
            },
            error: this.onError.bind(this)
        })
        this.encoder.configure(this.config)
    }

    private transform(frame: VideoFrame) {
        const encoder = this.encoder
        encoder.encode(frame, { keyFrame: this.keyframe })
        this.keyframe = false
        frame.close()
    }

    private flush() {
        console.log('encoder: flusing..');
        this.encoder.close()
    }

    private enqueue(controller: TransformStreamDefaultController<EncodedVideoChunk>, frame: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) {
        if (!this.decoderConfig) {
            const config = metadata?.decoderConfig
            if (!config) {
                throw new Error('missing decoder config')
            }
            this.decoderConfig = config
        }
        if (frame.type === 'key') {
            this.keyframeCount += 1
        }
        controller.enqueue(frame)
    }

    private onError(error: Error) {
        throw error;
    }

    public get_keyframe() {
        this.keyframe = true
    }

}