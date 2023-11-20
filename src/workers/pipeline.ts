import { EncoderConfig, WorkerData } from ".";
import { Decoder } from "./decoder";
import { Encoder } from "./encoder";


const DefaultConfig: VideoEncoderConfig = {
    codec: 'vp8',
    width: 640,
    height: 480,
    bitrate: 2_000_000, // 2 Mbps
    framerate: 60,
}

class Pipeline {
    public encoder?: Encoder;
    public decoder?: Decoder;
    private config: VideoEncoderConfig;
    private started: boolean;
    private totalFrames: number;
    private keyFramePending: boolean;

    constructor() {
        this.config = DefaultConfig
        this.started = false;
        this.totalFrames = 0;
        this.keyFramePending = false;
        self.postMessage({ type: 'log', data: "pipeline is initialized..." })
    }

    public initEncoder({ config, source }: EncoderConfig) {
        this.encoder = new Encoder(config ?? this.config, source, this.onEncodedChunk.bind(this));
        self.postMessage({ type: 'log', data: "encoder created and inited" })
    }

    public initDecoder() {
        this.decoder = new Decoder({
            codec: this.config.codec,
            codedHeight: this.config.height,
            codedWidth: this.config.width,
        }, this.onDecodedFrame.bind(this))
        self.postMessage({ type: 'log', data: "decoder created and inited" })
        this.started = true;
        this.keyFramePending = true;
        this.encoder?.getKeyFrame()
        setInterval(() => {
            self.postMessage({
                type: 'metrics', data: {
                    totalFrames: this.totalFrames
                }
            })
        }, 2000)
    }

    public onEncodedChunk(chunk: EncodedVideoChunk) {
        if (!this.started) {
            return
        }
        if (this.keyFramePending && chunk.type !== 'key') {
            return
        }
        // self.postMessage({ type: 'log', data: 'got encoded chunk, trying to decode...' })
        this.decoder?.decode(chunk)
        this.keyFramePending = false
    }

    public async onDecodedFrame(frame: VideoFrame) {
        // self.postMessage({ type: 'log', data: 'frames decoded, sending to main thread...' })
        this.totalFrames += 1;
        self.postMessage({ type: 'media', data: frame })
        frame.close()
    }

    public encode(chunk: VideoFrame) {
        // self.postMessage({ type: 'log', data: 'got video frame for encoding...' })
        this.encoder?.encode(chunk)
        chunk.close()
    }

}

let pipeline: Pipeline | undefined = undefined;


self.addEventListener('message', ({ data }: { data: WorkerData }) => {
    switch (data.type) {
        case 'init':
            pipeline = new Pipeline()
            break;
        case 'init-encoder':
            if (pipeline?.encoder) {
                return
            }
            pipeline?.initEncoder(data.data as EncoderConfig)
            break;
        case 'init-decoder':
            if (pipeline?.decoder) {
                return
            }
            pipeline?.initDecoder()
            break
        case 'media':
            pipeline?.encode(data.data as VideoFrame)
            break
        default:
            break;
    }
})