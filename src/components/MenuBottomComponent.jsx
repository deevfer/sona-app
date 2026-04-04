import { useLocation, useNavigate } from "react-router-dom"
import { useState } from "react"
import "../styles/MenuBottomComponent.css"

import AlbumsIcon from "../assets/albums.svg?react"
import MusicIcon from "../assets/music.svg?react"
import QueueIcon from "../assets/queue.svg?react"

function MenuBottomComponent({ visible = true }) {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname
  const [zoom, setZoom] = useState(false)

  const handleClick = (route) => {
    if (path === route) return
    setZoom(true)
    setTimeout(() => setZoom(false), 200)
    navigate(route, { replace: true })
  }

  return (
    <div className={`menuBottomContent ${visible ? "menuVisible" : "menuHidden"}`}>
      <div className={`menuBottomElements ${zoom ? "menuZoom" : ""}`}>
        <div className={`menuItem ${path === "/sona-albums" ? "active" : ""}`}>
          <button type="button" onClick={() => handleClick("/sona-albums")}>
            <AlbumsIcon />
          </button>
        </div>

        <div className={`menuItem ${path === "/sona" ? "active" : ""}`}>
          <button type="button" onClick={() => handleClick("/sona")}>
            <MusicIcon />
          </button>
        </div>

        <div className={`menuItem ${path === "/sona-queue" ? "active" : ""}`}>
          <button type="button" onClick={() => handleClick("/sona-queue")}>
            <QueueIcon />
          </button>
        </div>
      </div>
    </div>
  )
}

export default MenuBottomComponent