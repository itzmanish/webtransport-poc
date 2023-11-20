import { Logger } from "./logger";
import "./style.css"
import { WorkerData } from "./workers"
import PipelineWorker from "./workers/pipeline?worker";

var acquire = document.querySelector<HTMLButtonElement>(".acquire")!
var initEncoder = document.querySelector<HTMLButtonElement>(".init-encoder")!
var initDecoder = document.querySelector<HTMLButtonElement>(".init-decoder")!
var output = document.querySelector<HTMLDivElement>(".output")!
var framesCount = document.querySelector<HTMLDivElement>(".frames-count")!

var sourceTrack: MediaStreamTrack;
var outputTrack: WritableStream<VideoFrame>;
var pipelineWorker: Worker | undefined;
var buffer: VideoFrame[] = [];
const logger = new Logger(output)

// setup web workers
document.addEventListener('DOMContentLoaded', () => {
  logger.write('initializing pipline worker...')
  pipelineWorker = new PipelineWorker({
    name: 'media-worker'
  })
  pipelineWorker.addEventListener('message', ({ data }: { data: WorkerData }) => {
    switch (data.type) {
      case 'log':
        logger.write(data.data)
        break;
      case 'metrics':
        const { totalFrames } = data.data as any
        framesCount.innerText = "total frames processed: " + totalFrames
        break
      case 'media':
        buffer.push(data.data as VideoFrame)
        break
      default:
        break
    }
  })
  pipelineWorker.addEventListener('error', (error) => {
    console.error('error on worker', error)
    logger.write("got error on worker", error.message)
  })
  pipelineWorker.postMessage({ type: 'init' })

})

// acquire media track
acquire.addEventListener('click', async () => {
  logger.write("acquiring video track...")
  const stream = await navigator.mediaDevices.getUserMedia({ video: true })
  appendVideo(".local", stream)
  sourceTrack = stream.getVideoTracks()[0]
  logger.write("media stream acquired. stream id:", stream.id)
})

// init encoder for encoding
initEncoder.addEventListener('click', () => {
  logger.write("starting encoding...")
  pipelineWorker?.postMessage({ type: 'init-encoder' })
  const sink = new MediaStreamTrackProcessor({ track: sourceTrack })
  readAndEncode(sink.readable.getReader())
  logger.write("encoding in progress...")
})

// init decoder for decoding
initDecoder.addEventListener('click', () => {
  logger.write('starting decoding...')
  const generator = new MediaStreamTrackGenerator({ kind: 'video' })
  outputTrack = generator.writable
  appendVideo('.remote', new MediaStream([generator as any]))
  pipelineWorker?.postMessage({
    type: 'init-decoder',
  })
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

const readAndEncode = (reader: ReadableStreamDefaultReader<VideoFrame>) => {
  reader.read().then((result) => {
    // App handling for stream closure.
    if (result.done)
      return;
    pipelineWorker?.postMessage({ type: 'media', data: result.value })
    result.value.close()
    // Keep reading until the stream closes.
    readAndEncode(reader);
  })
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
