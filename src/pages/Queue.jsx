import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import "../styles/Queue.css"
import { useTranslation } from "react-i18next"
import { useProvider } from "../hooks/useProvider"

import SonaLogo from "../assets/sonaAnimated.svg?react"

const API_BASE = import.meta.env.VITE_API_BASE

const BG_KEY = "sona:selectedBg"
const COVER_KEY = "sona:lastCoverUrl"
const CONTEXT_KEY = "sona:currentContext"
const APPLE_LAST_TRACK_KEY = "sona:appleLastTrack"

function Queue() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const {
    provider,
    ready,
    isSpotify,
    isAppleMusic,
    getMusicInstance,
    resolveAppleArtwork,
  } = useProvider()

  const [selectedBg] = useState(() => localStorage.getItem(BG_KEY) || "yellow")
  const [storedCover, setStoredCover] = useState(
    () => localStorage.getItem(COVER_KEY) || ""
  )
  const lastCoverRef = useRef(storedCover)

  const [currentTrack, setCurrentTrack] = useState(null)
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [skipping, setSkipping] = useState(false)

  const [appleCurrentTrack, setAppleCurrentTrack] = useState(() => {
    try {
      const raw = localStorage.getItem(APPLE_LAST_TRACK_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [appleQueue, setAppleQueue] = useState([])
  const [appleContext, setAppleContext] = useState(null)

  const readStoredContext = () => {
    try {
      const raw = localStorage.getItem(CONTEXT_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  const saveAppleLastTrack = (track) => {
    try {
      if (track) {
        localStorage.setItem(APPLE_LAST_TRACK_KEY, JSON.stringify(track))
      }
    } catch {
      // noop
    }
  }

  const translateOrFallback = (key, fallback) => {
    const value = t(key)
    return !value || value === key ? fallback : value
  }

  const apiFetch = async (url, options = {}) => {
    const token = localStorage.getItem("token")
    if (!token) throw new Error("No hay token")

    const res = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(options.headers || {}),
      },
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw data
    return data
  }

  const getSpotifyImage = (track) =>
    track?.album?.images?.[0]?.url || "/sonaDefault.png"

  const getSpotifyArtists = (track) =>
    (track?.artists || []).map((a) => a.name).join(", ")

  const normalizeAppleTrack = (track) => ({
    id: track?.id,
    name: track?.attributes?.name || "",
    artists: track?.attributes?.artistName ? [track.attributes.artistName] : [],
    image: track?.attributes?.artwork
      ? resolveAppleArtwork(track.attributes.artwork, 600, 600)
      : "/sonaDefault.png",
    duration_ms: track?.attributes?.durationInMillis || 0,
  })

  useEffect(() => {
    if (!ready || !provider) return
    if (selectedBg !== "cover") return

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
        }

        if (isAppleMusic) {
          const music = await getMusicInstance()
          const item = music?.nowPlayingItem
          const coverUrl = item?.attributes?.artwork
            ? resolveAppleArtwork(item.attributes.artwork, 1200, 1200)
            : appleCurrentTrack?.image || ""

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
    const id = setInterval(fetchCurrentCover, 5000)
    return () => clearInterval(id)
  }, [
    selectedBg,
    ready,
    provider,
    isSpotify,
    isAppleMusic,
    getMusicInstance,
    resolveAppleArtwork,
    appleCurrentTrack,
  ])

  const bgClass = selectedBg !== "cover" ? `bg-${selectedBg}` : "bg-cover"
  const textClass =
    selectedBg === "black" || selectedBg === "cover" ? "text-light" : "text-dark"

  const bgStyles =
    selectedBg === "cover" && storedCover
      ? {
          backgroundImage: `url(${storedCover})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {}

  useEffect(() => {
    if (!ready) return

    let intervalId = null
    let cancelled = false

    const fetchSpotifyQueue = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) return

        const res = await fetch(`${API_BASE}/api/spotify/queue`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        })

        if (!res.ok) return
        const data = await res.json()

        if (cancelled) return

        setCurrentTrack(data?.currently_playing || null)
        setQueue(data?.queue || [])
      } catch (err) {
        console.error("Error fetching Spotify queue:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const fetchAppleQueue = async () => {
      try {
        const music = await getMusicInstance()
        const item = music?.nowPlayingItem || null
        const context = readStoredContext()

        if (cancelled) return

        setAppleContext(context || null)

        if (item) {
          const current = {
            id: item.id,
            name: item.attributes?.name || "",
            artists: item.attributes?.artistName ? [item.attributes.artistName] : [],
            image: item.attributes?.artwork
              ? resolveAppleArtwork(item.attributes.artwork, 600, 600)
              : "/sonaDefault.png",
            duration_ms: item.attributes?.durationInMillis || 0,
          }

          setAppleCurrentTrack(current)
          saveAppleLastTrack(current)
        }

        if (
          context &&
          context.provider === "apple_music" &&
          context.id &&
          (context.type === "album" || context.type === "playlist")
        ) {
          const data =
            context.type === "album"
              ? await apiFetch(`/api/apple-music/me/library/albums/${context.id}`)
              : await apiFetch(`/api/apple-music/me/library/playlists/${context.id}`)

          const trackItems =
            data?.data?.[0]?.relationships?.tracks?.data ||
            data?.relationships?.tracks?.data ||
            []

          if (!cancelled) {
            setAppleQueue(trackItems.map(normalizeAppleTrack).filter(Boolean))
          }
        } else {
          setAppleQueue([])
        }
      } catch (err) {
        console.error("Error fetching Apple queue:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    setLoading(true)

    if (!provider) {
      setLoading(false)
      return
    }

    if (isSpotify) {
      fetchSpotifyQueue()
      intervalId = setInterval(fetchSpotifyQueue, 5000)
    } else if (isAppleMusic) {
      fetchAppleQueue()
      intervalId = setInterval(fetchAppleQueue, 3000)
    } else {
      setLoading(false)
    }

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [ready, provider, isSpotify, isAppleMusic, getMusicInstance, resolveAppleArtwork])

  const playSpotifyTrack = async (index) => {
    if (skipping || !isSpotify) return

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

      navigate("/sona")
    } catch (err) {
      console.error("Error reproduciendo Spotify:", err)
      setSkipping(false)
    }
  }

  const playAppleTrack = async (index) => {
    if (skipping || !isAppleMusic) return

    setSkipping(true)

    try {
      const context = readStoredContext()
      if (!context?.id || !context?.type) {
        setSkipping(false)
        return
      }

      const music = await getMusicInstance()
      if (!music) {
        setSkipping(false)
        return
      }

      await music.setQueue(
        context.type === "album"
          ? { album: context.id }
          : { playlist: context.id }
      )

      if (typeof music.changeToMediaAtIndex === "function") {
        await music.changeToMediaAtIndex(index)
      }

      try {
        localStorage.setItem(
          APPLE_LAST_TRACK_KEY,
          JSON.stringify(appleQueue[index] || appleCurrentTrack || null)
        )
      } catch {}

      navigate("/sona")
    } catch (err) {
      console.error("Error preparando Apple Music:", err)
      setSkipping(false)
    }
  }

  const formatDuration = (ms) => {
    const min = Math.floor((ms || 0) / 60000)
    const sec = Math.floor(((ms || 0) % 60000) / 1000)
      .toString()
      .padStart(2, "0")
    return `${min}:${sec}`
  }

  if (!ready) return null

  const appleTitle = appleCurrentTrack?.name || appleContext?.name || "Apple Music"

  const appleSubtitle =
    appleCurrentTrack?.artists?.join(", ") ||
    translateOrFallback(
      "Queue.AppleMusicStartPlayback",
      "Start playback from Sona to see the current track."
    )

  const appleEmptyMessage = appleCurrentTrack
    ? translateOrFallback(
        "Queue.AppleMusicNoQueue",
        "Queue unavailable for the current Apple Music playback."
      )
    : translateOrFallback(
        "Queue.AppleMusicStartPlayback",
        "Start playback from Sona to see the current track and queue."
      )

  const hasSpotifyTrack = isSpotify && !!currentTrack
  const hasAppleTrack = isAppleMusic && !!appleCurrentTrack
  const hasActiveTrack = hasSpotifyTrack || hasAppleTrack

  const emptyQueueTitle = translateOrFallback("Queue.EmptyTitle", "Nothing playing")
  const emptyQueueText = translateOrFallback(
    "Queue.EmptyText",
    "Start playback from Sona to view your queue."
  )

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

          {!loading && !hasActiveTrack ? (
            <>

              <div className="titleQueue">
                <h1>{translateOrFallback("Queue.QueueTitle", "Queue")}</h1>
              </div>

              <div className="queueEmptyState">
                <div className="queueEmptyStateInner">
                  <div className="queueEmptyIcon">
                    <img src="/discos.svg" alt="" />
                  </div>
                  <h2>{emptyQueueTitle}</h2>
                  <p>{emptyQueueText}</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="titleQueue">
                <h1>{translateOrFallback("Queue.QueueTitle", "Queue")}</h1>
              </div>

              {isSpotify && (
                <div className="tracksView splitLayout fadeIn">
                  <div className="albumColumn">
                    <div className="albumCoverLarge">
                      {loading ? (
                        <div
                          className="skeletonBox shimmer"
                          style={{
                            width: "100%",
                            aspectRatio: "1",
                            borderRadius: "12px",
                          }}
                        />
                      ) : (
                        <img
                          src={
                            currentTrack
                              ? getSpotifyImage(currentTrack)
                              : "/sonaDefault.png"
                          }
                          alt={currentTrack?.name || ""}
                        />
                      )}
                    </div>

                    {currentTrack && (
                      <>
                        <h2 className="albumTitleLarge">{currentTrack.name}</h2>
                        <p className="queueArtistName">
                          {getSpotifyArtists(currentTrack)}
                        </p>
                      </>
                    )}
                  </div>

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
                            onClick={() => playSpotifyTrack(idx)}
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
                          <p>
                            {translateOrFallback(
                              "Queue.Warn",
                              "Tap a track to jump in the queue."
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isAppleMusic && (
                <div className="tracksView splitLayout fadeIn">
                  <div className="albumColumn">
                    <div className="albumCoverLarge">
                      {loading ? (
                        <div
                          className="skeletonBox shimmer"
                          style={{
                            width: "100%",
                            aspectRatio: "1",
                            borderRadius: "12px",
                          }}
                        />
                      ) : (
                        <img
                          src={
                            appleCurrentTrack?.image ||
                            appleContext?.image ||
                            "/sonaDefault.png"
                          }
                          alt={appleCurrentTrack?.name || appleContext?.name || ""}
                        />
                      )}
                    </div>

                    <>
                      <h2 className="albumTitleLarge">{appleTitle}</h2>
                      <p className="queueArtistName">{appleSubtitle}</p>
                    </>
                  </div>

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
                    ) : appleQueue.length > 0 ? (
                      <div className="tracksList">
                        {appleQueue.map((track, idx) => (
                          <div
                            className="trackRow clickable"
                            key={`${track.id}-${idx}`}
                            onClick={() => playAppleTrack(idx)}
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
                      </div>
                    ) : (
                      <div className="queueAppleMessage">
                        <p>{appleEmptyMessage}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!isSpotify && !isAppleMusic && !loading && (
                <div className="queueAppleMessage">
                  <p>
                    {translateOrFallback(
                      "Queue.NoProvider",
                      "No music provider connected."
                    )}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Queue