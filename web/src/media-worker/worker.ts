import { DecoderConfig, EncoderConfig, TransportConfig, WorkerData } from ".";
import { MediaPacket } from "../buffer";
import { Transport } from "../transport";
import { Decoder } from "./decoder";
import { Encoder } from "./encoder";


const DefaultConfig: VideoEncoderConfig = {
    codec: 'vp8',
    width: 640,
    height: 480,
    bitrate: 1_000_000, // 1 Mbps
    framerate: 30,
    latencyMode: 'realtime',
}

class MediaWorker {
    public encoder?: Encoder;
    public decoder?: Decoder;
    public sendTransport?: Transport;
    public recvTransport?: Transport;
    private config: VideoEncoderConfig;
    private started: boolean;
    private totalFrames: number;
    private keyFramePending: boolean;

    constructor() {
        this.config = DefaultConfig
        this.started = false;
        this.totalFrames = 0;
        this.keyFramePending = false;
        self.postMessage({ type: 'log', data: "mediaWorker is initialized" })
    }

    public async initTransport({ direction, url, fingerprint }: TransportConfig) {
        if ((direction === 'recv' && this.recvTransport) || (direction === 'send' && this.sendTransport)) {
            return
        }
        console.debug("initializing transport with url:", url, "direction:", direction)
        const transport = new Transport(direction, url, fingerprint)
        await transport.init()
        if (direction === 'recv') {
            console.debug("adding packet handler listener on recv transport");
            transport.on('packet', this.handleIncomingPackets.bind(this))
            this.recvTransport = transport
        } else {
            this.sendTransport = transport
        }
        self.postMessage({ type: 'log', data: 'webtransport initialized' })
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

    public async onEncodedChunk(chunk: EncodedVideoChunk) {
        if (!this.started) {
            return
        }
        if (this.keyFramePending && chunk.type !== 'key') {
            return
        }
        if (this.decoder?.codecState === 'closed') {
            return
        }

        const pkt = MediaPacket.toBytes(chunk)
        await this.sendTransport?.send(pkt, chunk.type === 'key')
        self.postMessage({ type: 'log', data: 'got encoded chunk, sent to server...' })
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

    private handleIncomingPackets(pkt: Uint8Array) {
        self.postMessage({ type: 'log', data: "got packet from server" })
        if (this.decoder?.codecState === 'closed') {
            console.debug('decoder state is closed, not processing packet')
            return
        }
        const chunk = MediaPacket.fromBytes(pkt)
        console.debug("decoded chunk data:", chunk, "decoder:", this.decoder, 'codec status:', this.decoder?.codecState);
        if (this.keyFramePending) {
            if (chunk.type !== 'key') {
                console.warn('discarding packet until key frame is received')
                this.encoder?.getKeyFrame()
                return
            }
            this.keyFramePending = false
        }

        this.decoder!.decode(chunk)
        // if (this.totalFrames % 15 === 0) {
        //     this.keyFramePending = true
        //     this.encoder?.getKeyFrame()
        // }
    }

}

let mediaWorker: MediaWorker | undefined = undefined;


self.addEventListener('message', ({ data }: { data: WorkerData }) => {
    switch (data.type) {
        case 'init':
            mediaWorker = new MediaWorker()
            break;
        case 'init-transport':
            mediaWorker?.initTransport(data.data as TransportConfig)
            break;
        case 'init-encoder':
            if (mediaWorker?.encoder) {
                return
            }
            mediaWorker?.initEncoder(data.data as EncoderConfig)
            break;
        case 'init-decoder':
            if (mediaWorker?.decoder) {
                return
            }
            mediaWorker?.initDecoder()
            break
        case 'media':
            mediaWorker?.encode(data.data as VideoFrame)
            break
        default:
            break;
    }
})