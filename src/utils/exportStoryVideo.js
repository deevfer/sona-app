import html2canvas from "html2canvas"

export async function exportStoryVideo({
  element,
  seconds = 10,
  fps = 24,
  center = { x: 0.78, y: 0.78 },
  radius = 0.40,
  spins = 2,
  labelScale = 0.35,
  labelOffset = { x: 0, y: 0 },
} = {}) {
  if (!element) throw new Error("Missing element")

  if (typeof MediaRecorder === "undefined") {
    throw new Error("Tu navegador no soporta grabación de video. Usa Chrome o Firefox.")
  }

  const mimeCandidates = [
    "video/webm;codecs=vp8",
    "video/webm",
  ]
  const chosenMime = mimeCandidates.find((t) => MediaRecorder.isTypeSupported(t))

  if (!chosenMime) {
    throw new Error("Tu navegador no soporta exportación de video. Usa Chrome o Firefox.")
  }

  // 1) Snapshot base SIN vinilo
  element.classList.add("export-video-hide-vinyl")
  await new Promise((r) => setTimeout(r, 50)) // dar tiempo al DOM
  const base = await html2canvas(element, {
    scale: 1,
    useCORS: true,
    backgroundColor: null,
  })
  element.classList.remove("export-video-hide-vinyl")

  // 2) Canvas output
  const out = document.createElement("canvas")
  out.width = base.width
  out.height = base.height
  const ctx = out.getContext("2d")
  if (!ctx) throw new Error("No canvas context")

  // 3) Cargar imágenes
  const vinylImgEl = element.querySelector(".shareVinyl")
  const labelImgEl = element.querySelector(".shareVinylLabel")
  const vinylImg = await loadImg(vinylImgEl?.src)
  const labelImg = await loadImg(labelImgEl?.src)

  const cx = out.width * center.x
  const cy = out.height * center.y
  const r = out.width * radius
  const labelSize = r * labelScale
  const totalFrames = Math.floor(seconds * fps)

  // 4) Grabar
  const stream = out.captureStream(fps)
  const chunks = []
  const rec = new MediaRecorder(stream, {
    mimeType: chosenMime,
    videoBitsPerSecond: 2_000_000,
  })
  rec.ondataavailable = (e) => e.data?.size && chunks.push(e.data)

  const stopPromise = new Promise((resolve) => {
    rec.onstop = () => resolve()
  })

  rec.start()

  const frameDelay = 1000 / fps
  for (let f = 0; f < totalFrames; f++) {
    const t = f / totalFrames
    const angle = t * Math.PI * 2 * spins

    ctx.clearRect(0, 0, out.width, out.height)
    ctx.drawImage(base, 0, 0)

    // Vinilo girando
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)

    // Dibujar vinilo
    ctx.drawImage(vinylImg, -r, -r, r * 2, r * 2)

    // Dibujar label CIRCULAR
    ctx.save()
    ctx.beginPath()
    ctx.arc(
      (labelOffset?.x || 0),
      (labelOffset?.y || 0),
      labelSize,
      0,
      Math.PI * 2
    )
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(
      labelImg,
      -labelSize + (labelOffset?.x || 0),
      -labelSize + (labelOffset?.y || 0),
      labelSize * 2,
      labelSize * 2
    )
    ctx.restore()

    ctx.restore()

    await new Promise((r) => setTimeout(r, frameDelay))
  }

  rec.stop()
  await stopPromise

  const blob = new Blob(chunks, { type: chosenMime })
  if (!blob.size) throw new Error("El video salió vacío.")

  return blob
}

function loadImg(src) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error("No image src"))
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`No se pudo cargar: ${src}`))
    img.src = src
  })
}