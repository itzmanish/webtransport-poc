import { MediaKind } from "./types"

export class Forwarder {
    kind: MediaKind
    streamId: string
    constructor(kind: MediaKind, streamId: string) {
        this.kind = kind
        this.streamId = streamId

    }

}