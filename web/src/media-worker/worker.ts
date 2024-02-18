import { EncoderConfig, TransportConfig, WorkerData } from ".";
import { Metrics } from "../metrics";
import { MediaPacket, Sequencer } from "../packet";
import { Transport } from "../transport";
import { Decoder as VideoDecoder } from "../decoder/video";
import { Encoder as VideoEncoder } from "../encoder/video";


const DefaultConfig: VideoEncoderConfig = {
    codec: 'vp8',
    width: 640,
    height: 480,
    bitrate: 1_000_000, // 1 Mbps
    framerate: 30,
    latencyMode: 'realtime',
}

class MediaWorker {
    public encoder?: VideoEncoder;
    public decoder?: VideoDecoder;
    public sendTransport?: Transport;
    public recvTransport?: Transport;
    public sequencer: Sequencer;
    public metrics: Metrics;
    private config: VideoEncoderConfig;
    private started: boolean;
    private totalFrames: number;
    private keyFramePending: boolean;

    constructor() {
        this.config = DefaultConfig
        this.started = false;
        this.totalFrames = 0;
        this.keyFramePending = false;
        this.sequencer = new Sequencer()
        this.metrics = new Metrics()
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
        this.encoder = new VideoEncoder(config ?? this.config)
        self.postMessage({ type: 'log', data: "encoder created and inited" })
    }

    public initDecoder() {
        this.decoder = new VideoDecoder({
            codec: this.config.codec,
            codedHeight: this.config.height,
            codedWidth: this.config.width,
        })
        self.postMessage({ type: 'log', data: "decoder created and inited" })
        this.started = true;
        this.keyFramePending = true;
        this.encoder?.get_keyframe()
        setInterval(() => {
            self.postMessage({
                type: 'metrics', data: this.metrics.get_stats()
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

        const pkt = new MediaPacket(chunk, this.sequencer.get_seq_number())
        await this.sendTransport?.send(pkt.toBytes(), chunk.type === 'key')
        this.metrics.update_send_frame(pkt.seq_num!, pkt.length)
    }

    public async onDecodedFrame(frame: VideoFrame) {
        // self.postMessage({ type: 'log', data: 'frames decoded, sending to main thread...' })
        this.totalFrames += 1;
        self.postMessage({ type: 'media', data: frame })
        frame.close()
    }

    private handleIncomingPackets(pkt: Uint8Array) {
        if (this.decoder?.codecState === 'closed') {
            console.debug('decoder state is closed, not processing packet')
            return
        }
        const frame = new MediaPacket()
        frame.fromBytes(pkt)
        this.metrics.update_recv_frame(frame.seq_num!, frame.length)
        if (this.keyFramePending) {
            if (frame.chunk!.type !== 'key') {
                console.warn('discarding packet until key frame is received')
                this.encoder?.get_keyframe()
                return
            }
            this.keyFramePending = false
        }

        // this.decoder!.decode(frame.chunk!)
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
            // mediaWorker?.encode(data.data as VideoFrame)
            break
        default:
            break;
    }
})