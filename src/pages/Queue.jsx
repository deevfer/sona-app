import { useState, useEffect, useRef, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Capacitor, registerPlugin } from "@capacitor/core"
import "../styles/Queue.css"
import "../styles/Responsive.css"
import { useTranslation } from "react-i18next"
import { useProvider } from "../hooks/useProvider"
import AudioBars from "../components/AudioBars"

import SonaLogo from "../assets/sonaAnimated.svg?react"

const API_BASE = import.meta.env.VITE_API_BASE

const BG_KEY = "sona:selectedBg"
const COVER_KEY = "sona:lastCoverUrl"
const CONTEXT_KEY = "sona:currentContext"
const APPLE_LAST_TRACK_KEY = "sona:appleLastTrack"
const APPLE_QUEUE_INITIALIZED = "sona:appleQueueInitialized"

const isNativeIOS =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios"

let AppleMusicPlaybackPlugin = null
try {
  if (isNativeIOS) {
    AppleMusicPlaybackPlugin = registerPlugin("AppleMusicPlaybackPlugin")
  }
} catch {}

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

  const [selectedBg, setSelectedBg] = useState(() =>
    localStorage.getItem(BG_KEY) || "yellow"
  )

  useEffect(() => {
    const onBgChange = () => {
      setSelectedBg(localStorage.getItem(BG_KEY) || "yellow")
    }
    window.addEventListener("sona:bgChanged", onBgChange)
    return () => window.removeEventListener("sona:bgChanged", onBgChange)
  }, [])
  const [storedCover, setStoredCover] = useState(
    () => localStorage.getItem(COVER_KEY) || ""
  )
  const lastCoverRef = useRef(storedCover)

  const [coverTextClass, setCoverTextClass] = useState("text-light")

  useEffect(() => {
      if (selectedBg !== "cover" || !storedCover) return

      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas")
          canvas.width = 10
          canvas.height = 10
          const ctx = canvas.getContext("2d")
          ctx.drawImage(img, 0, 0, 10, 10)
          const data = ctx.getImageData(0, 0, 10, 10).data
          const totalPixels = 100

          let rSum = 0, gSum = 0, bSum = 0
          for (let i = 0; i < data.length; i += 4) {
            rSum += data[i]
            gSum += data[i + 1]
            bSum += data[i + 2]
          }

          const lum = ((rSum / totalPixels) * 299 + (gSum / totalPixels) * 587 + (bSum / totalPixels) * 114) / 1000
          setCoverTextClass(lum > 200 ? "text-dark" : "text-light")
        } catch {
          setCoverTextClass("text-light")
        }
      }
      img.onerror = () => setCoverTextClass("text-light")
      img.src = storedCover
    }, [selectedBg, storedCover])


  const [currentTrack, setCurrentTrack] = useState(null)
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [skipping, setSkipping] = useState(false)
  const [activeTrackId, setActiveTrackId] = useState("")
  const [isPlayingNow, setIsPlayingNow] = useState(false)
  
  useEffect(() => {
      const handler = (e) => {
        setActiveTrackId(String(e.detail?.trackId || ""))
        setIsPlayingNow(!!e.detail?.isPlaying)
      }
      window.addEventListener("sona:nowPlayingChanged", handler)
      return () => window.removeEventListener("sona:nowPlayingChanged", handler)
    }, [])
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
    raw: track,
  })

  const normalizeNativeAppleNowPlaying = (data) => {
    if (!data?.track) return null

    return {
      id: data.track.id,
      name: data.track.name || "",
      artists: Array.isArray(data.track.artists) ? data.track.artists : [],
      image: data.track.image || "/sonaDefault.png",
      duration_ms: data.track.duration_ms || 0,
      album: data.track.album || "",
    }
  }

  const getAppleCatalogTrackIds = (trackList = []) => {
    return trackList
      .map((track) => {
        return (
          track?.raw?.attributes?.playParams?.catalogId ||
          track?.raw?.attributes?.playParams?.id ||
          track?.raw?.id ||
          null
        )
      })
      .filter(Boolean)
  }

  const getAppleTrackMatchIds = (track) => {
    if (!track) return []

    const ids = [
      track?.id,
      track?.raw?.id,
      track?.raw?.attributes?.playParams?.id,
      track?.raw?.attributes?.playParams?.catalogId,
    ].filter(Boolean)

    return [...new Set(ids.map(String))]
  }

  const currentAppleQueueIndex = useMemo(() => {
    if (!appleQueue.length) return -1
  
    const currentIds = getAppleTrackMatchIds(appleCurrentTrack)
    if (currentIds.length) {
      const found = appleQueue.findIndex((track) => {
        const queueIds = getAppleTrackMatchIds(track)
        return queueIds.some((id) => currentIds.includes(id))
      })
  
      if (found >= 0) return found
    }
  
    if (typeof appleContext?.index === "number" && appleContext.index >= 0) {
      return Math.min(appleContext.index, appleQueue.length - 1)
    }
  
    return -1
  }, [appleQueue, appleCurrentTrack, appleContext])

  const visibleAppleQueue = useMemo(() => {
    if (!appleQueue.length) return []
  
    return appleQueue.map((track, index) => ({
      track,
      actualIndex: index,
      isActive: index === currentAppleQueueIndex,
    }))
  }, [appleQueue, currentAppleQueueIndex])

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
          if (isNativeIOS && AppleMusicPlaybackPlugin) {
            const nativeNowPlaying =
              await AppleMusicPlaybackPlugin.getNowPlaying().catch(() => null)
            const coverUrl =
              nativeNowPlaying?.track?.image || appleCurrentTrack?.image || ""

            if (coverUrl && coverUrl !== lastCoverRef.current) {
              lastCoverRef.current = coverUrl
              setStoredCover(coverUrl)
              localStorage.setItem(COVER_KEY, coverUrl)
            }

            return
          }

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
    selectedBg === "cover"
      ? coverTextClass
      : selectedBg === "black"
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
        const context = readStoredContext()

        if (cancelled) return

        setAppleContext(context || null)

        if (isNativeIOS && AppleMusicPlaybackPlugin) {
          const nativeNowPlaying =
            await AppleMusicPlaybackPlugin.getNowPlaying().catch(() => null)

          if (cancelled) return

          const current = normalizeNativeAppleNowPlaying(nativeNowPlaying)

          if (current) {
            setAppleCurrentTrack(current)
            saveAppleLastTrack(current)
          } else {
            setAppleCurrentTrack(null)
          }
        } else {
          const music = await getMusicInstance()
          const item = music?.nowPlayingItem || null

          if (cancelled) return

          if (item) {
            const current = {
              id: item.id,
              name: item.attributes?.name || "",
              artists: item.attributes?.artistName
                ? [item.attributes.artistName]
                : [],
              image: item.attributes?.artwork
                ? resolveAppleArtwork(item.attributes.artwork, 600, 600)
                : "/sonaDefault.png",
              duration_ms: item.attributes?.durationInMillis || 0,
            }

            setAppleCurrentTrack(current)
            saveAppleLastTrack(current)
          } else {
            setAppleCurrentTrack(null)
          }
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
              : await apiFetch(
                  `/api/apple-music/me/library/playlists/${context.id}`
                )

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

  const playAppleTrack = async (actualIndex) => {
    if (skipping || !isAppleMusic) return

    setSkipping(true)

    try {
      const context = readStoredContext()
      if (!context?.id || !context?.type) {
        setSkipping(false)
        return
      }

      if (isNativeIOS && AppleMusicPlaybackPlugin) {
        const trackIds =
          Array.isArray(context?.trackIds) && context.trackIds.length
            ? context.trackIds
            : getAppleCatalogTrackIds(appleQueue)

        if (!trackIds.length) {
          throw new Error("No Apple Music trackIds found")
        }

        const initialized = localStorage.getItem(APPLE_QUEUE_INITIALIZED)

        if (initialized === "true") {
          const trackIds =
            Array.isArray(appleContext?.trackIds) && appleContext.trackIds.length
              ? appleContext.trackIds
              : getAppleCatalogTrackIds(appleQueue)
          
          await AppleMusicPlaybackPlugin.changeToIndex({
            index: actualIndex,
            trackIds,
          })
        } else {
          await AppleMusicPlaybackPlugin.setQueueAndPlay({
            entries: trackIds.map((id) => ({ id, isLibrary: false })),
            index: actualIndex,
          })

          localStorage.setItem(APPLE_QUEUE_INITIALIZED, "true")
        }

        try {
          localStorage.setItem(
            APPLE_LAST_TRACK_KEY,
            JSON.stringify(appleQueue[actualIndex] || appleCurrentTrack || null)
          )

          localStorage.setItem(
            CONTEXT_KEY,
            JSON.stringify({
              ...context,
              index: actualIndex,
              trackIds,
            })
          )
        } catch {}

        navigate("/sona")
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
        await music.changeToMediaAtIndex(actualIndex)
      }

      try {
        localStorage.setItem(
          APPLE_LAST_TRACK_KEY,
          JSON.stringify(appleQueue[actualIndex] || appleCurrentTrack || null)
        )

        localStorage.setItem(
          CONTEXT_KEY,
          JSON.stringify({
            ...context,
            index: actualIndex,
            trackIds:
              context?.trackIds && context.trackIds.length
                ? context.trackIds
                : getAppleCatalogTrackIds(appleQueue),
          })
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
        "No upcoming tracks in the queue."
      )
    : translateOrFallback(
        "Queue.AppleMusicStartPlayback",
        "Start playback from Sona to see the current track and queue."
      )

  const hasSpotifyTrack = isSpotify && !!currentTrack
  const hasAppleTrack = isAppleMusic && !!appleCurrentTrack
  const hasActiveTrack = hasSpotifyTrack || hasAppleTrack

  const emptyQueueTitle = translateOrFallback(
    "Queue.EmptyTitle",
    "Nothing playing"
  )
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
                            className={`trackRow ${isActive ? "active" : ""}`}
                          
                            key={`${track.id}-${idx}`}
                            onClick={() => playSpotifyTrack(idx)}
                          >
                            <div className="trackLeft">
                              <span className="trackIndex">
                                  {(idx + 1).toString().padStart(2, "0")}.
                              </span>
                              {activeTrackId === String(track?.id || "") && isPlayingNow
                                  ? <AudioBars size={14} />
                                  : null
                              }
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
                    ) : visibleAppleQueue.length > 0 ? (
                      <div className="tracksList">
                        {visibleAppleQueue.map(({ track, actualIndex, isActive }) => (
                            <div
                              className={`trackRow ${isActive ? "active" : ""}`}
                              key={`${track.id}-${actualIndex}`}
                            >
                            <div className="trackLeft">
                              <span className="trackIndex">
                                  {(actualIndex + 1).toString().padStart(2, "0")}.
                              </span>
                              {(() => {
                                  const trackIds = [
                                    String(track?.id || ""),
                                    String(track?.raw?.id || ""),
                                    String(track?.raw?.attributes?.playParams?.catalogId || ""),
                                    String(track?.raw?.attributes?.playParams?.id || ""),
                                  ].filter(Boolean)
                                  const isActive = activeTrackId && trackIds.includes(activeTrackId) && isPlayingNow
                                  return isActive ? <AudioBars size={14} /> : null
                                })()}
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