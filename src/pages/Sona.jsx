import { useState, useRef, useEffect, useCallback } from "react"
import "../styles/Sona.css"
import "../styles/global.css"
import { useTranslation } from "react-i18next"

import MenuComponent from "../components/MenuComponent"
import MenuBottomComponent from "../components/MenuBottomComponent"
import { useProvider } from "../hooks/useProvider"

const API_BASE = import.meta.env.VITE_API_BASE

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

const VINYL_KEY = "sona:selectedVinyl"
const BG_KEY = "sona:selectedBg"
const COVER_KEY = "sona:lastCoverUrl"
const APPLE_LAST_TRACK_KEY = "sona:appleLastTrack"
const CONTEXT_KEY = "sona:currentContext"

function Sona() {
  const { t } = useTranslation()

  const {
    provider,
    ready,
    isSpotify,
    isAppleMusic,
    getMusicInstance,
    resolveAppleArtwork,
  } = useProvider()

  const [error, setError] = useState("")
  const [nowPlaying, setNowPlaying] = useState(() => {
    try {
      const raw = localStorage.getItem(APPLE_LAST_TRACK_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return { is_playing: false, progress_ms: 0, track: parsed }
    } catch {
      return null
    }
  })

  const [selectedVinyl, setSelectedVinyl] = useState(() =>
    localStorage.getItem(VINYL_KEY) || "/vinyl-1.svg"
  )
  useEffect(() => {
    localStorage.setItem(VINYL_KEY, selectedVinyl)
  }, [selectedVinyl])

  const [selectedBg, setSelectedBg] = useState(() =>
    localStorage.getItem(BG_KEY) || "yellow"
  )
  useEffect(() => {
    localStorage.setItem(BG_KEY, selectedBg)
  }, [selectedBg])

  const [needleDown, setNeedleDown] = useState(false)
  const [intentPlay, setIntentPlay] = useState(false)
  const [isPlayingUI, setIsPlayingUI] = useState(false)

  const NEEDLE_OUT = 1
  const NEEDLE_MIN = 18
  const NEEDLE_MAX = 35
  const [needleDeg, setNeedleDeg] = useState(NEEDLE_MIN)

  const vinylRef = useRef(null)
  const rafRef = useRef(null)
  const rotationRef = useRef(0)
  const speedRef = useRef(0)
  const targetSpeedRef = useRef(0)

  const titleRef = useRef(null)
  const artistRef = useRef(null)
  const [isTitleOverflow, setIsTitleOverflow] = useState(false)
  const [isArtistOverflow, setIsArtistOverflow] = useState(false)

  const cooldownUntilRef = useRef(0)
  const lastTrackIdRef = useRef(null)

  // Locks
  const appleBusyRef = useRef(false)
  const playPauseBusyRef = useRef(false)

  const translateOrFallback = (key, fallback) => {
    const value = t(key)
    return !value || value === key ? fallback : value
  }

  const saveAppleLastTrack = useCallback((track) => {
    try {
      if (track) {
        localStorage.setItem(APPLE_LAST_TRACK_KEY, JSON.stringify(track))
      }
    } catch {}
  }, [])

  const readStoredContext = useCallback(() => {
    try {
      const raw = localStorage.getItem(CONTEXT_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [])

  const ensureAppleQueueHydrated = useCallback(async () => {
    if (!isAppleMusic) return null

    const music = await getMusicInstance()
    if (!music) return null
    if (music.nowPlayingItem) return music

    const context = readStoredContext()
    if (!context?.id || !context?.type) return music

    try {
      await music.stop().catch(() => {})
      if (context.type === "album") {
        await music.setQueue({ album: context.id })
      } else if (context.type === "playlist") {
        await music.setQueue({ playlist: context.id })
      }
    } catch {}

    return music
  }, [getMusicInstance, isAppleMusic, readStoredContext])

  const apiFetch = useCallback(async (url, options = {}) => {
    const token = localStorage.getItem("token")
    if (!token) throw new Error("No hay token")

    const finalUrl = url.startsWith("http") ? url : `${API_BASE}${url}`

    const res = await fetch(finalUrl, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(options.headers || {}),
      },
    })

    if (res.status === 204) return null

    if (res.status === 429) {
      const retryHeader = res.headers.get("Retry-After")
      const secs = retryHeader ? Number(retryHeader) : 2
      throw {
        error: "rate_limited",
        retry_after: Number.isFinite(secs) ? secs : 2,
      }
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw body
    }

    return res.json()
  }, [])

  const spotifyNowPlaying = useCallback(
    () => (isSpotify ? apiFetch("/api/spotify/now-playing") : null),
    [apiFetch, isSpotify]
  )
  const spotifyPlaybackState = useCallback(
    () => (isSpotify ? apiFetch("/api/spotify/playback-state") : null),
    [apiFetch, isSpotify]
  )
  const spotifyPlay = useCallback(
    () => (isSpotify ? apiFetch("/api/spotify/play", { method: "PUT" }) : null),
    [apiFetch, isSpotify]
  )
  const spotifyPause = useCallback(
    () => (isSpotify ? apiFetch("/api/spotify/pause", { method: "PUT" }) : null),
    [apiFetch, isSpotify]
  )
  const spotifyNext = useCallback(
    () => (isSpotify ? apiFetch("/api/spotify/next", { method: "POST" }) : null),
    [apiFetch, isSpotify]
  )
  const spotifyPrevious = useCallback(
    () => (isSpotify ? apiFetch("/api/spotify/previous", { method: "POST" }) : null),
    [apiFetch, isSpotify]
  )

  const mapAppleNowPlaying = useCallback(
    (music) => {
      const item = music?.nowPlayingItem
      if (!item) return null

      return {
        is_playing: !!music.isPlaying,
        progress_ms: (music.currentPlaybackTime || 0) * 1000,
        track: {
          id: item.id,
          name: item.attributes?.name || "",
          artists: item.attributes?.artistName ? [item.attributes.artistName] : [],
          album: item.attributes?.albumName || "",
          image: item.attributes?.artwork
            ? resolveAppleArtwork(item.attributes.artwork, 600, 600)
            : "/sonaDefault.png",
          duration_ms: item.attributes?.durationInMillis || 0,
        },
      }
    },
    [resolveAppleArtwork]
  )

  const getAppleNowPlaying = useCallback(async () => {
    if (!isAppleMusic) return null
    const music = await getMusicInstance()
    if (!music) return null
    return mapAppleNowPlaying(music)
  }, [getMusicInstance, isAppleMusic, mapAppleNowPlaying])

  const fetchNowPlaying = useCallback(async () => {
    if (!provider) return null
    if (provider === "spotify") return spotifyNowPlaying()
    if (provider === "apple_music") return getAppleNowPlaying()
    return null
  }, [provider, spotifyNowPlaying, getAppleNowPlaying])

  const safeAppleResume = useCallback(async (music) => {
    if (!music) return

    if (music.isPlaying) return

    try {
      await music.play()
      return
    } catch (err) {
      const message = err?.message || ""

      if (message.includes("without a previous stop() or pause() call")) {
        try {
          await music.pause().catch(() => {})
          await new Promise((r) => setTimeout(r, 120))
          if (!music.isPlaying) {
            await music.play()
            return
          }
        } catch {}
      }

      throw err
    }
  }, [])

  // Rotation
  const loop = useCallback(() => {
    speedRef.current += (targetSpeedRef.current - speedRef.current) * 0.08

    if (Math.abs(speedRef.current) < 0.001 && targetSpeedRef.current === 0) {
      speedRef.current = 0
      rafRef.current = null
      return
    }

    rotationRef.current = (rotationRef.current + speedRef.current) % 360

    if (vinylRef.current) {
      vinylRef.current.style.transform = `rotate(${rotationRef.current}deg)`
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [])

  const startLoopIfNeeded = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(loop)
  }, [loop])

  const startSpin = useCallback(() => {
    targetSpeedRef.current = 0.4
    startLoopIfNeeded()
    setIsPlayingUI(true)
  }, [startLoopIfNeeded])

  const stopSpinSmooth = useCallback(() => {
    targetSpeedRef.current = 0
    startLoopIfNeeded()
    setIsPlayingUI(false)
  }, [startLoopIfNeeded])

  const setNeedleByProgress = useCallback((progress, duration) => {
    const p = progress ?? 0
    const d = duration ?? 0

    if (d > 0) {
      setNeedleDeg(NEEDLE_MIN + clamp(p / d, 0, 1) * (NEEDLE_MAX - NEEDLE_MIN))
    } else {
      setNeedleDeg(NEEDLE_MIN)
    }
  }, [])

  // Apple Music event listeners
  useEffect(() => {
    if (!ready || provider !== "apple_music") return

    let mounted = true
    let music = null

    const syncFromMusic = async () => {
      if (!mounted || appleBusyRef.current) return

      try {
        music = await getMusicInstance()
        if (!music) return

        const data = mapAppleNowPlaying(music)

        if (data?.track) {
          setNowPlaying(data)
          saveAppleLastTrack(data.track)
        }

        const playing = !!music.isPlaying
        setIsPlayingUI(playing)

        if (data?.track) {
          setNeedleByProgress(data?.progress_ms, data?.track?.duration_ms)

          if (playing) {
            setIntentPlay(true)
            setNeedleDown(true)
          } else {
            setIntentPlay(false)
            setNeedleDown(false)
          }

          const tid = data?.track?.id || null
          if (tid && lastTrackIdRef.current !== tid) {
            lastTrackIdRef.current = tid
            setNeedleDeg(NEEDLE_MIN)
          }
        } else {
          setIntentPlay(false)
          setNeedleDown(false)
          setIsPlayingUI(false)
        }
      } catch {
        // silencio
      }
    }

    const setup = async () => {
      try {
        music = await getMusicInstance()
        if (!music) return

        await new Promise((r) => setTimeout(r, 800))
        if (!mounted) return

        await syncFromMusic()

        if (typeof music.addEventListener === "function") {
          music.addEventListener("playbackStateDidChange", syncFromMusic)
          music.addEventListener("mediaItemDidChange", syncFromMusic)
          music.addEventListener("playbackProgressDidChange", syncFromMusic)
        }
      } catch {}
    }

    setup()

    return () => {
      mounted = false
      if (music && typeof music.removeEventListener === "function") {
        music.removeEventListener("playbackStateDidChange", syncFromMusic)
        music.removeEventListener("mediaItemDidChange", syncFromMusic)
        music.removeEventListener("playbackProgressDidChange", syncFromMusic)
      }
    }
  }, [
    ready,
    provider,
    getMusicInstance,
    mapAppleNowPlaying,
    setNeedleByProgress,
    saveAppleLastTrack,
  ])

  // Polling
  useEffect(() => {
    if (!ready || !provider) return

    let intervalId = null
    let cancelled = false

    const tick = async () => {
      if (cancelled || document.hidden) return
      if (appleBusyRef.current) return
      if (Date.now() < cooldownUntilRef.current) return

      try {
        const data = await fetchNowPlaying()
        if (cancelled) return

        if (!data) {
          if (provider === "apple_music") {
            setIsPlayingUI(false)
            setIntentPlay(false)
            setNeedleDown(false)
          }
          return
        }

        setNowPlaying(data)

        if (provider === "apple_music" && data?.track) {
          saveAppleLastTrack(data.track)
        }

        const playing = !!data?.is_playing
        setIsPlayingUI(playing)
        setNeedleByProgress(data?.progress_ms, data?.track?.duration_ms)

        if (playing) {
          setIntentPlay(true)
          setNeedleDown(true)
        } else {
          setIntentPlay(false)
          setNeedleDown(false)
        }

        const tid = data?.track?.id || null
        if (tid && lastTrackIdRef.current !== tid) {
          lastTrackIdRef.current = tid
          setNeedleDeg(NEEDLE_MIN)
        }
      } catch (e) {
        if (e?.error === "rate_limited") {
          const s = Math.max(1, Math.min(e?.retry_after || 2, 30))
          cooldownUntilRef.current = Date.now() + s * 1000
        }
      }
    }

    const initialDelay = provider === "apple_music" ? 1500 : 0

    const startPolling = () => {
      tick()
      intervalId = setInterval(tick, provider === "apple_music" ? 2000 : 8000)
    }

    if (initialDelay > 0) {
      const timeoutId = setTimeout(startPolling, initialDelay)
      return () => {
        cancelled = true
        clearTimeout(timeoutId)
        if (intervalId) clearInterval(intervalId)
      }
    } else {
      startPolling()
    }
  }, [ready, provider, fetchNowPlaying, setNeedleByProgress, saveAppleLastTrack])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Play/Pause
  const handlePlayPause = async () => {
    if (playPauseBusyRef.current) return
    playPauseBusyRef.current = true

    setError("")

    try {
      if (!provider) return

      if (provider === "spotify") {
        const state = await spotifyPlaybackState().catch(() => null)

        if (state?.is_playing) {
          await spotifyPause()
          setIntentPlay(false)
          setNeedleDown(false)
          setIsPlayingUI(false)
          return
        }

        const res = await spotifyPlay().catch((e) => e)
        if (res?.error === "no_active_device") {
          setError(t("connectDevice.noDevice"))
          return
        }

        setNeedleDeg(NEEDLE_MIN)
        setIntentPlay(true)
        setNeedleDown(true)
        setIsPlayingUI(true)

        const np = await spotifyNowPlaying().catch(() => null)
        if (np) setNowPlaying(np)
        return
      }

      if (provider === "apple_music") {
        appleBusyRef.current = true

        try {
          const music = await ensureAppleQueueHydrated()
          if (!music) return

          const actuallyPlaying = !!music.isPlaying

          if (actuallyPlaying) {
            await music.pause()
            await new Promise((r) => setTimeout(r, 120))

            setIntentPlay(false)
            setNeedleDown(false)
            setIsPlayingUI(false)
          } else {
            await safeAppleResume(music)

            setIntentPlay(true)
            setNeedleDown(true)
            setIsPlayingUI(true)

            await new Promise((r) => setTimeout(r, 250))

            const np = await getAppleNowPlaying()
            if (np) {
              setNowPlaying(np)

              if (np?.track) {
                saveAppleLastTrack(np.track)
              }

              if (np?.track?.id && lastTrackIdRef.current !== np.track.id) {
                lastTrackIdRef.current = np.track.id
                setNeedleDeg(NEEDLE_MIN)
              }
            }
          }
        } finally {
          appleBusyRef.current = false
        }
      }
    } catch (e) {
      appleBusyRef.current = false
      console.error(e)
      setError(e?.error?.message || e?.message || t("connect.error") || "Error")
    } finally {
      setTimeout(() => {
        playPauseBusyRef.current = false
      }, 180)
    }
  }

  const refreshAfterSkip = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 300))
    return fetchNowPlaying().catch(() => null)
  }, [fetchNowPlaying])

  const handleNext = async (e) => {
    e?.stopPropagation?.()
    setError("")

    try {
      if (!provider) return

      if (provider === "spotify") {
        const res = await spotifyNext().catch((err) => err)
        if (res?.error === "no_active_device") {
          setError(t("connectDevice.noDevice"))
          return
        }
      }

      if (provider === "apple_music") {
        appleBusyRef.current = true
        try {
          const music = await ensureAppleQueueHydrated()
          if (!music) return
          await music.skipToNextItem()
          await new Promise((r) => setTimeout(r, 300))
        } finally {
          appleBusyRef.current = false
        }
      }

      if (needleDown) setNeedleDeg(NEEDLE_MIN)

      const np = await refreshAfterSkip()
      if (np) {
        setNowPlaying(np)
        if (provider === "apple_music" && np?.track) saveAppleLastTrack(np.track)
      }
    } catch (err) {
      appleBusyRef.current = false
      console.error(err)
      setError(err?.error?.message || err?.message || t("connect.error") || "Error")
    }
  }

  const handlePrev = async (e) => {
    e?.stopPropagation?.()
    setError("")

    try {
      if (!provider) return

      if (provider === "spotify") {
        const res = await spotifyPrevious().catch((err) => err)
        if (res?.error === "no_active_device") {
          setError(t("connectDevice.noDevice"))
          return
        }
      }

      if (provider === "apple_music") {
        appleBusyRef.current = true
        try {
          const music = await ensureAppleQueueHydrated()
          if (!music) return
          await music.skipToPreviousItem()
          await new Promise((r) => setTimeout(r, 300))
        } finally {
          appleBusyRef.current = false
        }
      }

      if (needleDown) setNeedleDeg(NEEDLE_MIN)

      const np = await refreshAfterSkip()
      if (np) {
        setNowPlaying(np)
        if (provider === "apple_music" && np?.track) saveAppleLastTrack(np.track)
      }
    } catch (err) {
      appleBusyRef.current = false
      console.error(err)
      setError(err?.error?.message || err?.message || t("connect.error") || "Error")
    }
  }

  // Overflow check
  useEffect(() => {
    const check = () => {
      if (titleRef.current?.parentElement) {
        setIsTitleOverflow(
          titleRef.current.scrollWidth > titleRef.current.parentElement.clientWidth
        )
      }

      if (artistRef.current?.parentElement) {
        setIsArtistOverflow(
          artistRef.current.scrollWidth > artistRef.current.parentElement.clientWidth
        )
      }
    }

    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [nowPlaying])

  const isTrackLoading = false
  const trackName =
    nowPlaying?.track?.name ||
    translateOrFallback("Sona.NoTrackTitle", "Nothing playing")
  const showEmptyState = !nowPlaying?.track
  
  const artists = Array.isArray(nowPlaying?.track?.artists)
    ? nowPlaying.track.artists.join(", ")
    : translateOrFallback(
        "Sona.NoTrackSubtitle",
        provider === "apple_music"
          ? "Start playback from Sona to see Apple Music here."
          : ""
      )

  const cover = nowPlaying?.track?.image ?? "/icon-512.png"

  useEffect(() => {
    if (cover && cover !== "/sonaDefault.png") {
      localStorage.setItem(COVER_KEY, cover)
    }
  }, [cover])

  const savedCover = localStorage.getItem(COVER_KEY)

  const bgStyles =
    selectedBg === "cover"
      ? {
          backgroundImage: `url(${savedCover || cover})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {}

  const bgClass = selectedBg !== "cover" ? `bg-${selectedBg}` : "bg-cover"
  const textClass =
    selectedBg === "black" || selectedBg === "cover" ? "text-light" : "text-dark"

  if (!ready) return null

  return (
    <div className={`sonaBody ${bgClass} ${textClass}`} style={bgStyles}>
      <div className="overlayBackground"></div>

      <div className="container">
        <div className="menuTop">
          <MenuComponent
            selectedVinyl={selectedVinyl}
            onSelectVinyl={setSelectedVinyl}
            selectedBg={selectedBg}
            onSelectBg={setSelectedBg}
            cover={savedCover || cover}
            shareTrack={{
              name: nowPlaying?.track?.name,
              artists: nowPlaying?.track?.artists || [],
              image: savedCover || cover,
            }}
          />
        </div>

        <div className="vinylPlay">
          <div className="vinylContent">
            <div className="vinyl" ref={vinylRef} onClick={handlePlayPause}>
              <div className="albumImg">
                <img src={cover} alt="" />
              </div>
              <img className="vinylImg" src={selectedVinyl} alt="" />
            </div>

            <div className="pin">
              {/* <div className="basePin">
                <img src="/basepin.svg" alt="" />
              </div> */}

              <div
                className="pinTop"
                style={{
                  transform: `rotate(${needleDown ? needleDeg : NEEDLE_OUT}deg)`,
                  transition: "transform 1.3s",
                }}
                onTransitionEnd={(e) => {
                  if (e.propertyName !== "transform") return
                  if (needleDown && intentPlay) startSpin()
                  if (!needleDown && !intentPlay) stopSpinSmooth()
                }}
              >
                <img src="/pin_base.svg" alt="" />
              </div>
            </div>
          </div>
            <div
              className={`musicInfoControlers ${
                !isTrackLoading && !nowPlaying?.track ? "emptyText" : ""
              }`}
            >
            <div className="musicInfo">
              {isTrackLoading ? (
                <>
                  <div className="skeletonText title" />
                  <div className="skeletonText artist" />
                </>
              ) : !nowPlaying?.track ? (
                <div className="emptyStatePlayer">
                  <img src="/discos.svg" alt="" />
                  <h1>{t("sona.EmptyPlayerTitle")}</h1>
                  <p>{t("sona.EmptyPlayer")}</p>
                </div>
              ) : (
                <>
                  <h1 className={`marquee ${isTitleOverflow ? "run" : ""}`}>
                    <span ref={titleRef}>{trackName}</span>
                  </h1>
                  <p className={`marquee ${isArtistOverflow ? "run" : ""}`}>
                    <span ref={artistRef}>{artists}</span>
                  </p>
                </>
              )}

              {error ? <p className="error">{error}</p> : null}
            </div>

            {nowPlaying?.track && (
              <div className="controlers">
                <div className="play" onClick={handlePlayPause}>
                  <img src={isPlayingUI ? "/pause.svg" : "/play.svg"} alt="" />
                </div>

                <div className="backM" onClick={handlePrev}>
                  <img src="/back.svg" alt="" />
                </div>

                <div className="nextM" onClick={handleNext}>
                  <img src="/next.svg" alt="" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <MenuBottomComponent />
    </div>
  )
}

export default Sona