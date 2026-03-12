import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import "../styles/Sona.css"
import "../styles/global.css"
import { useTranslation } from "react-i18next"

import MenuComponent from "../components/MenuComponent"

const API_BASE = import.meta.env.VITE_API_BASE


function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

const VINYL_KEY = "sona:selectedVinyl"
const BG_KEY = "sona:selectedBg"
const COVER_KEY = "sona:lastCoverUrl"


function Sona() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [error, setError] = useState("")
  const [nowPlaying, setNowPlaying] = useState(null)

  const [selectedVinyl, setSelectedVinyl] = useState(() => {
    return localStorage.getItem(VINYL_KEY) || "/vinyl-1.svg"
  })
  useEffect(() => {
    localStorage.setItem(VINYL_KEY, selectedVinyl)
  }, [selectedVinyl])

  const [selectedBg, setSelectedBg] = useState(() => {
    return localStorage.getItem(BG_KEY) || "yellow"
  })
  useEffect(() => {
    localStorage.setItem(BG_KEY, selectedBg)
  }, [selectedBg])

  const [needleDown, setNeedleDown] = useState(false)
  const [intentPlay, setIntentPlay] = useState(false)

  const [isSpotifyPlaying, setIsSpotifyPlaying] = useState(false)
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

  // ✅ Cooldown para rate limit (Spotify 429)
  const cooldownUntilRef = useRef(0)

  // -----------------------------
  // API helper (Sanctum token)
  // -----------------------------
  const apiFetch = async (url, options = {}) => {
    const token = localStorage.getItem("token")
    if (!token) throw new Error("No hay token de sesión")

    // ✅ soporta /api (proxy) y también absolute url si alguna vez lo usas
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

    // ✅ 429: tomar Retry-After (header) o retry_after (json)
    if (res.status === 429) {
      const retryAfterHeader = res.headers.get("Retry-After")
      const headerSecs = retryAfterHeader ? Number(retryAfterHeader) : NaN

      const body = await res.json().catch(() => ({}))
      const bodySecs = Number(body?.retry_after)

      const retry_after = Number.isFinite(headerSecs)
        ? headerSecs
        : Number.isFinite(bodySecs)
          ? bodySecs
          : 2

      throw { error: "rate_limited", retry_after }
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw body
    }

    return res.json()
  }

  const fetchPlaybackState = () => apiFetch("/api/spotify/playback-state", { method: "GET" })
  const spotifyPlay = () => apiFetch("/api/spotify/play", { method: "PUT" })
  const spotifyPause = () => apiFetch("/api/spotify/pause", { method: "PUT" })
  const spotifyNext = () => apiFetch("/api/spotify/next", { method: "POST" })
  const spotifyPrevious = () => apiFetch("/api/spotify/previous", { method: "POST" })
  const fetchNowPlaying = () => apiFetch("/api/spotify/now-playing", { method: "GET" })

  // -----------------------------
  // Rotación suave (RAF)
  // -----------------------------
  const loop = () => {
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
  }

  const startLoopIfNeeded = () => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(loop)
  }

  const startSpin = () => {
    targetSpeedRef.current = 1.5
    startLoopIfNeeded()
    setIsPlayingUI(true)
  }

  const stopSpinSmooth = () => {
    targetSpeedRef.current = 0
    startLoopIfNeeded()
    setIsPlayingUI(false)
  }

  // -----------------------------
  // Util: setear aguja por progreso
  // -----------------------------
  const setNeedleByProgress = (progress, duration) => {
    const p = progress ?? 0
    const d = duration ?? 0

    if (d > 0) {
      const ratio = clamp(p / d, 0, 1)
      setNeedleDeg(NEEDLE_MIN + ratio * (NEEDLE_MAX - NEEDLE_MIN))
    } else {
      setNeedleDeg(NEEDLE_MIN)
    }
  }

  // -----------------------------
  // Polling único (cada 3s)
  // -----------------------------
  const lastTrackIdRef = useRef(null)

  useEffect(() => {
    let id
    let cancelled = false

    const tick = async () => {
      const token = localStorage.getItem("token")
      if (!token) return
      if (cancelled) return

      // ✅ No pollear si está en background
      if (document.hidden) return

      // ✅ Cooldown por rate limit
      const now = Date.now()
      if (now < cooldownUntilRef.current) return

      try {
        const data = await fetchNowPlaying()
        if (cancelled || !data) return

        setNowPlaying(data)

        const playing = !!data?.is_playing
        setIsSpotifyPlaying(playing)
        setIsPlayingUI(playing)

        setNeedleByProgress(data?.progress_ms, data?.track?.duration_ms)

        if (playing) {
          setIntentPlay(true)
          setNeedleDown(true)
        } else {
          setIntentPlay(false)
          setNeedleDown(false)
        }

        const currentTrackId = data?.track?.id || null
        if (currentTrackId && lastTrackIdRef.current !== currentTrackId) {
          lastTrackIdRef.current = currentTrackId
          setNeedleDeg(NEEDLE_MIN)
        }
      } catch (e) {
        // ✅ rate limit: respetar retry-after (con cap razonable)
        if (e?.error === "rate_limited") {
          const secsRaw = Number.isFinite(e?.retry_after) ? e.retry_after : 2
          const secs = Math.max(1, Math.min(secsRaw, 30)) // cap 30s
          cooldownUntilRef.current = Date.now() + secs * 1000
          return
        }
        // silencio como ya lo tenías
      }
    }

    tick()
    id = setInterval(tick, 8000)

    // ✅ si vuelves a la pestaña, refresca rápido una vez
    const onVis = () => {
      if (!document.hidden) tick()
    }
    document.addEventListener("visibilitychange", onVis)

    return () => {
      cancelled = true
      if (id) clearInterval(id)
      document.removeEventListener("visibilitychange", onVis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // -----------------------------
  // Play/Pause
  // -----------------------------
  const handlePlayPause = async () => {
    setError("")
    try {
      const state = await fetchPlaybackState().catch(() => null)
      const playing = !!state?.is_playing

      if (playing) {
        await spotifyPause()
        setIntentPlay(false)
        setNeedleDown(false)
        setIsSpotifyPlaying(false)
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
      setIsSpotifyPlaying(true)
      setIsPlayingUI(true)

      const np = await fetchNowPlaying().catch(() => null)
      if (np) setNowPlaying(np)
    } catch (e) {
      console.error(e)
      setError(e?.error?.message || e?.message || t("connect.error") || "Error")
    }
  }

  // -----------------------------
  // NEXT / PREVIOUS
  // -----------------------------
  const refreshAfterSkip = async () => {
    const first = await fetchNowPlaying().catch(() => null)
    if (first?.track?.id) return first
    await new Promise((r) => setTimeout(r, 350))
    return fetchNowPlaying().catch(() => null)
  }

  const handleNext = async (e) => {
    e?.stopPropagation?.()
    setError("")
    try {
      const res = await spotifyNext().catch((err) => err)

      if (res?.error === "no_active_device") {
        setError(t("connectDevice.noDevice"))
        return
      }

      if (needleDown) setNeedleDeg(NEEDLE_MIN)
      const np = await refreshAfterSkip()
      if (np) setNowPlaying(np)
    } catch (err) {
      console.error(err)
      setError(err?.error?.message || err?.message || t("connect.error") || "Error")
    }
  }

  const handlePrev = async (e) => {
    e?.stopPropagation?.()
    setError("")
    try {
      const res = await spotifyPrevious().catch((err) => err)

      if (res?.error === "no_active_device") {
        setError(t("connectDevice.noDevice"))
        return
      }

      if (needleDown) setNeedleDeg(NEEDLE_MIN)
      const np = await refreshAfterSkip()
      if (np) setNowPlaying(np)
    } catch (err) {
      console.error(err)
      setError(err?.error?.message || err?.message || t("connect.error") || "Error")
    }
  }

  // overflow check
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

  const isTrackLoading = !nowPlaying?.track

  const trackName = nowPlaying?.track?.name
  const artists = Array.isArray(nowPlaying?.track?.artists)
    ? nowPlaying.track.artists.join(", ")
    : null

  const cover = nowPlaying?.track?.image ?? "/sonaDefault.png"

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
              <div className="basePin">
                <img src="/basepin.svg" alt="" />
              </div>

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
                <img src="/pin.svg" alt="" />
              </div>
            </div>
          </div>

          <div className="musicInfoControlers">
            <div className="musicInfo">
              {isTrackLoading ? (
                <>
                  <div className="skeletonText title" />
                  <div className="skeletonText artist" />
                </>
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
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sona