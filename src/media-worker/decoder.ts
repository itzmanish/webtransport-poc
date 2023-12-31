
export class Decoder {
    private config: VideoDecoderConfig;
    private decoder: VideoDecoder;
    private onFrame: (frame: VideoFrame) => void;

    get codecState() {
        return this.decoder.state
    }

    constructor(config: VideoDecoderConfig, onFrame: (frame: VideoFrame) => void) {
        this.config = config
        this.decoder = new VideoDecoder({
            output: this.processVideoFrame.bind(this),
            error: this.onError.bind(this),
        })
        this.decoder.configure(config)
        this.onFrame = onFrame
    }

    public processVideoFrame(frame: VideoFrame) {
        this.onFrame(frame)
        frame.close()
    }

    public async decode(chunk: EncodedVideoChunk) {
        this.decoder.decode(chunk)
        // if (chunk.type === 'key') {
        //     await this.decoder.flush()
        // }
    }

    public onError(error: Error) {
        throw error;
    }
}