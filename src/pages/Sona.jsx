import { useState, useRef, useEffect, useCallback } from "react"
import { Capacitor } from "@capacitor/core"
import { useTranslation } from "react-i18next"
import MediaListenerPlugin from "../plugins/mediaListener"
import MenuComponent from "../components/MenuComponent"
import { useProvider } from "../hooks/useProvider"
import AppleMusicPlaybackPlugin from "../plugins/appleMusicPlayback"
import "../styles/Sona.css"
import "../styles/global.css"
import "../styles/Responsive.css"
import { sileo } from "sileo"

const API_BASE = import.meta.env.VITE_API_BASE

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

const VINYL_KEY = "sona:selectedVinyl"
const BG_KEY = "sona:selectedBg"
const COVER_KEY = "sona:lastCoverUrl"
const APPLE_LAST_TRACK_KEY = "sona:appleLastTrack"
const CONTEXT_KEY = "sona:currentContext"

const isNativeIOS =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios"

function Sona() {
  const { t } = useTranslation()
  const errorTitle = (text) => (
    <span style={{ color: "#ff5a5f", fontWeight: 600 }}>{text}</span>
  )

  const toastDescription = (text) => (
    <span style={{ color: "rgba(255,255,255,0.78)" }}>{text}</span>
  )

  const showErrorToast = ({ title, description }) => {
    sileo.error({
      title: errorTitle(title),
      description: toastDescription(description),
    })
  }
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
    localStorage.getItem(VINYL_KEY) || "/vinyl-1-1.png"
  )
  useEffect(() => {
    localStorage.setItem(VINYL_KEY, selectedVinyl)
  }, [selectedVinyl])

  const [selectedBg, setSelectedBg] = useState(() =>
    localStorage.getItem(BG_KEY) || "yellow"
  )
  const [savedCover, setSavedCover] = useState(() => localStorage.getItem(COVER_KEY) || "")
  const [coverTextClass, setCoverTextClass] = useState("text-light")
  useEffect(() => {
    localStorage.setItem(BG_KEY, selectedBg)
    window.dispatchEvent(new Event("sona:bgChanged"))
  }, [selectedBg])

  const [needleDown, setNeedleDown] = useState(false)
  const [intentPlay, setIntentPlay] = useState(false)
  const [isPlayingUI, setIsPlayingUI] = useState(false)
  const needleTransitionRef = useRef(false)

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

  const appleBusyRef = useRef(false)
  const playPauseBusyRef = useRef(false)

  const skipTransitionRef = useRef(false)
  const playPauseTransitionRef = useRef(false)
  const lastGoodNowPlayingRef = useRef(null)

  const [appleMusicAlert, setAppleMusicAlert] = useState(false)
  const appleMusicAlertShownRef = useRef(false)

  const showAlert = ({ title, description }) => {
    if (isNativeIOS && window.Capacitor?.Plugins?.Dialog) {
      window.Capacitor.Plugins.Dialog.alert({
        title,
        message: description,
      }).catch(() => {
        alert(`${title}\n${description}`)
      })
    } else {
      alert(`${title}\n${description}`)
    }
  }

  const translateOrFallback = (key, fallback) => {
    const value = t(key)
    return !value || value === key ? fallback : value
  }

  const getStoredAppleTrack = useCallback(() => {
    try {
      const raw = localStorage.getItem(APPLE_LAST_TRACK_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [])

  const saveAppleLastTrack = useCallback((track) => {
    try {
      if (track) {
        localStorage.setItem(APPLE_LAST_TRACK_KEY, JSON.stringify(track))
      }
    } catch {}
  }, [])

  const updateStoredContextIndex = useCallback((trackId) => {
    try {
      if (!trackId) return

      const raw = localStorage.getItem(CONTEXT_KEY)
      if (!raw) return

      const context = JSON.parse(raw)
      if (!Array.isArray(context?.trackIds)) return

      const newIndex = context.trackIds.findIndex((id) => id === trackId)
      if (newIndex < 0) return

      localStorage.setItem(
        CONTEXT_KEY,
        JSON.stringify({
          ...context,
          index: newIndex,
        })
      )
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

  const normalizeNativeAppleNowPlaying = useCallback(
    (data) => {
      const storedTrack = getStoredAppleTrack()

      if (!data) return null

      return {
        is_playing: !!data?.is_playing,
        progress_ms: data?.progress_ms || 0,
        track: data?.track
          ? {
              id: data.track.id,
              name: data.track.name || "",
              artists: Array.isArray(data.track.artists) ? data.track.artists : [],
              album: data.track.album || "",
              image: data.track.image || storedTrack?.image || "/sonaDefault.png",
              duration_ms: data.track.duration_ms || 0,
            }
          : null,
      }
    },
    [getStoredAppleTrack]
  )

  const getAppleNowPlaying = useCallback(async () => {
    if (!isAppleMusic) return null

    if (isNativeIOS) {
      const nativeData = await AppleMusicPlaybackPlugin.getNowPlaying().catch(() => null)
      return normalizeNativeAppleNowPlaying(nativeData)
    }

    const music = await getMusicInstance()
    if (!music) return null
    return mapAppleNowPlaying(music)
  }, [
    getMusicInstance,
    isAppleMusic,
    mapAppleNowPlaying,
    normalizeNativeAppleNowPlaying,
  ])

  const getOtherNowPlaying = useCallback(async () => {
    if (!MediaListenerPlugin) return null
    const data = await MediaListenerPlugin.getNowPlaying().catch(() => null)
    if (!data) return null

    if (data.is_apple_music) {
      window.dispatchEvent(new Event("sona:appleMusicDetected"))
    }

    if (!data.has_track) return { is_playing: data.is_playing, track: null }

    return {
      is_playing: data.is_playing,
      progress_ms: data.progress_ms || 0,
      track: {
        id: String(data.track?.id || ""),
        name: data.track?.name || "",
        artists: Array.isArray(data.track?.artists) ? data.track.artists : [],
        album: data.track?.album || "",
        image: data.track?.image || "/sonaDefault.png",
        duration_ms: data.track?.duration_ms || 0,
      },
    }
  }, [])

  const fetchNowPlaying = useCallback(async () => {
    if (!provider) return null
    if (provider === "spotify") return spotifyNowPlaying()
    if (provider === "apple_music") return getAppleNowPlaying()
    if (provider === "other") return getOtherNowPlaying()
    return null
  }, [provider, spotifyNowPlaying, getAppleNowPlaying, getOtherNowPlaying])

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

  const ensureAppleQueueHydrated = useCallback(async () => {
    if (!isAppleMusic) return null

    const context = readStoredContext()
    if (!context?.id || !context?.type) return null

    if (isNativeIOS) {
      try {
        const current = await AppleMusicPlaybackPlugin.getNowPlaying().catch(() => null)

        if (current?.track?.id) {
          return {
            hydrated: true,
            alreadyHadTrack: true,
          }
        }

        const entries =
          context.trackIds?.map((id) => ({
            id,
            isLibrary: false,
          })) || []

        if (!entries.length) {
          return {
            hydrated: false,
            alreadyHadTrack: false,
          }
        }

        await AppleMusicPlaybackPlugin.setQueueOnly({
          entries,
          index: context.index || 0,
        }).catch(() => null)

        return {
          hydrated: true,
          alreadyHadTrack: false,
        }
      } catch {
        return null
      }
    }

    const music = await getMusicInstance()
    if (!music) return null
    if (music.nowPlayingItem) return music

    try {
      await music.stop().catch(() => {})

      if (context.type === "album") {
        await music.setQueue({ album: context.id })
      } else if (context.type === "playlist") {
        await music.setQueue({ playlist: context.id })
      }
    } catch {}

    return music
  }, [getMusicInstance, isAppleMusic, isNativeIOS, readStoredContext])

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
    targetSpeedRef.current = 0.22
    startLoopIfNeeded()
  }, [startLoopIfNeeded])

  const stopSpinSmooth = useCallback(() => {
    targetSpeedRef.current = 0
    startLoopIfNeeded()
  }, [startLoopIfNeeded])

  const setNeedleByProgress = useCallback((progress, duration) => {
    if (needleTransitionRef.current) return

    const p = progress ?? 0
    const d = duration ?? 0

    if (d > 0) {
      setNeedleDeg(NEEDLE_MIN + clamp(p / d, 0, 1) * (NEEDLE_MAX - NEEDLE_MIN))
    } else {
      setNeedleDeg(NEEDLE_MIN)
    }
  }, [])

  useEffect(() => {
    if (nowPlaying?.track) {
      lastGoodNowPlayingRef.current = nowPlaying
      window.dispatchEvent(new CustomEvent("sona:nowPlayingChanged", {
        detail: { trackId: String(nowPlaying.track.id || ""), isPlaying: !!nowPlaying.is_playing }
      }))
    }
  }, [nowPlaying])

  useEffect(() => {
    if (isPlayingUI) {
      startSpin()
    } else {
      stopSpinSmooth()
    }
  }, [isPlayingUI, startSpin, stopSpinSmooth])

  // Apple Music detected alert
  useEffect(() => {
    const handleAppleDetected = () => {
      if (appleMusicAlertShownRef.current) return
      appleMusicAlertShownRef.current = true
      setAppleMusicAlert(true)
    }

    window.addEventListener("sona:appleMusicDetected", handleAppleDetected)
    return () => window.removeEventListener("sona:appleMusicDetected", handleAppleDetected)
  }, [])

  // Apple Music web sync
  useEffect(() => {
    if (!ready || provider !== "apple_music" || isNativeIOS) return

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
          updateStoredContextIndex(data.track?.id)
        }

        const playing = !!music.isPlaying
        setIsPlayingUI(playing)

        if (data?.track) {
          setNeedleByProgress(data?.progress_ms, data?.track?.duration_ms)

          if (playing) {
            setIntentPlay(true)
            if (!needleDown) needleTransitionRef.current = true
            setNeedleDown(true)
          } else {
            setIntentPlay(false)
            if (needleDown) needleTransitionRef.current = true
            setNeedleDown(false)
          }

          const tid = data?.track?.id || null
          if (tid && lastTrackIdRef.current !== tid) {
            lastTrackIdRef.current = tid
            setNeedleDeg(NEEDLE_MIN)
          }
        } else {
          setIntentPlay(false)
          if (needleDown) needleTransitionRef.current = true
          setNeedleDown(false)
          setIsPlayingUI(false)
        }
      } catch {}
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
    isNativeIOS,
    getMusicInstance,
    mapAppleNowPlaying,
    setNeedleByProgress,
    saveAppleLastTrack,
    updateStoredContextIndex,
    needleDown,
  ])

  // Main polling
  useEffect(() => {
    if (!provider) return
    if (provider !== "other" && !ready) return

    let intervalId = null
    let cancelled = false

    const tick = async () => {
      if (cancelled || document.hidden) return
      if (appleBusyRef.current) return
      if (Date.now() < cooldownUntilRef.current) return

      try {
        const data = await fetchNowPlaying()
        if (cancelled) return

        if (provider === "apple_music" && isNativeIOS) {
          if (!data) {
            if (
              (skipTransitionRef.current || playPauseTransitionRef.current) &&
              lastGoodNowPlayingRef.current
            ) {
              setNowPlaying(lastGoodNowPlayingRef.current)
              return
            }

            if (lastGoodNowPlayingRef.current) {
              setNowPlaying(lastGoodNowPlayingRef.current)
              return
            }

            setNowPlaying(null)
            setIsPlayingUI(false)
            setIntentPlay(false)
            if (needleDown) needleTransitionRef.current = true
            setNeedleDown(false)
            return
          }

          if (!data.track) {
            if (lastGoodNowPlayingRef.current) {
              setNowPlaying({
                ...lastGoodNowPlayingRef.current,
                is_playing: !!data.is_playing,
                progress_ms: data.progress_ms || 0,
              })
            }

            setIsPlayingUI(!!data.is_playing)

            if (!!data.is_playing) {
              setIntentPlay(true)
              if (!needleDown) needleTransitionRef.current = true
              setNeedleDown(true)
            } else {
              setIntentPlay(false)
              if (needleDown) needleTransitionRef.current = true
              setNeedleDown(false)
            }

            return
          }

          skipTransitionRef.current = false
          playPauseTransitionRef.current = false

          setNowPlaying(data)
          saveAppleLastTrack(data.track)
          updateStoredContextIndex(data.track?.id)

          const playing = !!data.is_playing
          setIsPlayingUI(playing)
          setNeedleByProgress(data.progress_ms, data.track?.duration_ms)

          if (playing) {
            setIntentPlay(true)
            if (!needleDown) needleTransitionRef.current = true
            setNeedleDown(true)
          } else {
            setIntentPlay(false)
            if (needleDown) needleTransitionRef.current = true
            setNeedleDown(false)
          }

          const tid = data.track?.id || null
          if (tid && lastTrackIdRef.current !== tid) {
            lastTrackIdRef.current = tid
            setNeedleDeg(NEEDLE_MIN)
          }

          return
        }

        if (!data) {
          if (provider === "apple_music") {
            setNowPlaying(null)
            setIsPlayingUI(false)
            setIntentPlay(false)
            if (needleDown) needleTransitionRef.current = true
            setNeedleDown(false)
          }
          return
        }

        setNowPlaying(data)

        if (provider === "apple_music" && data?.track) {
          saveAppleLastTrack(data.track)
          updateStoredContextIndex(data.track?.id)
        }

        const playing = !!data?.is_playing
        setIsPlayingUI(playing)
        setNeedleByProgress(data?.progress_ms, data?.track?.duration_ms)

        if (playing) {
          setIntentPlay(true)
          if (!needleDown) needleTransitionRef.current = true
          setNeedleDown(true)
        } else {
          setIntentPlay(false)
          if (needleDown) needleTransitionRef.current = true
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

    const getInterval = () => {
      if (provider === "apple_music") return 1200
      if (provider === "other") return 3000
      return 8000
    }

    const startPolling = () => {
      tick()
      intervalId = setInterval(tick, getInterval())
    }

    startPolling()

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [
    ready,
    provider,
    fetchNowPlaying,
    setNeedleByProgress,
    saveAppleLastTrack,
    updateStoredContextIndex,
    isNativeIOS,
    needleDown,
  ])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

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

          needleTransitionRef.current = true
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
        needleTransitionRef.current = true
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
          if (isNativeIOS) {
            playPauseTransitionRef.current = true

            let currentRaw = await AppleMusicPlaybackPlugin.getNowPlaying().catch(() => null)
            let current = normalizeNativeAppleNowPlaying(currentRaw)

            if (!current?.track) {
              const hydration = await ensureAppleQueueHydrated()

              currentRaw = await AppleMusicPlaybackPlugin.getNowPlaying().catch(() => null)
              current = normalizeNativeAppleNowPlaying(currentRaw)

              if (!current?.track && hydration?.hydrated) {
                current = {
                  is_playing: false,
                  progress_ms: 0,
                  track: getStoredAppleTrack(),
                }
              }
            }

            const playing = !!currentRaw?.is_playing

            if (playing) {
              const result = await AppleMusicPlaybackPlugin.pause().catch(() => null)
              const normalized = normalizeNativeAppleNowPlaying(result)

              needleTransitionRef.current = true
              setIntentPlay(false)
              setNeedleDown(false)
              setIsPlayingUI(false)

              if (normalized?.track) {
                setNowPlaying({
                  ...normalized,
                  is_playing: false,
                })
                saveAppleLastTrack(normalized.track)
                updateStoredContextIndex(normalized.track?.id)
              } else if (current?.track) {
                setNowPlaying({
                  ...current,
                  is_playing: false,
                })
                updateStoredContextIndex(current.track?.id)
              }
            } else {
              await ensureAppleQueueHydrated()

              const result = await AppleMusicPlaybackPlugin.play().catch(() => null)
              const normalized = normalizeNativeAppleNowPlaying(result)

              needleTransitionRef.current = true
              setIntentPlay(true)
              setNeedleDown(true)
              setIsPlayingUI(true)

              if (normalized?.track) {
                setNowPlaying({
                  ...normalized,
                  is_playing: true,
                })
                saveAppleLastTrack(normalized.track)
                updateStoredContextIndex(normalized.track?.id)

                if (
                  normalized?.track?.id &&
                  lastTrackIdRef.current !== normalized.track.id
                ) {
                  lastTrackIdRef.current = normalized.track.id
                  setNeedleDeg(NEEDLE_MIN)
                }
              } else if (current?.track) {
                setNowPlaying({
                  ...current,
                  is_playing: true,
                })
                updateStoredContextIndex(current.track?.id)
              }
            }

            setTimeout(() => {
              playPauseTransitionRef.current = false
            }, 700)

            return
          }

          const music = await ensureAppleQueueHydrated()
          if (!music) return

          const actuallyPlaying = !!music.isPlaying

          if (actuallyPlaying) {
            await music.pause()
            await new Promise((r) => setTimeout(r, 120))

            needleTransitionRef.current = true
            setIntentPlay(false)
            setNeedleDown(false)
            setIsPlayingUI(false)
          } else {
            await safeAppleResume(music)

            needleTransitionRef.current = true
            setIntentPlay(true)
            setNeedleDown(true)
            setIsPlayingUI(true)

            await new Promise((r) => setTimeout(r, 250))

            const np = await getAppleNowPlaying()
            if (np) {
              setNowPlaying(np)

              if (np?.track) {
                saveAppleLastTrack(np.track)
                updateStoredContextIndex(np.track?.id)
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
        return
      }

      if (provider === "other") {
        if (!MediaListenerPlugin) return

        const data = await MediaListenerPlugin.getNowPlaying().catch(() => null)
        const playing = !!data?.is_playing

        if (playing) {
          await MediaListenerPlugin.pause()
          needleTransitionRef.current = true
          setIntentPlay(false)
          setNeedleDown(false)
          setIsPlayingUI(false)
        } else {
          await MediaListenerPlugin.play()
          needleTransitionRef.current = true
          setIntentPlay(true)
          setNeedleDown(true)
          setIsPlayingUI(true)
        }

        await new Promise((r) => setTimeout(r, 300))
        const np = await getOtherNowPlaying()
        if (np) setNowPlaying(np)
        return
      }
    } catch (e) {
      appleBusyRef.current = false
      console.error(e)

      const msg = e?.message || e?.error?.message || e?.errorMessage || ""

      if (msg.includes("error 6")) {
        showAlert({ title: t("errors.playbackRestricted"), description: t("errors.playbackRestrictedDesc") })
      } else if (msg.includes("Failed to prepare")) {
        showAlert({ title: t("errors.queueFailed"), description: t("errors.queueFailedDesc") })
      } else {
        showAlert({ title: t("errors.playbackFailed"), description: t("errors.playbackFailedDesc") })
      }
    } finally {
      setTimeout(() => {
        playPauseBusyRef.current = false
      }, 180)
    }
  }

  const refreshAfterSkip = useCallback(async () => {
    return fetchNowPlaying().catch(() => null)
  }, [fetchNowPlaying])

  const handleNext = async (e) => {
    e?.stopPropagation?.()
    setError("")

    try {
      if (!provider) return

      if (provider === "other") {
        if (!MediaListenerPlugin) return
        await MediaListenerPlugin.next()
        if (needleDown) {
          needleTransitionRef.current = true
          setNeedleDeg(NEEDLE_MIN)
        }
        const np = await getOtherNowPlaying()
        if (np?.track) setNowPlaying(np)
        return
      }

      if (provider === "spotify") {
        const res = await spotifyNext().catch((err) => err)
        if (res?.error === "no_active_device") {
          setError(t("connectDevice.noDevice"))
          return
        }
      }

      if (provider === "apple_music") {
        appleBusyRef.current = true
        skipTransitionRef.current = true

        try {
          if (isNativeIOS) {
            const result = await AppleMusicPlaybackPlugin.next().catch(() => null)
            const normalized = normalizeNativeAppleNowPlaying(result)

            if (normalized?.track) {
              skipTransitionRef.current = false
              needleTransitionRef.current = true
              setNeedleDeg(NEEDLE_MIN)
              setNowPlaying(normalized)
              saveAppleLastTrack(normalized.track)
              updateStoredContextIndex(normalized.track?.id)
              return
            }
          } else {
            const music = await ensureAppleQueueHydrated()
            if (!music) return
            await music.skipToNextItem()
          }
        } finally {
          appleBusyRef.current = false
        }
      }

      if (needleDown) {
        needleTransitionRef.current = true
        setNeedleDeg(NEEDLE_MIN)
      }

      let np = await refreshAfterSkip()

      if ((!np || !np.track) && provider === "apple_music" && isNativeIOS) {
        await new Promise((r) => setTimeout(r, 250))
        np = await fetchNowPlaying().catch(() => null)
      }

      if ((!np || !np.track) && provider === "apple_music" && isNativeIOS) {
        await new Promise((r) => setTimeout(r, 350))
        np = await fetchNowPlaying().catch(() => null)
      }

      if (np?.track) {
        skipTransitionRef.current = false
        setNowPlaying(np)
        saveAppleLastTrack(np.track)
        updateStoredContextIndex(np.track?.id)
      }
    } catch (err) {
      appleBusyRef.current = false
      console.error(err)

      const msg = err?.message || err?.error?.message || err?.errorMessage || ""

      if (msg.includes("error 6")) {
        showAlert({ title: t("errors.playbackRestricted"), description: t("errors.playbackRestrictedDesc") })
      } else {
        showAlert({ title: t("errors.playbackFailed"), description: t("errors.playbackFailedDesc") })
      }
    }
  }

  const handlePrev = async (e) => {
    e?.stopPropagation?.()
    setError("")

    try {
      if (!provider) return

      if (provider === "other") {
        if (!MediaListenerPlugin) return
        await MediaListenerPlugin.previous()
        if (needleDown) {
          needleTransitionRef.current = true
          setNeedleDeg(NEEDLE_MIN)
        }
        const np = await getOtherNowPlaying()
        if (np?.track) setNowPlaying(np)
        return
      }

      if (provider === "spotify") {
        const res = await spotifyPrevious().catch((err) => err)
        if (res?.error === "no_active_device") {
          setError(t("connectDevice.noDevice"))
          return
        }
      }

      if (provider === "apple_music") {
        appleBusyRef.current = true
        skipTransitionRef.current = true

        try {
          if (isNativeIOS) {
            const result = await AppleMusicPlaybackPlugin.previous().catch(() => null)
            const normalized = normalizeNativeAppleNowPlaying(result)

            if (normalized?.track) {
              skipTransitionRef.current = false
              needleTransitionRef.current = true
              setNeedleDeg(NEEDLE_MIN)
              setNowPlaying(normalized)
              saveAppleLastTrack(normalized.track)
              updateStoredContextIndex(normalized.track?.id)
              return
            }
          } else {
            const music = await ensureAppleQueueHydrated()
            if (!music) return
            await music.skipToPreviousItem()
          }
        } finally {
          appleBusyRef.current = false
        }
      }

      if (needleDown) {
        needleTransitionRef.current = true
        setNeedleDeg(NEEDLE_MIN)
      }

      let np = await refreshAfterSkip()

      if ((!np || !np.track) && provider === "apple_music" && isNativeIOS) {
        await new Promise((r) => setTimeout(r, 250))
        np = await fetchNowPlaying().catch(() => null)
      }

      if ((!np || !np.track) && provider === "apple_music" && isNativeIOS) {
        await new Promise((r) => setTimeout(r, 350))
        np = await fetchNowPlaying().catch(() => null)
      }

      if (np?.track) {
        skipTransitionRef.current = false
        setNowPlaying(np)
        saveAppleLastTrack(np.track)
        updateStoredContextIndex(np.track?.id)
      }
    } catch (err) {
      appleBusyRef.current = false
      console.error(err)

      const msg = err?.message || err?.error?.message || err?.errorMessage || ""

      if (msg.includes("error 6")) {
        showErrorToast({
          title: t("errors.playbackRestricted"),
          description: t("errors.playbackRestrictedDesc"),
        })
      } else {
        showErrorToast({
          title: t("errors.playbackFailed"),
          description: t("errors.playbackFailedDesc"),
        })
      }
    }
  }

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

  const artists = Array.isArray(nowPlaying?.track?.artists)
    ? nowPlaying.track.artists.join(", ")
    : translateOrFallback(
        "Sona.NoTrackSubtitle",
        provider === "apple_music"
          ? "Start playback from Sona to see Apple Music here."
          : ""
      )

  const cover = nowPlaying?.track?.image ?? "/sonaDefault.png"

  useEffect(() => {
    if (cover && cover !== "/sonaDefault.png") {
      localStorage.setItem(COVER_KEY, cover)
      setSavedCover(cover)
    }
  }, [cover])


  useEffect(() => {
      if (selectedBg !== "cover" || !savedCover) return

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
      img.src = savedCover
    }, [selectedBg, savedCover])


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
  selectedBg === "cover"
    ? coverTextClass
    : selectedBg === "black"
      ? "text-light"
      : "text-dark"

    useEffect(() => {
      const track = nowPlaying?.track
      if (!track?.storeId) return
      if (track.image && track.image !== "/sonaDefault.png" && track.image !== "") return
  
      const fetchArtwork = async () => {
        try {
          const data = await apiFetch(`/api/apple-music/songs/${track.storeId}`)
          const artworkTemplate = data?.data?.[0]?.attributes?.artwork?.url
          if (artworkTemplate) {
            const resolvedUrl = artworkTemplate.replace('{w}', '600').replace('{h}', '600')
            setNowPlaying(prev => {
              if (!prev?.track) return prev
              return {
                ...prev,
                track: { ...prev.track, image: resolvedUrl }
              }
            })
          }
        } catch {}
      }
  
      fetchArtwork()
    }, [nowPlaying?.track?.storeId, nowPlaying?.track?.image, apiFetch])

  if (!ready && provider !== "other") return (
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
              name: null,
              artists: [],
              image: savedCover || cover,
            }}
          />
        </div>
        <div className="vinylPlay">
          <div className="vinylContent">
            <div className="vinyl">
              <div className="albumImg">
                <img src={savedCover || "/sonaDefault.png"} alt="" />
              </div>
              <img className="vinylImg" src={selectedVinyl} alt="" />
            </div>
            <div className="pin">
              <div className="pinTop" style={{ transform: `rotate(${NEEDLE_OUT}deg)`, transition: "transform 1.3s" }}>
                <img src="/pin_base.svg" alt="" />
              </div>
            </div>
          </div>
          <div className="musicInfoControlers emptyText">
            <div className="musicInfo">
              <div className="emptyStatePlayer">
                <img src="/discos.svg" alt="" />
                <h1>{t("sona.EmptyPlayerTitle")}</h1>
                <p>{t("sona.EmptyPlayer")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

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
              <div
                className="pinTop"
                style={{
                  transform: `rotate(${needleDown ? needleDeg : NEEDLE_OUT}deg)`,
                  transition: "transform 1.3s",
                }}
                onTransitionStart={() => {
                  needleTransitionRef.current = true
                }}
                onTransitionEnd={(e) => {
                  if (e.propertyName !== "transform") return
                  needleTransitionRef.current = false
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

      {appleMusicAlert && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
          onClick={() => setAppleMusicAlert(false)}
        >
          <div
            style={{
              background: "#1c1c1e",
              borderRadius: 20,
              padding: "30px 25px",
              maxWidth: 320,
              textAlign: "center",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img src="/AppleMusic.png" alt="" style={{ width: 60, marginBottom: 15 }} />
            <h2 style={{ color: "#fff", fontSize: 18, marginBottom: 8 }}>Apple Music Detected</h2>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
              {t("sona.appleMusicDetected") || "Switch to Apple Music provider in Settings to unlock full features: browse albums, playlists, queue, and more."}
            </p>
            <button
              onClick={() => setAppleMusicAlert(false)}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: 12,
                padding: "12px 30px",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Sona