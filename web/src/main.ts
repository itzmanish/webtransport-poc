// @ts-ignore embed the certificate fingerprint using bundler
import fingerprintHex from '../../cert/localhost.hex?raw';

import { Logger } from "./logger";
import "./style.css"
import { Transport } from "./transport";
import { WorkerData } from "./media-worker"
// import MediaWorker from "./media-worker/worker?worker";
import { StatsReport } from './metrics';
import { MediaHandler } from './gum';
import { VideoStream } from './stream';

var acquire = document.querySelector<HTMLButtonElement>(".acquire")!
var initTransport = document.querySelector<HTMLButtonElement>(".init-transport")!
var initEncoder = document.querySelector<HTMLButtonElement>(".init-encoder")!
var initDecoder = document.querySelector<HTMLButtonElement>(".init-decoder")!
var output = document.querySelector<HTMLDivElement>(".output")!
var framesCount = document.querySelector<HTMLDivElement>(".frames-count")!

// Convert the hex to binary.
let fingerprint: number[] = [];
for (let c = 0; c < fingerprintHex.length - 1; c += 2) {
  fingerprint.push(parseInt(fingerprintHex.substring(c, c + 2), 16));
}

var outputTrack: WritableStream<VideoFrame>;
// var mediaWorker: Worker | undefined;
var buffer: VideoFrame[] = [];
var transport: Transport;
var stream: VideoStream;

const logger = new Logger(output)
const mediaHandler = new MediaHandler()

// setup web workers
// document.addEventListener('DOMContentLoaded', () => {
//   logger.write('initializing pipline worker...')
//   mediaWorker = new MediaWorker({
//     name: 'media-worker'
//   })
//   mediaWorker.addEventListener('message', ({ data }: { data: WorkerData }) => {
//     switch (data.type) {
//       case 'log':
//         logger.write(data.data)
//         break;
//       case 'metrics':
//         const report = data.data as StatsReport
//         framesCount.innerText = `
//         Sent Frames: ${report.sent_frames}
//         Sent Bytes: ${report.sent_bytes} Bytes
//         Received Frames: ${report.recv_frames}
//         Received Bytes: ${report.recv_bytes} Bytes
//         Last sent at: ${report.last_sent_at}
//         Last received at: ${report.last_recv_at ?? "not yet"}
//         RTT: ${report.rtt} ms
//         `
//         break
//       case 'media':
//         buffer.push(data.data as VideoFrame)
//         break
//       default:
//         break
//     }
//   })
//   mediaWorker.addEventListener('error', (error) => {
//     console.error('error on worker', error)
//     logger.write("got error on worker", error.message)
//   })
//   mediaWorker.postMessage({ type: 'init' })
// })

// acquire media track
acquire.addEventListener('click', async () => {
  logger.write("acquiring video track...")
  await mediaHandler.acquireVideo()
  appendVideo(".local", mediaHandler.stream)
  logger.write("media stream acquired. stream id:", mediaHandler.stream.id)
})

// Init transport for connecting webtransport
initTransport.addEventListener('click', async () => {
  logger.write('connecting webtransport..')
  console.debug('cert hex', fingerprintHex, "cert", fingerprint)
  // mediaWorker?.postMessage({
  //   type: 'init-transport', data: {
  //     direction: 'send',
  //     url: "https://localhost:4443/publish?stream_id=1",
  //     fingerprint: new Uint8Array(fingerprint)
  //   }
  // })
  // mediaWorker?.postMessage({
  //   type: 'init-transport', data: {
  //     direction: 'recv',
  //     url: "https://localhost:4443/subscribe?stream_id=1",
  //     fingerprint: new Uint8Array(fingerprint)
  //   }
  // })
  transport = new Transport('send', "https://localhost:4443/publish?stream_id=1", new Uint8Array(fingerprint))
  await transport.init()
  logger.write('webtransport connected...')
})

// init encoder for encoding
initEncoder.addEventListener('click', async () => {
  logger.write("starting encoding...")
  // const sink = new MediaStreamTrackProcessor({ track: mediaHandler.video! })
  // mediaWorker?.postMessage({ type: 'init-encoder', data: { source: sink.readable } }, [sink.readable])
  stream = new VideoStream(mediaHandler.video!, transport)
  logger.write("encoding in progress...")
  await stream.start()
  logger.write('encoding stopped')
})

// init decoder for decoding
initDecoder.addEventListener('click', () => {
  logger.write('starting decoding...')
  const generator = new MediaStreamTrackGenerator({ kind: 'video' })
  outputTrack = generator.writable
  appendVideo('.remote', new MediaStream([generator as any]))
  // mediaWorker?.postMessage({
  //   type: 'init-decoder',
  // })
  startTrackWriterWorker()
})

const startTrackWriterWorker = async () => {
  while (true) {
    const frame = buffer.pop()
    if (!frame) {
      await new Promise(r => setTimeout(r, 10))
      continue
    }
    const writer = outputTrack.getWriter()
    await writer.ready
    await writer.write(frame)
    frame?.close()
    await writer.ready
    writer.releaseLock()
  }
}


const appendVideo = (selector: string, stream: MediaStream) => {
  const videoNode = document.createElement("video")
  videoNode.setAttribute("width", "1280")
  videoNode.setAttribute("height", "720")
  videoNode.className = "my-2"
  videoNode.autoplay = true
  videoNode.srcObject = stream
  document.querySelector<HTMLDivElement>(selector)!.append(videoNode)
}
