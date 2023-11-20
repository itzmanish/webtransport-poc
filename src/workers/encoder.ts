import { isEmpty } from "../utils";

export class Encoder {
    private encoder: VideoEncoder;
    private config: VideoEncoderConfig;
    private keyframe: boolean;
    private onEncoded: (chunk: EncodedVideoChunk) => void;

    public constructor(config: VideoEncoderConfig, onEncode: (_: EncodedVideoChunk) => void) {
        this.encoder = new VideoEncoder({
            output: this.onEncodedPackets.bind(this),
            error: this.onError.bind(this),
        })
        this.config = config
        this.encoder.configure(config)
        this.keyframe = true
        this.onEncoded = onEncode;
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



}

