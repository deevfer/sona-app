import html2canvas from "html2canvas"
import { forwardRef, useImperativeHandle, useRef } from "react"
import "../styles/ShareCard.css"

import SonaLogo from "../assets/sonaLogo.svg?react"

const ShareCard = forwardRef(function ShareCard(
  {
    track,
    selectedBg,
    bgCoverUrl,
    vinylSrc = "/vinyl-1.svg",
    labelOffset = { x: 0, y: 0 },
  },
  ref
) {
  const cardRef = useRef(null)

  const exportImage = async () => {
    const canvas = await html2canvas(cardRef.current, {
      scale: 3,
      useCORS: true,
      backgroundColor: null,
    })
    return canvas.toDataURL("image/png")
  }

  useImperativeHandle(ref, () => ({ exportImage }))

  const image = track?.image || "/sonaDefault.png"

  // 👇 nombre de canción
  const trackName = track?.name || "Unknown Track"

  // 👇 artistas
  const artists = Array.isArray(track?.artists)
    ? track.artists.join(", ")
    : track?.artists || "Unknown Artist"

  const bgClass = selectedBg && selectedBg !== "cover" ? `share-bg-${selectedBg}` : ""
  const bgStyle =
    selectedBg === "cover" && bgCoverUrl
      ? { backgroundImage: `url(${bgCoverUrl})` }
      : {}

  return (
    <div ref={cardRef} className={`shareCard ${bgClass}`} style={bgStyle}>
      <div className="shareOverlay" />

      <div className="shareCoverWrap">
        <img className="shareCover" src={image} alt="" crossOrigin="anonymous" />
      </div>

      <div className="shareVinylWrap">
        <div className="shareVinylTilt">
          <div className="shareVinylSpin">
            <img className="shareVinyl" src={vinylSrc} alt="" />

            <div
              className="shareVinylLabelWrap"
              style={{
                "--label-offset-x": `${labelOffset.x}px`,
                "--label-offset-y": `${labelOffset.y}px`,
              }}
            >
              <img
                className="shareVinylLabel"
                src={image}
                alt=""
                crossOrigin="anonymous"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="shareInfo">
        {/* <div className="shareData">
          <h1>{trackName}</h1>
          <p>{artists}</p>
        </div> */}

        <div className="shareBrand">
          <SonaLogo />
        </div>
      </div>
    </div>
  )
})

export default ShareCard