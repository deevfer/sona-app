import SonaLogo from "../assets/sonaAnimated.svg?react"
import "../styles/FullScreenLoader.css"

function FullScreenLoader({ visible = true }) {
  if (!visible) return null

  return (
    <div className="fullScreenLoader">
      <div className="fullScreenLoaderLogo">
        <SonaLogo />
      </div>
    </div>
  )
}

export default FullScreenLoader
