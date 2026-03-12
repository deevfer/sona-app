import { useState, useEffect, useRef } from "react"
import "../styles/Albums.css"
import MenuAlbums from "../components/MenuAlbums"
import SearchMenu from "../components/SearchMenu"
// import MenuBottomComponent from "../components/MenuBottomComponent"
import BackIcon from "../assets/back.svg?react"

const API_BASE = import.meta.env.VITE_API_BASE

const BG_KEY = "sona:selectedBg"
const TAB_KEY = "sona:albumsTab"
const VIEW_KEY = "sona:albumsView"
const COVER_KEY = "sona:lastCoverUrl"

function Albums() {

  // -----------------------------
  // Persistencia TAB
  // -----------------------------
  const [tab, setTab] = useState(() =>
    localStorage.getItem(TAB_KEY) || "albums"
  )

  useEffect(() => {
    localStorage.setItem(TAB_KEY, tab)
  }, [tab])

  // -----------------------------
  // Persistencia VIEW (grid/list)
  // -----------------------------
  const [view, setView] = useState(() =>
    localStorage.getItem(VIEW_KEY) || "grid"
  )

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view)
  }, [view])

  // -----------------------------
  // Background
  // -----------------------------
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
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        })
  
        if (!res.ok) return
        const data = await res.json()
  
        const coverUrl = data?.track?.image || ""
  
        if (coverUrl && coverUrl !== lastCoverRef.current) {
          lastCoverRef.current = coverUrl
          setStoredCover(coverUrl)
          localStorage.setItem(COVER_KEY, coverUrl)
        }
      } catch (err) {

      }
    }
  
    fetchCurrentCover()
    const id = setInterval(fetchCurrentCover, 3000)
  
    return () => clearInterval(id)
  }, [selectedBg])

  const bgClass =
    selectedBg !== "cover" ? `bg-${selectedBg}` : "bg-cover"

  const textClass =
    selectedBg === "black" || selectedBg === "cover"
      ? "text-light"
      : "text-dark"

  const bgStyles =
    selectedBg === "cover" && storedCover
      ? {
          backgroundImage: `url(${storedCover})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {}

  // -----------------------------
  // Grid data
  // -----------------------------
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // -----------------------------
  // Tracks state
  // -----------------------------
  const [mode, setMode] = useState("grid")
  const [selectedItem, setSelectedItem] = useState(null)
  const [tracks, setTracks] = useState([])
  const [loadingTracks, setLoadingTracks] = useState(false)

  // -----------------------------
  // 3D Vinyl Scroll
  // -----------------------------
  const scrollRef = useRef(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [viewportW, setViewportW] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  )
  
  const [spineColors, setSpineColors] = useState({})

  function extractColor(imageUrl, itemId) {
    if (spineColors[itemId]) return
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      const sampleW = 20
      const sampleH = img.height
      canvas.width = sampleW
      canvas.height = sampleH
      const ctx = canvas.getContext("2d")
      ctx.drawImage(img, 0, 0, sampleW, img.height, 0, 0, sampleW, sampleH)
      const data = ctx.getImageData(0, 0, sampleW, sampleH).data
      const totalPixels = sampleW * sampleH
  
      let rSum = 0, gSum = 0, bSum = 0
  
      for (let i = 0; i < data.length; i += 4) {
        rSum += data[i]
        gSum += data[i + 1]
        bSum += data[i + 2]
      }
  
      const r = Math.round(rSum / totalPixels)
      const g = Math.round(gSum / totalPixels)
      const b = Math.round(bSum / totalPixels)
  
      const lum = (r * 299 + g * 587 + b * 114) / 1000
      setSpineColors(prev => ({
        ...prev,
        [itemId]: {
          bg: `rgb(${r},${g},${b})`,
          text: lum > 140 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.6)",
        }
      }))
    }
    img.src = imageUrl
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setScrollLeft(el.scrollLeft)
    el.addEventListener("scroll", onScroll)
    const onResize = () => setViewportW(window.innerWidth)
    window.addEventListener("resize", onResize)
    return () => {
      el.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
    }
  }, [view, mode])

  function getAlbumStyle(index) {
    const albumW = 450
    const overlap = 360
    const spacing = albumW - overlap
    const albumCenter = index * spacing + albumW / 2
    const el = scrollRef.current
    const containerW = el ? el.clientWidth : viewportW
    const viewCenter = scrollLeft + containerW / 2
    const dist = albumCenter - viewCenter
    const maxDist = containerW * 0.6
    const norm = Math.max(-1, Math.min(1, dist / maxDist))
  
    const angle = 90 + norm * 40
  
    const zi = Math.round((1 - Math.abs(norm)) * 100)
  
    return {
      "--rot": `${angle}deg`,
      zIndex: Math.max(zi, 0),
    }
  }

  // -----------------------------
  // API helper
  // -----------------------------
  const apiFetch = async (url) => {
    const token = localStorage.getItem("token")
    if (!token) throw new Error("No hay token")

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw data
    return data
  }

  const fetchAlbums = () =>
    apiFetch(`${API_BASE}/api/spotify/albums`)

  const fetchPlaylists = () =>
    apiFetch(`${API_BASE}/api/spotify/playlists`)

  const fetchAlbumTracks = (id) =>
    apiFetch(`${API_BASE}/api/spotify/albums/${id}/tracks`)

  const fetchPlaylistTracks = (id) =>
    apiFetch(`${API_BASE}/api/spotify/playlists/${id}/items`)

  // -----------------------------
  // Cuando cambia tab
  // -----------------------------
  useEffect(() => {
    setMode("grid")
    setSelectedItem(null)
    setTracks([])
    setLoadingTracks(false)

    const load = async () => {
      setLoading(true)
      setError("")
      setItems([])

      try {
        const data =
          tab === "albums"
            ? await fetchAlbums()
            : await fetchPlaylists()

        const normalized =
          tab === "albums"
            ? (data?.items || [])
                .map((x) => x.album)
                .filter(Boolean)
            : data?.items || []

        setItems(normalized)
      } catch (e) {
        setError(e?.error?.message || "Error")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [tab])

  // -----------------------------
  // Abrir item
  // -----------------------------
  const onOpenItem = async (item) => {
    if (!item?.id) return

    setSelectedItem(item)
    setTracks([])
    setMode("tracks")
    setLoadingTracks(true)

    try {
      const data =
        tab === "albums"
          ? await fetchAlbumTracks(item.id)
          : await fetchPlaylistTracks(item.id)

      const normalized =
        tab === "albums"
          ? (data?.items || []).filter(Boolean)
          : (data?.items || [])
              .map((x) => x.item)
              .filter(Boolean)

      setTracks(normalized)
    } catch {
      setError("Error cargando tracks")
      setMode("grid")
    } finally {
      setLoadingTracks(false)
    }
  }

  const onBackToGrid = () => {
    setMode("grid")
    setSelectedItem(null)
    setTracks([])
    setLoadingTracks(false)
  }

  const playTrack = async (index) => {
    try {
      const token = localStorage.getItem("token")
      if (!token) return

      const contextUri = `spotify:${
        tab === "albums" ? "album" : "playlist"
      }:${selectedItem.id}`

      await fetch(
        `${API_BASE}/api/spotify/play-from-context`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            context_uri: contextUri,
            position: index,
          }),
        }
      )

      window.location.href = "/sona"
    } catch (err) {
      console.error("Error reproduciendo:", err)
    }
  }

  /* BUSQUEDA DE LISTAS */
  const [searchQuery, setSearchQuery] = useState("")
  const filteredItems = items.filter((item) =>
    (item?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className={`sonaBody ${bgClass} ${textClass}`} style={bgStyles}>
      <div className="overlayBackground"></div>

      <div className="container">
        <div className="albumsStage">

          <MenuAlbums tab={tab} onChangeTab={setTab} />

          <SearchMenu
            view={view}
            onToggleView={() =>
                setView((prev) => (prev === "grid" ? "list" : "grid"))
            }
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            />

          {error && <p className="error">{error}</p>}

          {/* ================= GRID / LIST ================= */}
          {mode === "grid" && (
            view === "grid" ? (
              <div className="listCovers fadeIn">
                {loading
                  ? Array.from({ length: 9 }).map((_, i) => (
                      <div className="coverItem skeleton" key={i}>
                        <div className="skeletonBox shimmer" />
                      </div>
                    ))
                  : filteredItems.map((item) => {
                      const cover =
                        item?.images?.[0]?.url ||
                        "/sonaDefault.png"

                      return (
                        <div
                          key={item.id}
                          className="coverItem"
                          onClick={() => onOpenItem(item)}
                        >
                          <img
                            src={cover}
                            alt={item?.name || ""}
                          />
                        </div>
                      )
                    })}
              </div>
            ) : (
                <div className="stack3D fadeIn" ref={scrollRef}>
                {loading
                  ? Array.from({ length: 9 }).map((_, i) => (
                      <div className="stackItem skeleton shimmer" key={i}>
                        <div className="skeletonBox" />
                      </div>
                    ))
                  : filteredItems.map((item, index) => {
                      const cover =
                        item?.images?.[0]?.url || "/sonaDefault.png"
              
                      return (
                        <div
                        key={item.id}
                        className="album3D"
                        style={getAlbumStyle(index)}
                        >
                        <div className="albumBox">

                            <div className="albumFront" onClick={() => onOpenItem(item)}>
                            <img src={cover} alt={item?.name || ""} />
                            </div>

                            <div className="albumBack" onClick={() => onOpenItem(item)}>
                            <img src={cover} alt="" />
                            </div>

                            <div
                            className="albumSpine"
                            onClick={() => onOpenItem(item)}
                            style={{
                                "--spine-bg": spineColors[item.id]?.bg || "rgb(30,30,30)",
                                "--spine-text": spineColors[item.id]?.text || "rgba(255,255,255,0.4)",
                            }}
                            ref={() => {
                                if (cover && item.id) extractColor(cover, item.id)
                            }}
                            >
                            <span>{item?.name}</span>
                            </div>

                        </div>
                        </div>
                      )
                    })}
              </div>
            )
          )}

          {/* ================= TRACKS ================= */}
          {mode === "tracks" && (
            <div className="tracksView splitLayout fadeIn">
              <div className="albumColumn">
                <div className="albumCoverLarge">
                  <img
                    src={
                      selectedItem?.images?.[0]?.url ||
                      "/sonaDefault.png"
                    }
                    alt={selectedItem?.name || ""}
                  />
                </div>

                <h2 className="albumTitleLarge">
                  {selectedItem?.name}
                </h2>

                <button
                  className="tracksBackFloating"
                  onClick={onBackToGrid}
                >
                  <BackIcon />
                </button>
              </div>

              <div className="tracksColumn">
                {loadingTracks ? (
                  <div className="tracksSkeleton">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        className="trackRow skeleton shimmer"
                        key={i}
                      >
                        <div className="skeletonLine short" />
                        <div className="skeletonLine tiny" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="tracksList">
                    {tracks.map((track, idx) => {
                      const duration =
                        track?.duration_ms || 0
                      const min = Math.floor(
                        duration / 60000
                      )
                      const sec = Math.floor(
                        (duration % 60000) / 1000
                      )
                        .toString()
                        .padStart(2, "0")

                      return (
                        <div
                          className="trackRow clickable"
                          key={track?.id || idx}
                          onClick={() =>
                            playTrack(idx)
                          }
                        >
                          <div className="trackLeft">
                            <span className="trackIndex">
                              {(idx + 1)
                                .toString()
                                .padStart(2, "0")}
                              .
                            </span>
                            <span className="trackName">
                              {track?.name}
                            </span>
                          </div>

                          <span className="trackDuration">
                            {min}:{sec}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* <MenuBottomComponent /> */}
    </div>
  )
}

export default Albums