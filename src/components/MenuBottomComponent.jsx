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
    setZoom(true)

    setTimeout(() => {
      setZoom(false)
      navigate(route)
    }, 180)
  }

  return (
    <div className={`menuBottomContent ${visible ? "visible" : "hidden"}`}>
      <div className={`menuBottomElements ${zoom ? "menuZoom" : ""}`}>

        {/* ALBUMS */}
        <div className={`menuItem ${path === "/sona-albums" ? "active" : ""}`}>
          <button onClick={() => handleClick("/sona-albums")}>
            <AlbumsIcon />
          </button>
        </div>

        {/* MUSIC */}
        <div className={`menuItem ${path === "/sona" ? "active" : ""}`}>
          <button onClick={() => handleClick("/sona")}>
            <MusicIcon />
          </button>
        </div>

        {/* QUEUE */}
        <div className={`menuItem ${path === "/sona-queue" ? "active" : ""}`}>
          <button onClick={() => handleClick("/sona-queue")}>
            <QueueIcon />
          </button>
        </div>

      </div>
    </div>
  )
}

export default MenuBottomComponent