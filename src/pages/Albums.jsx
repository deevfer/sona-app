import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import "../styles/Albums.css"
import MenuAlbums from "../components/MenuAlbums"
import SearchMenu from "../components/SearchMenu"
import BackIcon from "../assets/back.svg?react"
import { useProvider } from "../hooks/useProvider"
import { Capacitor } from "@capacitor/core"

const API_BASE = import.meta.env.VITE_API_BASE

const BG_KEY = "sona:selectedBg"
const TAB_KEY = "sona:albumsTab"
const VIEW_KEY = "sona:albumsView"
const COVER_KEY = "sona:lastCoverUrl"
const CONTEXT_KEY = "sona:currentContext"
const APPLE_LAST_TRACK_KEY = "sona:appleLastTrack"

function Albums() {
  const navigate = useNavigate()

  const {
    provider,
    ready,
    isSpotify,
    isAppleMusic,
    getMusicInstance,
    resolveAppleArtwork,
  } = useProvider()

  const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"

  const [tab, setTab] = useState(() =>
    localStorage.getItem(TAB_KEY) || "albums"
  )

  useEffect(() => {
    localStorage.setItem(TAB_KEY, tab)
  }, [tab])

  const [view, setView] = useState(() =>
    localStorage.getItem(VIEW_KEY) || "grid"
  )

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view)
  }, [view])

  const [selectedBg] = useState(() =>
    localStorage.getItem(BG_KEY) || "yellow"
  )

  const [storedCover, setStoredCover] = useState(() =>
    localStorage.getItem(COVER_KEY) || ""
  )

  const lastCoverRef = useRef(storedCover)

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [mode, setMode] = useState("grid")
  const [selectedItem, setSelectedItem] = useState(null)
  const [tracks, setTracks] = useState([])
  const [loadingTracks, setLoadingTracks] = useState(false)

  const scrollRef = useRef(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [viewportW, setViewportW] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  )

  const [spineColors, setSpineColors] = useState({})

  const getItemCover = (item) => {
    if (!item) return "/sonaDefault.png"
    if (item?.images?.[0]?.url) return item.images[0].url
    if (item?.artwork?.url) return resolveAppleArtwork(item.artwork)
    if (item?.attributes?.artwork?.url) {
      return resolveAppleArtwork(item.attributes.artwork)
    }
    return "/sonaDefault.png"
  }

  const normalizeSpotifyAlbum = (album) => ({
    id: album?.id,
    name: album?.name || "",
    images: album?.images || [],
    provider: "spotify",
    raw: album,
  })

  const normalizeSpotifyPlaylist = (playlist) => ({
    id: playlist?.id,
    name: playlist?.name || "",
    images: playlist?.images || [],
    provider: "spotify",
    raw: playlist,
  })

  const normalizeSpotifyTrack = (track) => ({
    id: track?.id,
    name: track?.name || "",
    duration_ms: track?.duration_ms || 0,
    provider: "spotify",
    raw: track,
  })

  const normalizeAppleCollection = (item) => ({
    id: item?.id,
    name: item?.attributes?.name || "",
    images: [{ url: resolveAppleArtwork(item?.attributes?.artwork) }],
    artwork: item?.attributes?.artwork || null,
    provider: "apple_music",
    raw: item,
  })

  const normalizeAppleTrack = (track) => ({
    id: track?.id,
    name: track?.attributes?.name || "",
    duration_ms: track?.attributes?.durationInMillis || 0,
    provider: "apple_music",
    raw: track,
  })

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

      let rSum = 0
      let gSum = 0
      let bSum = 0

      for (let i = 0; i < data.length; i += 4) {
        rSum += data[i]
        gSum += data[i + 1]
        bSum += data[i + 2]
      }

      const r = Math.round(rSum / totalPixels)
      const g = Math.round(gSum / totalPixels)
      const b = Math.round(bSum / totalPixels)

      const lum = (r * 299 + g * 587 + b * 114) / 1000

      setSpineColors((prev) => ({
        ...prev,
        [itemId]: {
          bg: `rgb(${r},${g},${b})`,
          text: lum > 140 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.6)",
        },
      }))
    }

    img.src = imageUrl
  }

  useEffect(() => {
    const onResize = () => {
      const width = scrollRef.current?.clientWidth || window.innerWidth
      setViewportW(width)
    }

    onResize()
    window.addEventListener("resize", onResize)

    return () => {
      window.removeEventListener("resize", onResize)
    }
  }, [view, mode, items.length])

  useEffect(() => {
    if (view !== "list" || mode !== "grid") return

    const id = requestAnimationFrame(() => {
      if (scrollRef.current) {
        setScrollLeft(scrollRef.current.scrollLeft)
        setViewportW(scrollRef.current.clientWidth || window.innerWidth)
      }
    })

    return () => cancelAnimationFrame(id)
  }, [view, mode, items.length])

  function getAlbumStyle(index) {
    const albumW = 450
    const overlap = 360
    const spacing = albumW - overlap
    const albumCenter = index * spacing + albumW / 2

    const containerW = scrollRef.current?.clientWidth || viewportW
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

  const handle3DScroll = (e) => {
    setScrollLeft(e.currentTarget.scrollLeft)
  }

  const apiFetch = async (url) => {
    const token = localStorage.getItem("token")
    if (!token) throw new Error("No hay token")

    const res = await fetch(`${API_BASE}${url}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw data
    return data
  }

  useEffect(() => {
    if (!ready) return
    if (selectedBg !== "cover") return
    if (!provider) return

    const fetchCurrentCover = async () => {
      try {
        if (isSpotify) {
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

          return
        }

        if (isAppleMusic && !isAndroidNative) {
          const music = await getMusicInstance()
          const currentItem = music?.nowPlayingItem
          const coverUrl = currentItem?.attributes?.artwork
            ? resolveAppleArtwork(currentItem.attributes.artwork, 1200, 1200)
            : ""

          if (coverUrl && coverUrl !== lastCoverRef.current) {
            lastCoverRef.current = coverUrl
            setStoredCover(coverUrl)
            localStorage.setItem(COVER_KEY, coverUrl)
          }
        }
      } catch {
        // silencioso
      }
    }

    fetchCurrentCover()
    const id = setInterval(fetchCurrentCover, 3000)

    return () => clearInterval(id)
  }, [
    ready,
    provider,
    selectedBg,
    isSpotify,
    isAppleMusic,
    isAndroidNative,
    getMusicInstance,
    resolveAppleArtwork,
  ])

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

  const fetchSpotifyAlbums = async () => {
    const data = await apiFetch("/api/spotify/albums")
    return (data?.items || [])
      .map((x) => normalizeSpotifyAlbum(x?.album))
      .filter(Boolean)
  }

  const fetchSpotifyPlaylists = async () => {
    const data = await apiFetch("/api/spotify/playlists")
    return (data?.items || [])
      .map(normalizeSpotifyPlaylist)
      .filter(Boolean)
  }

  const fetchSpotifyAlbumTracks = async (id) => {
    const data = await apiFetch(`/api/spotify/albums/${id}/tracks`)
    return (data?.items || [])
      .map(normalizeSpotifyTrack)
      .filter(Boolean)
  }

  const fetchSpotifyPlaylistTracks = async (id) => {
    const data = await apiFetch(`/api/spotify/playlists/${id}/items`)
    return (data?.items || [])
      .map((x) => normalizeSpotifyTrack(x?.item))
      .filter(Boolean)
  }

  const fetchAppleAlbums = async () => {
    const data = await apiFetch("/api/apple-music/me/library/albums")
    return (data?.data || [])
      .map(normalizeAppleCollection)
      .filter(Boolean)
  }

  const fetchApplePlaylists = async () => {
    const data = await apiFetch("/api/apple-music/me/library/playlists")
    return (data?.data || [])
      .map(normalizeAppleCollection)
      .filter(Boolean)
  }

  const fetchAppleAlbumTracks = async (id) => {
    const data = await apiFetch(`/api/apple-music/me/library/albums/${id}`)
    const trackItems =
      data?.data?.[0]?.relationships?.tracks?.data ||
      data?.relationships?.tracks?.data ||
      []

    return trackItems
      .map(normalizeAppleTrack)
      .filter(Boolean)
  }

  const fetchApplePlaylistTracks = async (id) => {
    const data = await apiFetch(`/api/apple-music/me/library/playlists/${id}`)
    const trackItems =
      data?.data?.[0]?.relationships?.tracks?.data ||
      data?.relationships?.tracks?.data ||
      []

    return trackItems
      .map(normalizeAppleTrack)
      .filter(Boolean)
  }

  useEffect(() => {
    if (!ready) return

    setMode("grid")
    setSelectedItem(null)
    setTracks([])
    setLoadingTracks(false)

    const load = async () => {
      if (!provider) {
        setItems([])
        setLoading(false)
        setError("No hay servicio de música conectado")
        return
      }

      setLoading(true)
      setError("")
      setItems([])

      try {
        let result = []

        if (isSpotify) {
          result =
            tab === "albums"
              ? await fetchSpotifyAlbums()
              : await fetchSpotifyPlaylists()
        } else if (isAppleMusic) {
          result =
            tab === "albums"
              ? await fetchAppleAlbums()
              : await fetchApplePlaylists()
        }

        setItems(result)
      } catch (e) {
        setError(e?.error?.message || e?.message || "Error")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [tab, ready, provider, isSpotify, isAppleMusic])

  const onOpenItem = async (item) => {
    if (!item?.id || !provider) return

    setSelectedItem(item)
    setTracks([])
    setMode("tracks")
    setLoadingTracks(true)
    setError("")

    try {
      let result = []

      if (isSpotify) {
        result =
          tab === "albums"
            ? await fetchSpotifyAlbumTracks(item.id)
            : await fetchSpotifyPlaylistTracks(item.id)
      } else if (isAppleMusic) {
        result =
          tab === "albums"
            ? await fetchAppleAlbumTracks(item.id)
            : await fetchApplePlaylistTracks(item.id)
      }

      setTracks(result)
    } catch (e) {
      setError(e?.error?.message || e?.message || "Error cargando tracks")
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

  const saveCurrentContext = () => {
    if (!selectedItem?.id || !provider) return

    localStorage.setItem(
      CONTEXT_KEY,
      JSON.stringify({
        provider,
        type: tab === "albums" ? "album" : "playlist",
        id: selectedItem.id,
        name: selectedItem.name,
        image: getItemCover(selectedItem),
      })
    )
  }

  const playTrack = async (index) => {
    try {
      if (!selectedItem?.id || !provider) return

      saveCurrentContext()

      if (isSpotify) {
        const token = localStorage.getItem("token")
        if (!token) return

        const contextUri = `spotify:${
          tab === "albums" ? "album" : "playlist"
        }:${selectedItem.id}`

        await fetch(`${API_BASE}/api/spotify/play-from-context`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            context_uri: contextUri,
            position: index,
          }),
        })

        navigate("/sona")
        return
      }

      if (isAppleMusic) {
        // Guardar track info
        try {
          localStorage.setItem(
            APPLE_LAST_TRACK_KEY,
            JSON.stringify(tracks[index] || null)
          )
        } catch {}

        // En Android nativo, MusicKit JS no puede reproducir
        // Abrir la canción en Apple Music app
        if (isAndroidNative) {
          const track = tracks[index]
          const catalogId =
            track?.raw?.attributes?.playParams?.catalogId ||
            track?.raw?.attributes?.playParams?.id ||
            track?.raw?.id ||
            track?.id

          if (catalogId) {
            window.open(
              `https://music.apple.com/song/${catalogId}`,
              "_blank"
            )
          }

          navigate("/sona")
          return
        }

        // En web, usar MusicKit JS normal
        const music = await getMusicInstance()
        if (!music) return

        await music.setQueue(
          tab === "albums"
            ? { album: selectedItem.id }
            : { playlist: selectedItem.id }
        )

        if (typeof music.changeToMediaAtIndex === "function") {
          await music.changeToMediaAtIndex(index)
        }

        navigate("/sona")
      }
    } catch (err) {
      console.error("Error reproduciendo:", err)
    }
  }

  const [searchQuery, setSearchQuery] = useState("")
  const filteredItems = items.filter((item) =>
    (item?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!ready) {
    return (
      <div
        className={`sonaBody ${
          selectedBg !== "cover" ? `bg-${selectedBg}` : "bg-cover"
        } ${
          selectedBg === "black" || selectedBg === "cover"
            ? "text-light"
            : "text-dark"
        }`}
      >
        <div className="overlayBackground"></div>
        <div className="container">
          <div className="albumsStage">
            <div className="listCovers fadeIn">
              {Array.from({ length: 9 }).map((_, i) => (
                <div className="coverItem skeleton" key={i}>
                  <div className="skeletonBox shimmer" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

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
            hidden={mode === "tracks"}
          />

          {error && <p className="error">{error}</p>}

          {mode === "grid" &&
            (view === "grid" ? (
              <div className="listCovers fadeIn">
                {loading
                  ? Array.from({ length: 9 }).map((_, i) => (
                      <div className="coverItem skeleton" key={i}>
                        <div className="skeletonBox shimmer" />
                      </div>
                    ))
                  : filteredItems.map((item) => {
                      const cover = getItemCover(item)

                      return (
                        <div
                          key={item.id}
                          className="coverItem"
                          onClick={() => onOpenItem(item)}
                        >
                          <img src={cover} alt={item?.name || ""} />
                        </div>
                      )
                    })}
              </div>
            ) : (
              <div className="stack3D fadeIn" ref={scrollRef} onScroll={handle3DScroll}>
                {loading
                  ? Array.from({ length: 9 }).map((_, i) => (
                      <div className="stackItem skeleton shimmer" key={i}>
                        <div className="skeletonBox" />
                      </div>
                    ))
                  : filteredItems.map((item, index) => {
                      const cover = getItemCover(item)

                      return (
                        <div
                          key={item.id}
                          className="album3D"
                          style={getAlbumStyle(index)}
                        >
                          <div className="albumBox">
                            <div
                              className="albumFront"
                              onClick={() => onOpenItem(item)}
                            >
                              <img src={cover} alt={item?.name || ""} />
                            </div>

                            <div
                              className="albumBack"
                              onClick={() => onOpenItem(item)}
                            >
                              <img src={cover} alt="" />
                            </div>

                            <div
                              className="albumSpine"
                              onClick={() => onOpenItem(item)}
                              style={{
                                "--spine-bg":
                                  spineColors[item.id]?.bg || "rgb(30,30,30)",
                                "--spine-text":
                                  spineColors[item.id]?.text ||
                                  "rgba(255,255,255,0.4)",
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
            ))}

          {mode === "tracks" && (
            <div className="tracksView splitLayout fadeIn">
              <div className="albumColumn">
                <div className="albumCoverLarge">
                  <img
                    src={getItemCover(selectedItem)}
                    alt={selectedItem?.name || ""}
                  />
                </div>

                <h2 className="albumTitleLarge">{selectedItem?.name}</h2>

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
                      <div className="trackRow skeleton shimmer" key={i}>
                        <div className="skeletonLine short" />
                        <div className="skeletonLine tiny" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="tracksList">
                    {tracks.map((track, idx) => {
                      const duration = track?.duration_ms || 0
                      const min = Math.floor(duration / 60000)
                      const sec = Math.floor((duration % 60000) / 1000)
                        .toString()
                        .padStart(2, "0")

                      return (
                        <div
                          className="trackRow clickable"
                          key={track?.id || idx}
                          onClick={() => playTrack(idx)}
                        >
                          <div className="trackLeft">
                            <span className="trackIndex">
                              {(idx + 1).toString().padStart(2, "0")}.
                            </span>
                            <span className="trackName">{track?.name}</span>
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
    </div>
  )
}

export default Albums