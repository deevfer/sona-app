import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"

let ffmpeg = null

export async function webmToMp4(webmBlob) {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg()

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd"
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    })
  }

  await ffmpeg.writeFile("input.webm", await fetchFile(webmBlob))

  await ffmpeg.exec([
    "-i", "input.webm",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "28",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-an",
    "-r", "24",
    "-t", "10",
    "output.mp4",
  ])

  const data = await ffmpeg.readFile("output.mp4")
  
  // Limpiar archivos
  await ffmpeg.deleteFile("input.webm").catch(() => {})
  await ffmpeg.deleteFile("output.mp4").catch(() => {})

  return new Blob([data.buffer], { type: "video/mp4" })
}