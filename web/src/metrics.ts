export type StatsReport = {
    sent_frames: number
    recv_frames: number
    sent_bytes: number
    recv_bytes: number
    last_sent_at?: number
    last_recv_at?: number
    rtt: number
}
export class Metrics {
    sent_frames: number
    received_frames: number
    sent_bytes: number
    received_bytes: number
    last_frame_sent?: number
    last_frame_received?: number

    sequencer_buffer: Ring<SequencerMetric, number>
    rtt: number

    constructor() {
        this.sent_bytes = 0
        this.received_bytes = 0
        this.sent_frames = 0
        this.received_frames = 0
        this.sequencer_buffer = new Ring(4)
        this.rtt = 0
    }

    get_stats(): StatsReport {
        return {
            sent_frames: this.sent_frames,
            recv_frames: this.received_frames,
            sent_bytes: this.sent_bytes,
            recv_bytes: this.received_bytes,
            last_sent_at: this.last_frame_sent,
            last_recv_at: this.last_frame_received,
            rtt: this.rtt,
        }
    }

    update_send_frame(seq_num: number, sent_bytes: number) {
        const now = new Date().getTime()
        this.sent_frames += 1
        this.sent_bytes += sent_bytes
        this.last_frame_sent = now
        this.sequencer_buffer.write(new SequencerMetric(seq_num, now))
    }

    update_recv_frame(seq_num: number, recv_bytes: number) {
        const now = new Date().getTime()
        this.received_bytes += recv_bytes
        this.received_frames += 1
        this.last_frame_received = now
        this.calculate(seq_num, now)
    }

    calculate(seq_num: number, now: number) {
        const sm = this.sequencer_buffer.find(new SequencerMetric(seq_num, 0))
        if (sm) {
            this.rtt = now - sm.timestamp
        }
    }
}

class SequencerMetric implements Hashable<number> {
    seq: number
    timestamp: number
    constructor(seq: number, timestamp: number) {
        this.seq = seq
        this.timestamp = timestamp
    }
    key(): number {
        return this.seq
    }
}

interface Hashable<T> {
    key(): T;
}

class Ring<T extends Hashable<K>, K> {
    array: T[]
    capcity: number
    write_counter: number
    read_counter: number
    table: Map<K, number>

    constructor(cap: number) {
        this.array = new Array(cap).fill(undefined)
        this.capcity = cap
        this.write_counter = 0
        this.read_counter = 0
        this.table = new Map()
    }

    get_write_pos() {
        return this.write_counter++ % this.capcity
    }

    get_read_pos() {
        return this.read_counter++ % this.capcity
    }

    write(data: T) {
        const pos = this.get_write_pos()
        const existing = this.array.at(pos)
        if (existing) {
            this.table.delete(existing.key())
        }
        this.array[pos] = data
        this.table.set(data.key(), pos)
        return pos
    }

    read(): T {
        const pos = this.get_read_pos()
        return this.array[pos]
    }

    find(data: T) {
        const pos = this.table.get(data.key())
        if (pos) {
            const found = this.array.at(pos)
            if (found?.key() === data.key()) return found
        }
    }

    clear() {
        this.array = []
    }

}