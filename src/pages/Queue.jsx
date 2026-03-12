import { useState, useEffect, useRef } from "react"
import "../styles/Queue.css"
// import MenuBottomComponent from "../components/MenuBottomComponent"
import { useTranslation } from "react-i18next"

import SonaLogo from "../assets/sonaAnimated.svg?react"

const API_BASE = import.meta.env.VITE_API_BASE

const BG_KEY = "sona:selectedBg"
const COVER_KEY = "sona:lastCoverUrl"

function Queue() {
  const { t } = useTranslation()

  const [selectedBg] = useState(() =>
    localStorage.getItem(BG_KEY) || "yellow"
  )
  const [storedCover, setStoredCover] = useState(() =>
    localStorage.getItem(COVER_KEY) || ""
  )
  const lastCoverRef = useRef(storedCover)

  useEffect(() => {
    if (selectedBg !== "cover") return
    const fetchCurrentCover = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) return
        const res = await fetch(`${API_BASE}/api/spotify/now-playing`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        })
        if (!res.ok) return
        const data = await res.json()
        const coverUrl = data?.track?.image || ""
        if (coverUrl && coverUrl !== lastCoverRef.current) {
          lastCoverRef.current = coverUrl
          setStoredCover(coverUrl)
          localStorage.setItem(COVER_KEY, coverUrl)
        }
      } catch {}
    }
    fetchCurrentCover()
    const id = setInterval(fetchCurrentCover, 3000)
    return () => clearInterval(id)
  }, [selectedBg])

  const bgClass = selectedBg !== "cover" ? `bg-${selectedBg}` : "bg-cover"
  const textClass =
    selectedBg === "black" || selectedBg === "cover" ? "text-light" : "text-dark"
  const bgStyles =
    selectedBg === "cover" && storedCover
      ? { backgroundImage: `url(${storedCover})`, backgroundSize: "cover", backgroundPosition: "center" }
      : {}

  // -----------------------------
  // Queue data
  // -----------------------------
  const [currentTrack, setCurrentTrack] = useState(null)
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) return
        const res = await fetch(`${API_BASE}/api/spotify/queue`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        })
        if (!res.ok) return
        const data = await res.json()
        setCurrentTrack(data?.currently_playing || null)
        setQueue(data?.queue || [])
      } catch (err) {
        console.error("Error fetching queue:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchQueue()
  }, [])
  const [skipping, setSkipping] = useState(false)

  const playTrackUri = async (index) => {
      if (skipping) return
      setSkipping(true)
      try {
        const token = localStorage.getItem("token")
        if (!token) return
  
        await fetch(`${API_BASE}/api/spotify/skip-to`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ times: index + 1 }),
        })
  
        window.location.href = "/sona"
      } catch (err) {
        console.error("Error reproduciendo:", err)
        setSkipping(false)
      }
    }
  const formatDuration = (ms) => {
    const min = Math.floor(ms / 60000)
    const sec = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0")
    return `${min}:${sec}`
  }

  const getImage = (track) =>
    track?.album?.images?.[0]?.url || "/sonaDefault.png"

  const getArtists = (track) =>
    (track?.artists || []).map((a) => a.name).join(", ")

// Refetch queue cada 5 segundos para actualizar cover
useEffect(() => {
    const fetchQueue = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) return
        const res = await fetch(`${API_BASE}/api/spotify/queue`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        })
        if (!res.ok) return
        const data = await res.json()
        setCurrentTrack(data?.currently_playing || null)
        setQueue(data?.queue || [])
      } catch (err) {
        console.error("Error fetching queue:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchQueue()
    const id = setInterval(fetchQueue, 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className={`sonaBody ${bgClass} ${textClass}`} style={bgStyles}>
      <div className="overlayBackground"></div>
      <div className="container">
        <div className="albumsStage">
            {skipping && (
                <div className="skippingOverlay" aria-label="Skipping">
                  <div className="skippingLogoWrap">
                    <SonaLogo />
                  </div>
                </div>
            )}
          <div className="titleQueue">
            <h1>{t("Queue.QueueTitle")}</h1>
          </div>

          <div className="tracksView splitLayout fadeIn">
            {/* COLUMNA IZQUIERDA - Cover actual */}
            <div className="albumColumn">
              <div className="albumCoverLarge">
                {loading ? (
                  <div className="skeletonBox shimmer" style={{ width: "100%", aspectRatio: "1", borderRadius: "12px" }} />
                ) : (
                  <img
                    src={currentTrack ? getImage(currentTrack) : "/sonaDefault.png"}
                    alt={currentTrack?.name || ""}
                  />
                )}
              </div>
              {currentTrack && (
                <>
                  <h2 className="albumTitleLarge">{currentTrack.name}</h2>
                  <p className="queueArtistName">{getArtists(currentTrack)}</p>
                </>
              )}
            </div>

            {/* COLUMNA DERECHA - Cola */}
            <div className="tracksColumn">
              {loading ? (
                <div className="tracksSkeleton">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div className="trackRow skeleton shimmer" key={i}>
                      <div className="skeletonLine short" />
                      <div className="skeletonLine tiny" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="tracksList">
                  {queue.map((track, idx) => (
                    <div
                      className="trackRow clickable"
                      key={`${track.id}-${idx}`}
                      onClick={() => playTrackUri(idx)}
                    >
                      <div className="trackLeft">
                        <span className="trackIndex">
                          {(idx + 1).toString().padStart(2, "0")}.
                        </span>
                        <span className="trackName">{track.name}</span>
                      </div>
                      <span className="trackDuration">
                        {formatDuration(track.duration_ms)}
                      </span>
                    </div>
                  ))}
                  <div className="warn">
                    <p>{t("Queue.Warn")}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
      {/* <MenuBottomComponent /> */}
    </div>
  )
}

export default Queue