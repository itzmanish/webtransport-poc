// -----------------------------------------------------------------------
// MediaStream API: Extension Type Definitions
// -----------------------------------------------------------------------

declare interface MediaStreamTrackProcessorOptions {
    /** A MediaStreamTrack */
    track: MediaStreamTrack
    /** An integer specifying the maximum number of media frames to be buffered. */
    maxBufferSize?: number
}

declare class MediaStreamTrackProcessor extends MediaStreamTrack {
    constructor(options: MediaStreamTrackProcessorOptions)
    readable: ReadableStream<VideoFrame>
}

declare interface MediaStreamTrackGeneratorOptions {
    /** A MediaStreamTrack */
    kind: 'audio' | 'video'
}

declare class MediaStreamTrackGenerator {
    constructor(options: MediaStreamTrackGeneratorOptions)
    readonly writable: WritableStream<VideoFrame>
}

// -----------------------------------------------------------------------
// WebCodecs API: Type Definitions
// -----------------------------------------------------------------------

declare type WebCodecsHardwareAcceleration = 'no-preference' | 'prefer-hardware' | 'prefer-software'
declare type WebCodecsState = 'unconfigured' | 'configured' | 'closed'
/** 'flac' | 'mp3' | 'mp4a.*' | 'opus' | 'vorbis' | 'ulaw' | 'alaw' | 'pcm-*' */
declare type WebCodecCodecString = string

declare class EncodedAudioChunk {
    constructor(options: { type: 'key' | 'delta'; timestamp: number; duration: number; data: ArrayBuffer })
    readonly type: 'key' | 'delta'
    readonly timestamp: number
    readonly duration: number
    readonly byteLength: number
    public copyTo(buffer: ArrayBuffer | DataView): void
}


declare interface AudioEncoderConfigureOptions {
    codec: WebCodecCodecString
    /** An integer representing the number of frame samples per second. */
    sampleRate: number
    /** An integer representing the number of audio channels. */
    numberOfChannels: number
    /** Aa ArrayBuffer, a TypedArray, or a DataView containing a sequence of codec specific bytes, commonly known as extradata. */
    description?: ArrayBuffer | DataView
}
declare class AudioData {
    /** Returns the sample format of the audio.  */
    readonly format: 'u8' | 's16' | 's32' | 'f32' | 'u8-planar' | 's16-planar' | 's32-planar' | 'f32-planar'
    /** Returns the sample rate of the audio in Hz. */
    readonly sampleRate: number
    /** Returns the number of frames. */
    readonly numberOfFrames: number
    /** Returns the number of audio channels. */
    readonly numberOfChannels: number
    /** Returns the duration of the audio in microseconds. */
    readonly duration: number
    /** Returns the timestamp of the audio in microseconds. */
    readonly timestamp: number
    /** Returns the number of bytes required to hold the sample as filtered by options passed into the method. */
    public allocationSize(options: { planeIndex: number; frameOffset?: number; frameCount?: number }): number
    /** Copies the samples from the specified plane of the AudioData object to the destination. */
    public copyTo(destination: ArrayBuffer, options: { planeIndex: number; frameOffset?: number; frameCount?: number }): void
    /** Creates a new AudioData object with reference to the same media resource as the original. */
    public clone(): AudioData
    /** Clears all states and releases the reference to the media resource. */
    public close(): void
}

declare type AudioEncoderOutputMetadata = {
    codec: WebCodecCodecString
    sampleRate: number
    numberOfChannels: number
    description?: ArrayBuffer
}
declare type AudioEncoderOutputCallback = (chunk: EncodedAudioChunk, metadata: AudioEncoderOutputMetadata) => any
declare type AudioEncoderErrorCallback = (error: Error) => any
declare class AudioEncoder {
    constructor(init: { output: AudioEncoderOutputCallback; error: AudioEncoderErrorCallback })
    readonly decodeQueueSize: number
    readonly state: WebCodecsState
    /** Enqueues a control message to configure the audio decoder for decoding chunks. */
    public configure(options: AudioEncoderConfigureOptions): void
    /** Enqueues a control message to decode a given chunk of audio. */
    public decode(chunk: EncodedAudioChunk): void
    /** Returns a promise that resolves once all pending messages in the queue have been completed. */
    public flush(): Promise<void>
    /** Resets all states including configuration, control messages in the control message queue, and all pending callbacks. */
    public reset(): void
    /** Ends all pending work and releases system resources. */
    public close(): void
}

declare type AudioDecoderOutputCallback = (data: AudioData) => any
declare type AudioDecoderErrorCallback = (error: Error) => any
declare class AudioDecoder {
    constructor(init: { output: AudioDecoderOutputCallback; error: AudioDecoderErrorCallback })
    readonly decodeQueueSize: number
    readonly state: WebCodecsState
    /** Enqueues a control message to configure the audio decoder for decoding chunks. */
    public configure(options: { codec: WebCodecCodecString; sampleRate: number; numberOfChannels: number; description?: ArrayBuffer }): void
    /** Enqueues a control message to decode a given chunk of audio. */
    public decode(chunk: EncodedAudioChunk): void
    /** Returns a promise that resolves once all pending messages in the queue have been completed. */
    public flush(): Promise<void>
    /** Resets all states including configuration, control messages in the control message queue, and all pending callbacks. */
    public reset(): void
    /** Ends all pending work and releases system resources. */
    public close(): void
}

declare class ImageDecoder {
    constructor(init: {
        /** A string containing the MIME type of the image file to be decoded. */
        type: string
        data: ArrayBuffer | DataView | ReadableStream
        premultiplyAlpha?: 'none' | 'premultiply' | 'default'
        colorSpaceConversion?: 'default' | 'none'
        desiredWidth?: number
        desiredHeight?: number
        preferAnimation?: boolean
    })
    readonly complete: boolean
    readonly completed: Promise<void>
    readonly tracks: ImageTrackList
    readonly type: string
    /** Ends all pending work and releases system resources. */
    public close(): void
    /** Enqueues a control message to decode the frame of an image. */
    public decode(options?: { frameIndex?: number; completeFramesOnly?: boolean }): Promise<{ image: VideoFrame; complete: boolean }>
    /** Aborts all pending decode() operations. */
    public reset(): void

    /** Indicates if the provided MIME type is supported for unpacking and decoding. */
    public static isTypeSupported(type: string): boolean
}

declare interface ImageTrack {
    /** Returns a boolean indicating whether the track is animated and therefore has multiple frames. */
    readonly animated: boolean
    /** Returns an integer indicating the number of frames in the track. */
    readonly frameCount: number
    /** Returns an integer indicating the number of times that the animation repeats. */
    readonly repetitionCount: number
    /** Returns a boolean indicating whether the track is selected for decoding. */
    readonly selected: boolean
}

declare interface ImageTrackList {
    /** Returns a promise that resolves once the ImageTrackList has been populated with tracks. */
    readonly ready: Promise<void>
    /** Returns an integer indicating the length of the ImageTrackList. */
    readonly length: number
    /** Returns an integer indicating the index of the selectedTrack. */
    readonly selectedIndex: number
    /** Returns the selected ImageTrack. */
    readonly selectedTrack: ImageTrack
}

declare type VideoDecoderOutputCallback = (frame: VideoFrame) => any
declare type VideoDecoderErrorCallback = (error: Error) => any
declare interface VideoDecoderConfiguration {
    codec: WebCodecCodecString
    description?: ArrayBuffer | DataView
    codedWidth?: number
    codedHeight?: number
    displayAspectHeight?: number
    colorSpace?: VideoColorSpace
    hardwareAcceleration?: WebCodecsHardwareAcceleration
    optimizeForLatency?: boolean
}

// declare class VideoDecoder {
//     constructor(options: { output: VideoDecoderOutputCallback; error: VideoDecoderErrorCallback })
//     /** An integer representing the number of decode queue requests. */
//     readonly decodeQueueSize: number
//     /** Indicates whether the underlying codec is configured for decoding. */
//     readonly state: WebCodecsState
//     /** Enqueues a control message to configure the video decoder for decoding chunks. */
//     public configure(config: VideoDecoderConfiguration): void
//     /** Enqueues a control message to decode a given chunk of video. */
//     public decode(chunk: EncodedVideoChunk): void
//     /** Returns a promise that resolves once all pending messages in the queue have been completed. */
//     public flush(): Promise<void>
//     /** Resets all states including configuration, control messages in the control message queue, and all pending callbacks. */
//     public reset(): void
//     /** Ends all pending work and releases system resources. */
//     public close(): void
// }

declare type VideoEncoderOutputMetadata = {
    decoderconfig?: {
        codec: WebCodecCodecString
        description?: ArrayBuffer | DataView
        codedWidth?: number
        codedHeight?: number
        displayAspectWidth?: number
        displayAspectHeight?: number
        colorSpace?: VideoColorSpace
        hardwareAcceleration?: WebCodecsHardwareAcceleration
        optimizeForLatency?: boolean
    }
    svc: {
        temporalLayerId: number
    }
}

declare type VideoEncoderOutputCallback = (encoded: EncodedVideoChunk, metadata?: VideoEncoderOutputMetadata) => any
declare type VideoEncoderErrorCallback = (error: Error) => any
declare interface VideoEncoderConfiguration {
    /** A string containing a valid codec string */
    codec?: WebCodecCodecString
    /** An integer representing the width of each output EncodedVideoChunk in pixels, before any ratio adjustments. */
    width?: number
    /** An integer representing the height of each output EncodedVideoChunk in pixels, before any ratio adjustments. */
    height?: number
    /** An integer representing the intended display width of each output EncodedVideoChunk in pixels when displayed. */
    displayWidth?: number
    /** An integer representing the vertical dimension of each output EncodedVideoChunk in pixels when displayed. */
    displayHeight?: number
    /** A hint that configures the hardware acceleration method of this codec. */
    hardwareAcceleration?: WebCodecsHardwareAcceleration
    /** An integer containing the average bitrate of the encoded video in units of bits per second. */
    bitrate?: number
    /** An integer containing the expected frame rate in frames per second. */
    framerate?: number
    /** A string indicating whether the alpha component of the VideoFrame inputs should be kept or discarded prior to encoding. */
    alpha?: 'discard' | 'keep'
    /** A string containing an encoding scalability mode identifier as defined in https://w3c.github.io/webrtc-svc/#scalabilitymodes* */
    scalabilityMode?: string
    /** A string containing a bitrate mode. */
    bitrateMode?: 'constant' | 'variable'
    /** A string containing a value that configures the latency behavior of this codec. */
    latencyMode?: 'quality' | 'realtime'
}
// declare class VideoEncoder {
//     constructor(options: { output: VideoEncoderOutputCallback; error: VideoEncoderErrorCallback })
//     /** An integer representing the number of encode queue requests. */
//     readonly encodeQueueSize: number
//     /** Represents the state of the underlying codec and whether it is configured for encoding. */
//     readonly state: WebCodecsState
//     /** Enqueues a control message to configure the video encoder for encoding chunks. */
//     public configure(options: VideoEncoderConfiguration): void
//     /** Enqueues a control message to encode a given VideoFrame. */
//     public encode(frame: VideoFrame, options?: { keyFrame: boolean }): void
//     /** Returns a promise that resolves once all pending messages in the queue have been completed. */
//     public flush(): Promise<void>
//     /** Returns a promise indicating whether the provided VideoEncoderConfig is supported. */
//     public isConfigSupported(): Promise<{ supported?: boolean; config?: VideoEncoderConfiguration }>
//     /** Resets all states including configuration, control messages in the control message queue, and all pending callbacks. */
//     public reset(): void
//     /** Ends all pending work and releases system resources. */
//     public close(): void
// }

declare interface VideoColorSpaceOptions {
    primaries?: 'bt709' | 'bt470bg' | 'smpte170m'
    transfer?: 'bt709' | 'smpte170m' | 'iec61966-2-1'
    matrix?: 'rgb' | 'bt709' | 'bt470bg' | 'smpte170m'
    fullRange?: boolean
}

// declare class VideoColorSpace {
//   constructor(options?: VideoColorSpaceOptions)
//   public toJSON(): any
// }

declare interface VideoFrameOptions {
    /** An integer representing the duration of the frame in microseconds. */
    duration?: number
    /** An integer representing the timestamp of the frame in microseconds. */
    timestamp: number
    /** A string, describing how the user agent should behave when dealing with alpha channels. */
    alpha?: 'keep' | 'discard'
    /** An object representing the visible rectangle of the VideoFrame. */
    visibleRect?: { x: number; y: number; width: number; height: number }
    /** The width of the VideoFrame when displayed after applying aspect-ratio adjustments. */
    displayWidth?: number
    /** The height of the VideoFrame when displayed after applying aspect-ratio adjustments. */
    displayHeight?: number
}

declare type VideoFrameFormat = 'I420' | 'I420A' | 'I422' | 'I444' | 'NV12' | 'RGBA' | 'RGBX' | 'BGRA' | 'BGRX'

declare interface VideoFrameBufferOptions {
    /** A string representing the video pixel format.  */
    format?: VideoFrameFormat
    /** Width of the VideoFrame in pixels, potentially including non-visible padding, and prior to considering potential ratio adjustments. */
    codedWidth?: number
    /** Height of the VideoFrame in pixels, potentially including non-visible padding, and prior to considering potential ratio adjustments. */
    codedHeight?: number
    /** An integer representing the timestamp of the frame in microseconds. */
    timestamp: number
    /** An integer representing the duration of the frame in microseconds. */
    duration?: number
    /** A list containing the following values for each plane in the VideoFrame */
    layout?: { offset: number; stride: number }[]
    /** An object representing the visible rectangle of the VideoFrame. */
    visibleRect?: { x: number; y: number; width: number; height: number }
    /** The width of the VideoFrame when displayed after applying aspect-ratio adjustments. */
    displayWidth?: number
    /** The height of the VideoFrame when displayed after applying aspect-ratio adjustments. */
    displayHeight?: number
    /** An object representing the color space of the VideoFrame */
    colorSpace?: VideoColorSpace
}

// declare class VideoFrame {
//     constructor(image: SVGImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap | VideoFrame, options: VideoFrameOptions)
//     constructor(data: ArrayBuffer | ArrayBufferView, options: VideoFrameBufferOptions)
//     readonly format: VideoFrameFormat
//     readonly codedWidth: number
//     readonly codedHeight: number
//     readonly codedRect: DOMRectReadOnly
//     readonly displayWidth: number
//     readonly displayHeight: number
//     readonly duration: number
//     readonly timestamp: number
//     readonly colorSpace: VideoColorSpace
//     /** Returns the number of bytes required to hold the VideoFrame as filtered by options passed into the method. */
//     public allocationSize(options?: { rect?: { x: number; y: number; width: number; height: number }; layout?: { offset: number; stride: number }[] }): number
//     /** Copies the contents of the VideoFrame to an ArrayBuffer. */
//     public copyTo(
//         destination: ArrayBuffer | DataView,
//         options?: {
//             rect?: { x: number; y: number; width: number; height: number }
//             layout?: { offset: number; stride: number }[]
//         },
//     ): Promise<void>
//     /** Creates a new VideoFrame object with reference to the same media resource as the original. */
//     public clone(): VideoFrame
//     /** Clears all states and releases the reference to the media resource. */
//     public close(): void
// }
