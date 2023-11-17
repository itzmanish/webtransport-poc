import "./style.css"

var acquire = document.querySelector<HTMLButtonElement>(".acquire")!
var initEncoder = document.querySelector<HTMLButtonElement>(".init")!
var output = document.querySelector<HTMLDivElement>(".output")!

var videoTrack: MediaStreamTrack;

acquire.addEventListener('click', async () => {
  writeOutput("acquiring video track...")
  const stream = await navigator.mediaDevices.getUserMedia({ video: true })
  appendVideo(".local", stream)
  videoTrack = stream.getVideoTracks()[0]
  writeOutput("media stream acquired. stream id:", stream.id)
})

initEncoder.addEventListener('click', () => {
  writeOutput("starting encoding...")
  const trackProcessor = new MediaStreamTrackProcessor({ track: videoTrack });
  const videoEncoder = new VideoEncoder({
    output: onEncodedPackets,
    error: onEncodeError
  })
  videoEncoder.configure({
    codec: 'vp8',
    bitrate: 1_000_000,
    framerate: 25,
    width: 1280,
    height: 720,
  })
  readAndEncode(trackProcessor.readable.getReader(), videoEncoder)
  writeOutput("encoding in progress...")
})

// Helper to feed raw media to encoders as fast as possible.
const readAndEncode = (reader: ReadableStreamDefaultReader<VideoFrame>, encoder: VideoEncoder) => {
  reader.read().then((result) => {
    // App handling for stream closure.
    if (result.done)
      return;
    writeOutput("got packet for encoding:", result.value)
    // Encode!
    encoder.encode(result.value);

    // Keep reading until the stream closes.
    readAndEncode(reader, encoder);
  })
}

const onEncodedPackets = (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => {
  writeOutput("chunks:", chunk.byteLength, "metadata:", JSON.stringify(metadata, undefined, 2))
}

const onEncodeError = (error: any) => {
  writeOutput("error:", error)
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


const writeOutput = (...info: unknown[]) => {
  const node = document.createElement("div")
  node.innerText = info.reduce((acc, value) => {
    if (acc === "") {
      return value
    }
    return acc + " " + value
  }, "") as string
  output.append(node)
}