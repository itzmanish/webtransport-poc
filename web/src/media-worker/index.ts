import { TransportDirection } from "../transport";

export interface WorkerData {
    type: 'init' | 'init-transport' | 'init-encoder' | 'init-decoder' | 'media' | 'metrics' | 'log'
    data: unknown
}

export interface EncoderConfig {
    config?: VideoEncoderConfig;
    source: ReadableStream<VideoFrame>
}
export interface DecoderConfig {
    config?: VideoDecoderConfig;
    sink: WritableStream<VideoFrame>
}

export interface TransportConfig {
    direction: TransportDirection
    url: string;
    fingerprint: Uint8Array
}