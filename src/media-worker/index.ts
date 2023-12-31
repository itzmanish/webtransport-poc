export interface WorkerData {
    type: 'init' | 'init-transport' | 'init-encoder' | 'init-decoder' | 'media' | 'metrics' | 'log'
    data: unknown
}

export interface EncoderConfig {
    config?: VideoEncoderConfig;
    source: ReadableStream<VideoFrame>
}

export interface TransportConfig {
    url: string;
    fingerprint: Uint8Array
}