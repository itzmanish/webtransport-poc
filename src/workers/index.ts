export interface WorkerData {
    type: 'init' | 'init-encoder' | 'init-decoder' | 'media' | 'metrics' | 'log'
    data: unknown
}

export interface EncoderConfig {
    config?: VideoEncoderConfig;
    track: MediaStreamTrack
}
