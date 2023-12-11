
export class Decoder {
    private config: VideoDecoderConfig;
    private decoder: VideoDecoder;
    private onFrame: (frame: VideoFrame) => void;

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

    public decode(chunk: EncodedVideoChunk) {
        this.decoder.decode(chunk)
    }

    public onError(error: Error) {
        throw error;
    }
}