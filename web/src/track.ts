import { MediaKind } from "./types"

export class AudioTrack extends WritableStream<AudioData> {
    id: string
    track: MediaStreamTrackGenerator<AudioData>
    kind: MediaKind
    metadata: Record<string, string>

    constructor(id: string) {
        super()
        this.id = id;
        this.kind = 'audio';
        this.track = new MediaStreamTrackGenerator({ kind: 'audio' })

        this.metadata = {};
    }

    get writable() {
        return this.track.writable
    }

    getWriter(): WritableStreamDefaultWriter<AudioData> {
        return this.track.writable.getWriter()
    }

    async write(data: AudioData): Promise<void> {
        console.log("writing in audio track")
        const writer = this.track.writable.getWriter()
        await writer.ready
        await writer.write(data)
        data?.close()
        await writer.ready
        writer.releaseLock()
    }

    close(): Promise<void> {
        // do something here
        return Promise.resolve()
    }

    abort(reason?: any): Promise<void> {
        // do something here
        return Promise.resolve()
    }
}

export class VideoTrack {
    id: string
    track: MediaStreamTrackGenerator<VideoFrame>
    kind: MediaKind
    metadata: Record<string, string>

    constructor(id: string) {
        this.id = id;
        this.kind = 'video';
        this.track = new MediaStreamTrackGenerator({ kind: 'video' });
        this.metadata = {};
    }

    get writable() {
        return this.track.writable
    }

    getWriter(): WritableStreamDefaultWriter<VideoFrame> {
        return this.track.writable.getWriter()
    }

    async write(chunk: VideoFrame, controller: WritableStreamDefaultController) {
        // is this happening in real?
        console.log("writing in video track")
        const writer = this.track.writable.getWriter()
        await writer.ready
        await writer.write(chunk)
        chunk?.close()
        await writer.ready
        writer.releaseLock()
    }

    close(): Promise<void> {
        return this.track.writable.close()
    }

    abort(reason?: any): Promise<void> {
        return this.track.writable.abort(reason)
    }
}
