import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Capacitor } from "@capacitor/core"
import { Haptics, ImpactStyle } from "@capacitor/haptics"
import "../styles/Albums.css"
import "../styles/Responsive.css"
import MenuAlbums from "../components/MenuAlbums"
import SearchMenu from "../components/SearchMenu"
import BackIcon from "../assets/back.svg?react"
import { useProvider } from "../hooks/useProvider"
import AppleMusicPlaybackPlugin from "../plugins/appleMusicPlayback"
import AudioBars from "../components/AudioBars"
import { sileo } from "sileo"
import { useTranslation } from "react-i18next"

const API_BASE = import.meta.env.VITE_API_BASE

const BG_KEY = "sona:selectedBg"
const TAB_KEY = "sona:albumsTab"
const VIEW_KEY = "sona:albumsView"
const COVER_KEY = "sona:lastCoverUrl"
const CONTEXT_KEY = "sona:currentContext"
const APPLE_LAST_TRACK_KEY = "sona:appleLastTrack"

const isNativeIOS =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios"

const ALBUM_W = 450
const OVERLAP = 360
const SPACING = ALBUM_W - OVERLAP
const VIRTUAL_BUFFER = 5
const GRID_PRIORITY_COUNT = 18
const GRID_HAPTIC_STEP = 255

function Albums() {
  const navigate = useNavigate()
  const { t } = useTranslation()

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

  const {
    provider,
    ready,
    isSpotify,
    isAppleMusic,
    getMusicInstance,
    resolveAppleArtwork,
  } = useProvider()

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

  const [storedCover, setStoredCover] = useState(() =>
    localStorage.getItem(COVER_KEY) || ""
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

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [mode, setMode] = useState("grid")
  const [selectedItem, setSelectedItem] = useState(null)
  const [tracks, setTracks] = useState([])
  const [loadingTracks, setLoadingTracks] = useState(false)

  const scrollRef = useRef(null)
  const gridScrollRef = useRef(null)
  const scrollLeftRef = useRef(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [viewportW, setViewportW] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  )

  const [spineColors, setSpineColors] = useState({})
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeTrackId, setActiveTrackId] = useState("")
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      setActiveTrackId(String(e.detail?.trackId || ""))
      setIsPlaying(!!e.detail?.isPlaying)
    }
    window.addEventListener("sona:nowPlayingChanged", handler)
    return () => window.removeEventListener("sona:nowPlayingChanged", handler)
  }, [])

  const colorProcessingRef = useRef(new Set())
  const scrollRafRef = useRef(null)
  const gridRafRef = useRef(null)
  const lastHapticIndexRef = useRef(0)
  const lastGridHapticRef = useRef(0)
  const imagePreloadRef = useRef(new Set())
  const containerWidthRef = useRef(
    typeof window !== "undefined" ? window.innerWidth : 1024
  )
  const tickingRef = useRef(false)
  const hapticLockRef = useRef(false)

  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 15 })

  const cacheKey = useMemo(() => {
    if (!provider) return ""
    return `sona:albumsCache:${provider}:${tab}`
  }, [provider, tab])

  const getItemCover = useCallback(
    (item, size = 600) => {
      if (!item) return "/sonaDefault.png"

      if (item?.images?.[0]?.url) return item.images[0].url

      if (item?.artwork?.url) {
        return resolveAppleArtwork(item.artwork, size, size)
      }

      if (item?.attributes?.artwork?.url) {
        return resolveAppleArtwork(item.attributes.artwork, size, size)
      }

      return "/sonaDefault.png"
    },
    [resolveAppleArtwork]
  )

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
    images: [{ url: resolveAppleArtwork(item?.attributes?.artwork, 320, 320) }],
    artwork: item?.attributes?.artwork || null,
    provider: "apple_music",
    raw: item,
  })

  const normalizeAppleTrack = (track) => ({
    id: track?.id,
    name: track?.attributes?.name || "",
    artists: track?.attributes?.artistName ? [track.attributes.artistName] : [],
    image: track?.attributes?.artwork
      ? resolveAppleArtwork(track.attributes.artwork, 320, 320)
      : "/sonaDefault.png",
    duration_ms: track?.attributes?.durationInMillis || 0,
    provider: "apple_music",
    raw: track,
  })

  const getAppleStoreIds = (trackList = []) => {
    return trackList
      .map((track) => {
        const playParams = track?.raw?.attributes?.playParams || {}
        return playParams?.catalogId || playParams?.id || null
      })
      .filter(Boolean)
  }

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return items
    return items.filter((item) =>
      (item?.name || "").toLowerCase().includes(q)
    )
  }, [items, searchQuery])

  const preloadImages = useCallback(
    (list, count = GRID_PRIORITY_COUNT) => {
      list.slice(0, count).forEach((item, idx) => {
        const src = getItemCover(item, idx < 6 ? 320 : 220)
        if (!src || imagePreloadRef.current.has(src)) return

        imagePreloadRef.current.add(src)
        const img = new Image()
        img.decoding = "async"
        img.src = src
      })
    },
    [getItemCover]
  )

  const extractColor = useCallback(
    (imageUrl, itemId) => {
      if (!imageUrl || !itemId) return
      if (spineColors[itemId]) return
      if (colorProcessingRef.current.has(itemId)) return

      colorProcessingRef.current.add(itemId)

      const img = new Image()
      img.crossOrigin = "anonymous"
      img.decoding = "async"

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas")
          const sampleW = 10
          const sampleH = Math.max(1, Math.min(img.height, 10))

          canvas.width = sampleW
          canvas.height = sampleH

          const ctx = canvas.getContext("2d", { willReadFrequently: true })
          if (!ctx) {
            colorProcessingRef.current.delete(itemId)
            return
          }

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
        } catch {
          // noop
        } finally {
          colorProcessingRef.current.delete(itemId)
        }
      }

      img.onerror = () => {
        colorProcessingRef.current.delete(itemId)
      }

      img.src = imageUrl
    },
    [spineColors]
  )

  useEffect(() => {
    const onResize = () => {
      const width = scrollRef.current?.clientWidth || window.innerWidth
      containerWidthRef.current = width
      setViewportW(width)
    }

    onResize()
    window.addEventListener("resize", onResize)

    return () => {
      window.removeEventListener("resize", onResize)
    }
  }, [view, mode, items.length])

  const getCurrentIndex = (currentScroll) => {
    return Math.max(0, Math.round(currentScroll / SPACING))
  }

  const updateVisibleRange = useCallback(
    (currentScroll) => {
      const containerW = containerWidthRef.current || viewportW
      const startIndex = Math.max(
        0,
        Math.floor(currentScroll / SPACING) - VIRTUAL_BUFFER
      )
      const endIndex = Math.min(
        filteredItems.length - 1,
        Math.ceil((currentScroll + containerW) / SPACING) + VIRTUAL_BUFFER
      )

      setVisibleRange((prev) => {
        if (prev.start === startIndex && prev.end === endIndex) return prev
        return { start: startIndex, end: endIndex }
      })
    },
    [filteredItems.length, viewportW]
  )

  useEffect(() => {
    if (view !== "list" || mode !== "grid") return

    const id = requestAnimationFrame(() => {
      if (scrollRef.current) {
        const current = scrollRef.current.scrollLeft
        scrollLeftRef.current = current
        setScrollLeft(current)
        setViewportW(scrollRef.current.clientWidth || window.innerWidth)
        lastHapticIndexRef.current = getCurrentIndex(current)
        updateVisibleRange(current)
      }
    })

    return () => cancelAnimationFrame(id)
  }, [view, mode, filteredItems.length, updateVisibleRange])

  useEffect(() => {
    if (view !== "list" || mode !== "grid" || loading) return
    if (!filteredItems.length) return

    const runner = window.requestIdleCallback
      ? window.requestIdleCallback
      : (cb) => setTimeout(cb, 80)

    const cancelRunner = window.cancelIdleCallback
      ? window.cancelIdleCallback
      : clearTimeout

    const task = runner(() => {
      filteredItems.slice(0, GRID_PRIORITY_COUNT).forEach((item) => {
        const cover = getItemCover(item, 180)
        extractColor(cover, item.id)
      })
    })

    return () => cancelRunner(task)
  }, [filteredItems, view, mode, loading, getItemCover, extractColor])

  function getAlbumStyle(index) {
    const albumCenter = index * SPACING + ALBUM_W / 2
    const containerW = containerWidthRef.current || viewportW
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

  const triggerHaptic = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return
    if (hapticLockRef.current) return

    hapticLockRef.current = true

    try {
      await Haptics.impact({ style: ImpactStyle.Light })
    } catch {
      // noop
    } finally {
      setTimeout(() => {
        hapticLockRef.current = false
      }, 70)
    }
  }, [])

  const handle3DScroll = useCallback(
    (e) => {
      const nextScroll = e.currentTarget.scrollLeft
      scrollLeftRef.current = nextScroll

      if (tickingRef.current) return
      tickingRef.current = true

      requestAnimationFrame(() => {
        updateVisibleRange(nextScroll)

        const currentIndex = getCurrentIndex(nextScroll)
        if (currentIndex !== lastHapticIndexRef.current) {
          lastHapticIndexRef.current = currentIndex
          void triggerHaptic()
        }

        setScrollLeft((prev) => {
          if (Math.abs(prev - nextScroll) < 12) return prev
          return nextScroll
        })

        tickingRef.current = false
      })
    },
    [triggerHaptic, updateVisibleRange]
  )

  const handleGridScroll = useCallback(
    (e) => {
      const el = e.currentTarget || gridScrollRef.current
      if (!el) return

      if (gridRafRef.current) cancelAnimationFrame(gridRafRef.current)

      gridRafRef.current = requestAnimationFrame(() => {
        const verticalScrollable = el.scrollHeight > el.clientHeight + 2
        const scrollPos = verticalScrollable ? el.scrollTop : el.scrollLeft
        const currentIndex = Math.round(scrollPos / GRID_HAPTIC_STEP)

        if (Capacitor.isNativePlatform()) {
          if (currentIndex !== lastGridHapticRef.current) {
            lastGridHapticRef.current = currentIndex
            void triggerHaptic()
          }
        }

        gridRafRef.current = null
      })
    },
    [triggerHaptic]
  )

  useEffect(() => {
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)
      if (gridRafRef.current) cancelAnimationFrame(gridRafRef.current)
    }
  }, [])

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

        if (isAppleMusic) {
          if (isNativeIOS) {
            const nativeNowPlaying =
              await AppleMusicPlaybackPlugin.getNowPlaying().catch(() => null)

            const coverUrl = nativeNowPlaying?.track?.image || ""

            if (coverUrl && coverUrl !== lastCoverRef.current) {
              lastCoverRef.current = coverUrl
              setStoredCover(coverUrl)
              localStorage.setItem(COVER_KEY, coverUrl)
            }

            return
          }

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
    const id = setInterval(fetchCurrentCover, 5000)

    return () => clearInterval(id)
  }, [
    ready,
    provider,
    selectedBg,
    isSpotify,
    isAppleMusic,
    getMusicInstance,
    resolveAppleArtwork,
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

  const fetchSpotifyAlbums = async () => {
    const data = await apiFetch("/api/spotify/albums")
    return (data?.items || [])
      .map((x) => normalizeSpotifyAlbum(x?.album))
      .filter(Boolean)
  }

  const fetchSpotifyPlaylists = async () => {
    const data = await apiFetch("/api/spotify/playlists")
    return (data?.items || []).map(normalizeSpotifyPlaylist).filter(Boolean)
  }

  const fetchSpotifyAlbumTracks = async (id) => {
    const data = await apiFetch(`/api/spotify/albums/${id}/tracks`)
    return (data?.items || []).map(normalizeSpotifyTrack).filter(Boolean)
  }

  const fetchSpotifyPlaylistTracks = async (id) => {
    const data = await apiFetch(`/api/spotify/playlists/${id}/items`)
    return (data?.items || [])
      .map((x) => normalizeSpotifyTrack(x?.item))
      .filter(Boolean)
  }

  const fetchAppleAlbums = async () => {
    const data = await apiFetch("/api/apple-music/me/library/albums")
    return (data?.data || []).map(normalizeAppleCollection).filter(Boolean)
  }

  const fetchApplePlaylists = async () => {
    const data = await apiFetch("/api/apple-music/me/library/playlists")
    return (data?.data || []).map(normalizeAppleCollection).filter(Boolean)
  }

  const fetchAppleAlbumTracks = async (id) => {
    const data = await apiFetch(`/api/apple-music/me/library/albums/${id}`)
    const trackItems =
      data?.data?.[0]?.relationships?.tracks?.data ||
      data?.relationships?.tracks?.data ||
      []

    return trackItems.map(normalizeAppleTrack).filter(Boolean)
  }

  const fetchApplePlaylistTracks = async (id) => {
    const data = await apiFetch(`/api/apple-music/me/library/playlists/${id}`)
    const trackItems =
      data?.data?.[0]?.relationships?.tracks?.data ||
      data?.relationships?.tracks?.data ||
      []

    return trackItems.map(normalizeAppleTrack).filter(Boolean)
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

      setError("")

      let hadCache = false

      try {
        if (cacheKey) {
          const cachedRaw = sessionStorage.getItem(cacheKey)
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw)
            if (Array.isArray(cached) && cached.length) {
              hadCache = true
              setItems(cached)
              preloadImages(cached, GRID_PRIORITY_COUNT)
            }
          }
        }
      } catch {
        // noop
      }

      setLoading(!hadCache)

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
        preloadImages(result, GRID_PRIORITY_COUNT)

        if (cacheKey) {
          sessionStorage.setItem(cacheKey, JSON.stringify(result))
        }
      } catch (e) {
        if (!hadCache) {
          setError(e?.error?.message || e?.message || "Error")
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [
    tab,
    ready,
    provider,
    isSpotify,
    isAppleMusic,
    cacheKey,
    preloadImages,
  ])

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

  const saveCurrentContext = (index = 0) => {
    if (!selectedItem?.id || !provider) return
    localStorage.removeItem("sona:appleQueueInitialized")
    localStorage.setItem(
      CONTEXT_KEY,
      JSON.stringify({
        provider,
        type: tab === "albums" ? "album" : "playlist",
        id: selectedItem.id,
        name: selectedItem.name,
        image: getItemCover(selectedItem, 600),
        index,
        trackIds: isAppleMusic
          ? tracks
              .map((track) =>
                track?.raw?.attributes?.playParams?.catalogId ||
                track?.raw?.attributes?.playParams?.id ||
                track?.raw?.id ||
                null
              )
              .filter(Boolean)
          : [],
      })
    )
  }

  const playTrack = async (index) => {
    try {
      if (!selectedItem?.id || !provider) return

      saveCurrentContext(index)

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
        if (isNativeIOS) {
          const storeIds = getAppleStoreIds(tracks)

          if (!storeIds.length) {
            throw new Error("No Apple Music storeIds found")
          }

          await AppleMusicPlaybackPlugin.setQueueAndPlay({
            entries: storeIds.map((id) => ({
              id,
              isLibrary: false,
            })),
            index,
          })

          try {
            localStorage.setItem(
              APPLE_LAST_TRACK_KEY,
              JSON.stringify(tracks[index] || null)
            )
          } catch {}

          navigate("/sona")
          return
        }

        const music = await getMusicInstance()
        if (!music) {
          throw new Error("Apple Music instance not available")
        }

        await music.setQueue(
          tab === "albums"
            ? { album: selectedItem.id }
            : { playlist: selectedItem.id }
        )

        if (typeof music.changeToMediaAtIndex === "function") {
          await music.changeToMediaAtIndex(index)
        }

        try {
          localStorage.setItem(
            APPLE_LAST_TRACK_KEY,
            JSON.stringify(tracks[index] || null)
          )
        } catch {}

        navigate("/sona")
      }
    } catch (err) {
      console.error("Error reproduciendo:", err)

      const msg = err?.message || err?.errorMessage || ""

      if (msg.includes("error 6")) {
        showAlert({
          title: t("errors.playbackRestricted"),
          description: t("errors.playbackRestrictedDesc"),
        })
      } else if (msg.includes("No Apple Music storeIds") || msg.includes("No playable")) {
        showAlert({
          title: t("errors.noTracks"),
          description: t("errors.noTracksDesc"),
        })
      } else if (msg.includes("Failed to prepare queue")) {
        showAlert({
          title: t("errors.queueFailed"),
          description: t("errors.queueFailedDesc"),
        })
      } else {
        showAlert({
          title: t("errors.playbackFailed"),
          description: t("errors.playbackFailedDesc"),
        })
      }
    }
  }

  const totalStackWidth = useMemo(() => {
    if (!filteredItems.length) return 0
    return ALBUM_W + (filteredItems.length - 1) * SPACING
  }, [filteredItems.length])

  const visibleStackItems = useMemo(() => {
    const result = []
    const start = visibleRange.start
    const end = Math.min(visibleRange.end, filteredItems.length - 1)

    for (let i = start; i <= end; i++) {
      result.push({ item: filteredItems[i], index: i })
    }
    return result
  }, [filteredItems, visibleRange])

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
          <div className="albumsStage" />
        </div>
      </div>
    )
  }

  return (
    <div className={`sonaBody ${bgClass} ${textClass}`} style={bgStyles}>
      <div className="overlayBackground"></div>

      <div className="container">
        <div className="albumsStage">
          <MenuAlbums tab={tab} onChangeTab={setTab} searchOpen={searchOpen} />

          <SearchMenu
            view={view}
            onToggleView={() =>
              setView((prev) => (prev === "grid" ? "list" : "grid"))
            }
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            hidden={mode === "tracks"}
            onSearchOpen={setSearchOpen}
          />

          {error && <p className="error">{error}</p>}

          {mode === "grid" && !loading && filteredItems.length === 0 && !error && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "60vh",
              textAlign: "center",
              padding: "0 30px",
              gap: "12px",
            }}>
              <img src="/discos.svg" alt="" style={{ width: 60, opacity: 0.5, marginBottom: 10 }} />
              <h2 style={{ fontSize: 16, fontWeight: 500, opacity: 0.8 }}>
                {t("menuAlbums.emptyTitle")}
              </h2>
              <p style={{ fontSize: 13, opacity: 0.5, lineHeight: 1.5, maxWidth: 280 }}>
                {t("menuAlbums.emptyDesc")}
              </p>
            </div>
          )}

          {mode === "grid" && filteredItems.length > 0 &&
            (view === "grid" ? (
              <div
                className="listCovers fadeIn"
                ref={gridScrollRef}
                onScroll={handleGridScroll}
              >
                {filteredItems.map((item, idx) => {
                  const cover = getItemCover(
                    item,
                    idx < GRID_PRIORITY_COUNT ? 220 : 160
                  )
                  const shouldFlip = idx < GRID_PRIORITY_COUNT

                  return (
                    <div
                      key={item.id}
                      className={`coverItem${shouldFlip ? "" : " noFlip"}`}
                      onClick={() => onOpenItem(item)}
                    >
                      <img
                        src={cover}
                        alt={item?.name || ""}
                        loading={idx < GRID_PRIORITY_COUNT ? "eager" : "lazy"}
                        decoding="async"
                        fetchPriority={idx < GRID_PRIORITY_COUNT ? "high" : "auto"}
                      />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div
                className="stack3D fadeIn"
                ref={scrollRef}
                onScroll={handle3DScroll}
              >
                {loading ? null : (
                  <div
                    className="stackVirtualContainer"
                    style={{
                      width: `${totalStackWidth}px`,
                      position: "relative",
                      height: "100%",
                    }}
                  >
                    {visibleStackItems.map(({ item, index }) => {
                      const cover = getItemCover(item, 180)
                      const leftPos = index * SPACING

                      return (
                        <div
                          key={item.id}
                          className="album3D"
                          style={{
                            ...getAlbumStyle(index),
                            position: "absolute",
                            left: `${leftPos}px`,
                            marginLeft: 0,
                          }}
                        >
                          <div className="albumBox">
                            <div
                              className="albumFront"
                              onClick={() => onOpenItem(item)}
                            >
                              <img
                                src={cover}
                                alt={item?.name || ""}
                                decoding="async"
                              />
                            </div>

                            <div
                              className="albumBack"
                              onClick={() => onOpenItem(item)}
                            >
                              <img
                                src={cover}
                                alt=""
                                decoding="async"
                              />
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
                            >
                              <span>{item?.name}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}

          {mode === "tracks" && (
            <div className="tracksView splitLayout fadeIn">
              <div className="albumColumn">
                <div className="albumCoverLarge">
                  <img
                    src={getItemCover(selectedItem, 600)}
                    alt={selectedItem?.name || ""}
                    decoding="async"
                  />
                </div>

                <h2 className="albumTitleLarge">{selectedItem?.name}</h2>

                <button className="tracksBackFloating" onClick={onBackToGrid}>
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
                          className={`trackRow clickable ${(() => {
                            const trackIds = [
                              String(track?.id || ""),
                              String(track?.raw?.id || ""),
                              String(track?.raw?.attributes?.playParams?.catalogId || ""),
                              String(track?.raw?.attributes?.playParams?.id || ""),
                            ].filter(Boolean)

                            return activeTrackId &&
                              trackIds.includes(activeTrackId) &&
                              isPlaying
                              ? "active"
                              : ""
                          })()}`}
                          key={track?.id || idx}
                          onClick={() => playTrack(idx)}
                        >
                          <div className="trackLeft">
                            <span className="trackIndex">
                              {(idx + 1).toString().padStart(2, "0")}.
                            </span>

                            {(() => {
                              const trackIds = [
                                String(track?.id || ""),
                                String(track?.raw?.id || ""),
                                String(track?.raw?.attributes?.playParams?.catalogId || ""),
                                String(track?.raw?.attributes?.playParams?.id || ""),
                              ].filter(Boolean)

                              const isActive =
                                activeTrackId &&
                                trackIds.includes(activeTrackId) &&
                                isPlaying

                              return isActive ? <AudioBars size={14} /> : null
                            })()}

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