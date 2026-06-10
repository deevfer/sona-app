import { useState, useRef, useEffect } from "react"
import { flushSync } from "react-dom"
import { useNavigate } from "react-router-dom"
import "../styles/MenuComponent.css"

import ShareIcon from "../assets/share.svg?react"
import OptionsIcon from "../assets/options.svg?react"
import BackIcon from "../assets/back.svg?react"
import SonaLogo from "../assets/sonaAnimated.svg?react"
import LanguageSwitcher from "./LanguageSwitcher"
import FreeTrialUpgradeOverlay from "./FreeTrialUpgradeOverlay"
import { useTranslation } from "react-i18next"
import ShareCard from "./ShareCard"
import { Capacitor } from "@capacitor/core"
import { sileo } from "sileo"

import { exportStoryVideo } from "../utils/exportStoryVideo"
import { useProvider } from "../hooks/useProvider"
import {
  getCustomBackgroundColor,
  isCustomBackground,
  toCustomBackground,
} from "../utils/background"

const API_BASE = import.meta.env.VITE_API_BASE
const APPLE_DEV_NAME = "Sona"
const BG_KEY = "sona:selectedBg"
const VINYLS = [
  "/vinyl-1-1.png",
  "/vinyl-2-1.png",
  "/vinyl-2-2.png",
  "/vinyl-3-1.png",
  "/vinyl-3.png",
  "/vinyl-6.png",
]
const FREE_TRIAL_VINYLS = VINYLS.slice(0, 2)
const BACKGROUNDS = ["white", "gray", "yellow", "black", "cover"]
const FREE_TRIAL_BACKGROUNDS = BACKGROUNDS.slice(0, 3)

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const componentToHex = (value) =>
  clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0")

const hsvToHex = (h, s, v = 1) => {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c

  let r = 0
  let g = 0
  let b = 0

  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  return `#${componentToHex((r + m) * 255)}${componentToHex(
    (g + m) * 255
  )}${componentToHex((b + m) * 255)}`
}

const hexToHsv = (hex) => {
  const safeHex = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#fca519"
  const r = parseInt(safeHex.slice(1, 3), 16) / 255
  const g = parseInt(safeHex.slice(3, 5), 16) / 255
  const b = parseInt(safeHex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0

  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4

    h *= 60
    if (h < 0) h += 360
  }

  return {
    h,
    s: max === 0 ? 0 : delta / max,
  }
}

const applyCustomColorToVisibleBackground = (color) => {
  document.querySelectorAll(".sonaBody").forEach((body) => {
    body.style.setProperty("--sona-custom-bg", color)

    body.querySelectorAll(".overlayBackground").forEach((overlay) => {
      overlay.style.background = `linear-gradient(135deg, rgb(255 255 255 / 27%), rgb(0 0 0 / 24%)), ${color}`
      overlay.style.transform = "translateZ(0)"
    })
  })
}

const clearCustomColorFromVisibleBackground = () => {
  document.querySelectorAll(".sonaBody").forEach((body) => {
    body.classList.remove("bg-custom")
    body.style.removeProperty("--sona-custom-bg")
    body.style.backgroundColor = ""
    body.style.backgroundImage = ""

    body.querySelectorAll(".overlayBackground").forEach((overlay) => {
      overlay.style.background = ""
      overlay.style.transform = ""
    })
  })
}

function MenuComponent({
  selectedVinyl,
  onSelectVinyl,
  selectedBg,
  onSelectBg,
  cover,
  shareTrack,
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { provider } = useProvider()
  const isDemoMode = localStorage.getItem("appleMusicDemo") === "true"
  const isFreeTrial = localStorage.getItem("sonaAccessMode") === "free"

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

  const [open, setOpen] = useState(false)
  const [openModal, setOpenModal] = useState(false)
  const [modalView, setModalView] = useState("main")
  const [openSharePreview, setOpenSharePreview] = useState(false)

  const sharePreviewRef = useRef(null)
  const shareExportRef = useRef(null)
  const shareExportContainerRef = useRef(null)

  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState("")
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [switchingProvider, setSwitchingProvider] = useState("")
  const [deleteEmail, setDeleteEmail] = useState("")
  const [loggedEmail, setLoggedEmail] = useState("")
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [showFreeTrialUpgrade, setShowFreeTrialUpgrade] = useState(false)
  const [customColorPickerOpen, setCustomColorPickerOpen] = useState(false)

  const isNativeIOS =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios"

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

  const dropdownRef = useRef(null)
  const customColorWheelRef = useRef(null)
  const draggingCustomColorRef = useRef(false)

  const isFreeTrialLockedVinyl = (vinyl) =>
    isFreeTrial && !FREE_TRIAL_VINYLS.includes(vinyl)
  const isFreeTrialLockedBg = (bg) =>
    isFreeTrial && !FREE_TRIAL_BACKGROUNDS.includes(bg)
  const customBgColor = getCustomBackgroundColor(selectedBg)
  const hasCustomBg = isCustomBackground(selectedBg)
  const customColorHsv = hexToHsv(customBgColor)
  const customColorThumbAngle = ((customColorHsv.h - 90) * Math.PI) / 180
  const customColorThumbStyle = {
    "--selected-color": customBgColor,
    left: `${50 + Math.cos(customColorThumbAngle) * customColorHsv.s * 50}%`,
    top: `${50 + Math.sin(customColorThumbAngle) * customColorHsv.s * 50}%`,
  }

  useEffect(() => {
    if (!isFreeTrial || FREE_TRIAL_VINYLS.includes(selectedVinyl)) return
    onSelectVinyl(FREE_TRIAL_VINYLS[0])
  }, [isFreeTrial, selectedVinyl, onSelectVinyl])

  useEffect(() => {
    if (!isFreeTrial || FREE_TRIAL_BACKGROUNDS.includes(selectedBg)) return
    onSelectBg(FREE_TRIAL_BACKGROUNDS[0])
  }, [isFreeTrial, selectedBg, onSelectBg])

  useEffect(() => {
    const onClickOutside = (e) => {
      if (!dropdownRef.current) return
      if (!dropdownRef.current.contains(e.target)) setOpen(false)
    }

    const onEsc = (e) => {
      if (e.key === "Escape") {
        setOpen(false)
        setOpenModal(false)
        setModalView("main")
        setOpenSharePreview(false)
        setDeleteEmail("")
        setDeleteError("")
        setCustomColorPickerOpen(false)
      }
    }

    document.addEventListener("mousedown", onClickOutside)
    document.addEventListener("keydown", onEsc)

    return () => {
      document.removeEventListener("mousedown", onClickOutside)
      document.removeEventListener("keydown", onEsc)
    }
  }, [])

  useEffect(() => {
    if (!open) setCustomColorPickerOpen(false)
  }, [open])

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

    if (!res.ok) {
      throw data
    }

    return data
  }

  useEffect(() => {
    const loadLoggedUser = async () => {
      try {
        const user = await apiFetch("/api/me")
        setLoggedEmail(user?.email || "")
      } catch (e) {
        console.error("Error loading logged user:", e)
        setLoggedEmail("")
      }
    }

    loadLoggedUser()
  }, [])

  const waitForMusicKit = () =>
    new Promise((resolve, reject) => {
      if (window.MusicKit && typeof window.MusicKit.configure === "function") {
        resolve(window.MusicKit)
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error("MusicKit JS no terminó de cargar"))
      }, 8000)

      const onLoaded = () => {
        clearTimeout(timeout)

        if (window.MusicKit && typeof window.MusicKit.configure === "function") {
          resolve(window.MusicKit)
        } else {
          reject(new Error("MusicKit no está disponible"))
        }
      }

      window.addEventListener("musickitloaded", onLoaded, { once: true })
    })

  const getConnectionStatuses = async () => {
    const [spotifyResult, appleResult] = await Promise.allSettled([
      apiFetch("/api/spotify/status"),
      apiFetch("/api/apple-music/status"),
    ])

    return {
      spotify:
        spotifyResult.status === "fulfilled" && !!spotifyResult.value?.connected,
      apple_music:
        appleResult.status === "fulfilled" && !!appleResult.value?.connected,
    }
  }

  const reloadWithConnectedProvider = async (preferredProvider = "") => {
    const statuses = await getConnectionStatuses()

    let nextProvider = ""

    if (preferredProvider === "spotify" && statuses.spotify) {
      nextProvider = "spotify"
    } else if (preferredProvider === "apple_music" && statuses.apple_music) {
      nextProvider = "apple_music"
    } else if (provider === "spotify" && statuses.spotify) {
      nextProvider = "spotify"
    } else if (provider === "apple_music" && statuses.apple_music) {
      nextProvider = "apple_music"
    } else if (statuses.apple_music) {
      nextProvider = "apple_music"
    } else if (statuses.spotify) {
      nextProvider = "spotify"
    }

    if (nextProvider) {
      localStorage.setItem("musicProvider", nextProvider)
    } else {
      localStorage.removeItem("musicProvider")
    }

    if (!statuses.apple_music) {
      localStorage.removeItem("appleMusicConnected")
      localStorage.removeItem("appleMusicUserToken")
    }

    window.location.reload()
  }

  const clearDemoState = () => {
    localStorage.removeItem("appleMusicDemo")
    localStorage.removeItem("sona:demoPlaybackState")
    localStorage.removeItem("sona:currentContext")
    localStorage.removeItem("sona:appleLastTrack")
    localStorage.removeItem("sona:appleQueueInitialized")
  }

  const switchToSpotify = async () => {
    const status = await apiFetch("/api/spotify/status")

    if (status?.connected) {
      clearDemoState()
      await reloadWithConnectedProvider("spotify")
      return
    }

    const token = localStorage.getItem("token")
    const res = await fetch(`${API_BASE}/api/spotify/redirect?token=${token}`, {
      method: "GET",
    })

    if (!res.ok) {
      throw new Error("Error al conectar con Spotify")
    }

    const data = await res.json()

    if (!data?.url) {
      throw new Error("No se recibió URL de Spotify")
    }

    clearDemoState()
    window.location.href = data.url
  }

  const switchToAppleMusic = async () => {
    const status = await apiFetch("/api/apple-music/status")

    if (status?.connected) {
      localStorage.removeItem("appleMusicDemo")
      localStorage.removeItem("sona:demoPlaybackState")
      localStorage.removeItem("sona:appleQueueInitialized")
      localStorage.removeItem("sona:currentContext")
      localStorage.removeItem("sona:appleLastTrack")

      if (window.__sonaDemoAudio) {
        try {
          window.__sonaDemoAudio.pause()
          window.__sonaDemoAudio.src = ""
          window.__sonaDemoAudio.load?.()
        } catch {}
        window.__sonaDemoAudio = null
      }

      await reloadWithConnectedProvider("apple_music")
      return
    }

    const isNativeIOS =
      Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios"

    if (isNativeIOS) {
      const { default: AppleMusicAuthPlugin } = await import("../plugins/appleMusicAuth")

      const tokenData = await apiFetch("/api/apple-music/token")
      const developerToken = tokenData?.token

      if (!developerToken) {
        throw new Error("No se recibió el developer token")
      }

      const nativeResult = await AppleMusicAuthPlugin.connect({
        developerToken,
      })

      const musicUserToken = nativeResult?.musicUserToken

      if (!musicUserToken) {
        throw new Error("No se recibió el Music User Token")
      }

      await apiFetch("/api/apple-music/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          music_user_token: musicUserToken,
          scopes: ["native_ios"],
        }),
      })

      localStorage.setItem("appleMusicConnected", "true")
      localStorage.setItem("appleMusicUserToken", musicUserToken)

      localStorage.removeItem("appleMusicDemo")
      localStorage.removeItem("sona:demoPlaybackState")
      localStorage.removeItem("sona:appleQueueInitialized")
      localStorage.removeItem("sona:currentContext")
      localStorage.removeItem("sona:appleLastTrack")

      if (window.__sonaDemoAudio) {
        try {
          window.__sonaDemoAudio.pause()
          window.__sonaDemoAudio.src = ""
          window.__sonaDemoAudio.load?.()
        } catch {}
        window.__sonaDemoAudio = null
      }

      await reloadWithConnectedProvider("apple_music")
      return
    }

    const MusicKit = await waitForMusicKit()

    const tokenData = await apiFetch("/api/apple-music/token")
    const developerToken = tokenData?.token

    if (!developerToken) {
      throw new Error("No se recibió el developer token")
    }

    try {
      MusicKit.configure({
        developerToken,
        app: {
          name: APPLE_DEV_NAME,
          build: "1.0.0",
        },
      })
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 350))

    let music = null

    try {
      music = MusicKit.getInstance()
    } catch {
      music = null
    }

    if (!music) {
      throw new Error("No se pudo inicializar la instancia de Apple Music")
    }

    const musicUserToken = await music.authorize()

    if (!musicUserToken) {
      throw new Error("No se recibió el Music User Token")
    }

    await apiFetch("/api/apple-music/connect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        music_user_token: musicUserToken,
        scopes: ["musickit_web"],
      }),
    })

    localStorage.setItem("appleMusicConnected", "true")
    localStorage.setItem("appleMusicUserToken", musicUserToken)

    localStorage.removeItem("appleMusicDemo")
    localStorage.removeItem("sona:demoPlaybackState")
    localStorage.removeItem("sona:appleQueueInitialized")
    localStorage.removeItem("sona:currentContext")
    localStorage.removeItem("sona:appleLastTrack")

    if (window.__sonaDemoAudio) {
      try {
        window.__sonaDemoAudio.pause()
        window.__sonaDemoAudio.src = ""
        window.__sonaDemoAudio.load?.()
      } catch {}
      window.__sonaDemoAudio = null
    }

    await reloadWithConnectedProvider("apple_music")
  }

  const handleProviderSelect = async (targetProvider) => {
    if (!targetProvider) return
    if (!isDemoMode && provider === targetProvider) return

    setExportError("")
    setSwitchingProvider(targetProvider)

    try {
      if (targetProvider === "spotify") {
        await switchToSpotify()
        return
      }

      if (targetProvider === "apple_music") {
        await switchToAppleMusic()
        return
      }
    } catch (e) {
      console.error(e)

      try {
        await reloadWithConnectedProvider(provider || "")
        return
      } catch {}

      showAlert({
        title: t("errors.providerSwitch"),
        description: t("errors.providerSwitchDesc"),
      })
    } finally {
      setSwitchingProvider("")
    }
  }

  const toggleDropdown = () => setOpen((v) => !v)

  const handleSelectVinyl = (vinyl) => {
    if (isFreeTrialLockedVinyl(vinyl)) {
      setOpen(false)
      setShowFreeTrialUpgrade(true)
      return
    }

    onSelectVinyl(vinyl)
    setOpen(false)
  }

  const handleSelectBg = (bg) => {
    if (isFreeTrialLockedBg(bg)) {
      setOpen(false)
      setShowFreeTrialUpgrade(true)
      return
    }

    clearCustomColorFromVisibleBackground()
    flushSync(() => onSelectBg(bg))
    localStorage.setItem(BG_KEY, bg)
    window.dispatchEvent(new Event("sona:bgChanged"))
    setOpen(false)
  }

  const handleCustomColorChange = (color) => {
    if (isFreeTrial) {
      setOpen(false)
      setShowFreeTrialUpgrade(true)
      return
    }

    const nextBg = toCustomBackground(color)
    applyCustomColorToVisibleBackground(color)
    flushSync(() => onSelectBg(nextBg))
    localStorage.setItem(BG_KEY, nextBg)
    window.dispatchEvent(new Event("sona:bgChanged"))
  }

  const selectCustomColorFromPointer = (event) => {
    const wheel = customColorWheelRef.current
    if (!wheel) return

    const rect = wheel.getBoundingClientRect()
    const radius = rect.width / 2
    const x = event.clientX - rect.left - radius
    const y = event.clientY - rect.top - radius
    const distance = Math.sqrt(x * x + y * y)
    const saturation = clamp(distance / radius, 0, 1)
    const angle = (Math.atan2(y, x) * 180) / Math.PI
    const normalizedHue = (angle + 90 + 360) % 360

    handleCustomColorChange(hsvToHex(normalizedHue, saturation))
  }

  const handleCustomColorPointerDown = (event) => {
    event.preventDefault()
    draggingCustomColorRef.current = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
    selectCustomColorFromPointer(event)
  }

  const handleCustomColorPointerMove = (event) => {
    if (!draggingCustomColorRef.current) return
    selectCustomColorFromPointer(event)
  }

  const handleCustomColorPointerUp = (event) => {
    draggingCustomColorRef.current = false
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const handleCloseModal = () => {
    setOpenModal(false)
    setModalView("main")
    setDeleteEmail("")
    setDeleteError("")
  }

  const providerLabel = (() => {
    if (isFreeTrial) return t("options.freeTrial")
    if (isDemoMode) return "Demo"
    if (provider === "spotify") return "Spotify"
    if (provider === "apple_music") return "Apple Music"
    return "—"
  })()

  const handleOpenSharePreview = () => {
    setExportError("")
    setOpenSharePreview(true)
    setOpen(false)
  }

  const downloadShareMP4 = async () => {
    setIsExporting(true)
    setExportError("")
    setDownloadProgress(0)

    try {
      const root = shareExportContainerRef.current
      const el = root?.querySelector?.(".shareCard")

      if (!el) {
        throw new Error("No se encontró el ShareCard para exportar.")
      }

      const webmBlob = await exportStoryVideo({
        element: el,
        seconds: 10,
        fps: 30,
      })

      const fd = new FormData()
      fd.append(
        "video",
        new File([webmBlob], "sona-story.webm", { type: "video/webm" })
      )

      const token = localStorage.getItem("token")
      const xhr = new XMLHttpRequest()

      const response = await new Promise((resolve, reject) => {
        xhr.open("POST", `${API_BASE}/api/story/upload-webm`)

        if (token) {
          xhr.setRequestHeader("Authorization", `Bearer ${token}`)
        }

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100)
            setDownloadProgress(percent)
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText))
          } else {
            reject(new Error("Upload failed"))
          }
        }

        xhr.onerror = () => reject(new Error("Network error"))

        xhr.send(fd)
      })

      if (!response?.id) {
        throw new Error("Upload failed")
      }

      setDownloadProgress(100)

      window.location.href = `${API_BASE}/api/story/${response.id}/download-mp4`
    } catch (e) {
      console.error(e)
      setExportError(e?.message || "No se pudo exportar el MP4.")
    } finally {
      setTimeout(() => {
        setIsExporting(false)
        setDownloadProgress(0)
      }, 800)
    }
  }

  const shareImageNative = async () => {
    try {
      const dataUrl = await shareExportRef.current?.exportImage?.()
      if (!dataUrl) return

      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const file = new File([blob], "sona-story.png", { type: "image/png" })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Sona",
          text: "Now spinning on Sona",
          files: [file],
        })
      } else {
        const link = document.createElement("a")
        link.download = "sona-story.png"
        link.href = dataUrl
        link.click()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token")

      if (window.MusicKit) {
        try {
          const music = window.MusicKit.getInstance?.()
          if (music) {
            await music.pause().catch(() => {})
            await music.stop().catch(() => {})
          }
        } catch {}
      }

      if (token) {
        await fetch(`${API_BASE}/api/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      localStorage.clear()
      window.location.replace("/login")
    }
  }

  const handleFreeTrialHome = () => {
    localStorage.removeItem("sonaAccessMode")
    localStorage.removeItem("appleMusicDemo")
    localStorage.removeItem("musicProvider")
    localStorage.removeItem("appleMusicConnected")
    localStorage.removeItem("appleMusicUserToken")
    localStorage.removeItem("sona:demoPlaybackState")
    localStorage.removeItem("sona:currentContext")
    localStorage.removeItem("sona:appleLastTrack")
    localStorage.removeItem("sona:appleQueueInitialized")
    sessionStorage.removeItem("sona:registerFromFreeTrial")
    navigate("/", { replace: true })
  }

  const handleFreeTrialUpgradeLater = () => {
    setShowFreeTrialUpgrade(false)
  }

  const handleFreeTrialUpgradeCta = () => {
    setShowFreeTrialUpgrade(false)
    sessionStorage.setItem("sona:registerFromFreeTrial", "true")
    navigate("/register", {
      state: { fromFreeTrial: true },
    })
  }

  const normalizedDeleteEmail = deleteEmail.trim().toLowerCase()
  const normalizedLoggedEmail = loggedEmail.trim().toLowerCase()

  const canDeleteAccount =
    !!normalizedDeleteEmail &&
    !!normalizedLoggedEmail &&
    normalizedDeleteEmail === normalizedLoggedEmail &&
    !deletingAccount

  const handleDeleteAccount = async () => {
    if (!canDeleteAccount) return

    setDeleteError("")
    setDeletingAccount(true)

    try {
      await apiFetch("/api/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: deleteEmail.trim(),
        }),
      })

      if (window.MusicKit) {
        try {
          const music = window.MusicKit.getInstance?.()
          if (music) {
            await music.pause().catch(() => {})
            await music.stop().catch(() => {})
          }
        } catch {}
      }

      if (window.__sonaDemoAudio) {
        try {
          window.__sonaDemoAudio.pause()
          window.__sonaDemoAudio.src = ""
          window.__sonaDemoAudio.load?.()
        } catch {}
        window.__sonaDemoAudio = null
      }

      localStorage.clear()
      window.location.replace("/login")
    } catch (e) {
      console.error("Error deleting account:", e)

      setDeleteError(
        e?.message ||
          e?.error ||
          e?.message?.email?.[0] ||
          t("options.deleteError") ||
          "No se pudo eliminar la cuenta."
      )
    } finally {
      setDeletingAccount(false)
    }
  }

  return (
    <>
      <div className="menuContent" ref={dropdownRef}>
        <div className="menuTopOptions">
          <div className="share">
            {/* <button type="button" onClick={handleOpenSharePreview} aria-label="Share">
              <ShareIcon />
            </button> */}
          </div>

          <div className="options">
            <button type="button" onClick={() => setOpenModal(true)} aria-label="Options">
              <OptionsIcon />
            </button>
          </div>
        </div>

        <div className="menuBottom">
          <button type="button" onClick={toggleDropdown} aria-expanded={open}>
            <img src={selectedVinyl} alt="" />
          </button>

          <div className={`menuDropdown ${open ? "open" : ""}`}>
            <div className="vinilos">
              <div className="vinilosText">
                <p>{t("stylesMenu.vinyl")}</p>
              </div>
              <div className="vinilosButtons">
                {VINYLS.map((vinyl) => {
                  const locked = isFreeTrialLockedVinyl(vinyl)

                  return (
                  <button
                    key={vinyl}
                    type="button"
                    onClick={() => handleSelectVinyl(vinyl)}
                    className={`${selectedVinyl === vinyl ? "active" : ""} ${
                      locked ? "lockedVinyl" : ""
                    }`}
                    aria-disabled={locked ? "true" : undefined}
                  >
                    <img src={vinyl} alt="" />
                    {locked && (
                      <span className="vinylLockOverlay">
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path
                            d="M7.8 10.4V8.2C7.8 5.4 9.9 3.5 12 3.5s4.2 1.9 4.2 4.7v2.2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                          />
                          <path
                            d="M7.4 10h9.2c1.4 0 2.4 1 2.4 2.4v4.7c0 1.5-1 2.5-2.4 2.5H7.4C6 19.6 5 18.6 5 17.1v-4.7C5 11 6 10 7.4 10Z"
                            fill="currentColor"
                          />
                          <path
                            d="M12 13.4v2.8"
                            fill="none"
                            stroke="#121212"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                    )}
                  </button>
                  )
                })}
              </div>
            </div>

            <div className="backgrounds">
              <div className="vinilosText">
                <p>{t("stylesMenu.background")}</p>
              </div>
              <div className="backgroundsButtons">
                {BACKGROUNDS.map((bg) => {
                  const locked = isFreeTrialLockedBg(bg)

                  return (
                    <button
                      key={bg}
                      type="button"
                      className={`${bg} ${selectedBg === bg ? "active" : ""} ${
                        locked ? "lockedBackground" : ""
                      }`}
                      onClick={() => handleSelectBg(bg)}
                      aria-label={`${bg} background`}
                      aria-disabled={locked ? "true" : undefined}
                    >
                      {bg === "cover" && (
                        <>
                          <div className="overlay" />
                          <img src={cover || "/AppleMusic.png"} alt="" />
                        </>
                      )}
                      {locked && (
                        <span className="vinylLockOverlay">
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            focusable="false"
                          >
                            <path
                              d="M7.8 10.4V8.2C7.8 5.4 9.9 3.5 12 3.5s4.2 1.9 4.2 4.7v2.2"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.9"
                              strokeLinecap="round"
                            />
                            <path
                              d="M7.4 10h9.2c1.4 0 2.4 1 2.4 2.4v4.7c0 1.5-1 2.5-2.4 2.5H7.4C6 19.6 5 18.6 5 17.1v-4.7C5 11 6 10 7.4 10Z"
                              fill="currentColor"
                            />
                            <path
                              d="M12 13.4v2.8"
                              fill="none"
                              stroke="#121212"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="customStyle">
              <div className="vinilosText">
                <p>{t("stylesMenu.pickStyle")}</p>
              </div>
              <div className="customStyleControl">
                {isFreeTrial ? (
                  <button
                    type="button"
                    className="customColorButton lockedBackground"
                    style={{ "--selected-color": customBgColor }}
                    onClick={() => {
                      setOpen(false)
                      setShowFreeTrialUpgrade(true)
                    }}
                    aria-disabled="true"
                  >
                    <span className="customColorWheel" />
                    <span className="vinylLockOverlay">
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path
                          d="M7.8 10.4V8.2C7.8 5.4 9.9 3.5 12 3.5s4.2 1.9 4.2 4.7v2.2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                        />
                        <path
                          d="M7.4 10h9.2c1.4 0 2.4 1 2.4 2.4v4.7c0 1.5-1 2.5-2.4 2.5H7.4C6 19.6 5 18.6 5 17.1v-4.7C5 11 6 10 7.4 10Z"
                          fill="currentColor"
                        />
                        <path
                          d="M12 13.4v2.8"
                          fill="none"
                          stroke="#121212"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  </button>
                ) : (
                  <>
                  <button
                    type="button"
                    className={`customColorButton ${hasCustomBg ? "active" : ""}`}
                    style={{ "--selected-color": customBgColor }}
                    onClick={() => setCustomColorPickerOpen((value) => !value)}
                    aria-expanded={customColorPickerOpen}
                    aria-label={t("stylesMenu.pickStyle")}
                  >
                    <span className="customColorWheel" />
                  </button>
                  {customColorPickerOpen && (
                    <div
                      className="customColorPickerPanel"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        ref={customColorWheelRef}
                        className="customColorPickerWheel"
                        role="slider"
                        tabIndex="0"
                        aria-label={t("stylesMenu.pickStyle")}
                        aria-valuetext={customBgColor}
                        onPointerDown={handleCustomColorPointerDown}
                        onPointerMove={handleCustomColorPointerMove}
                        onPointerUp={handleCustomColorPointerUp}
                        onPointerCancel={handleCustomColorPointerUp}
                      >
                        <span
                          className="customColorPickerThumb"
                          style={customColorThumbStyle}
                        />
                      </div>
                    </div>
                  )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {openSharePreview && (
        <div
          className="modalOverlay shareModal"
          onClick={() => !isExporting && setOpenSharePreview(false)}
        >
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <button
              className="closeModal"
              onClick={() => !isExporting && setOpenSharePreview(false)}
            >
              +
            </button>

            <div className="shareContentPrev">
              <div className="storyPrev">
                <div className="cardPreview">
                  <ShareCard
                    ref={sharePreviewRef}
                    track={shareTrack}
                    selectedBg={selectedBg}
                    bgCoverUrl={cover}
                    vinylSrc={selectedVinyl}
                    labelOffset={{ x: -8, y: 10 }}
                  />
                </div>
              </div>

              <div className="shareButtoms">
                <button
                  type="button"
                  className="primaryBtn shareBtn"
                  onClick={shareImageNative}
                  disabled={isExporting}
                >
                  <div className="imgButton">
                    <img src="/send.png" alt="share" className="shareIcon" />
                  </div>
                  <span>{t("share.png")}</span>
                </button>

                <button
                  type="button"
                  className="secondaryBtn shareBtn"
                  onClick={downloadShareMP4}
                  disabled={isExporting}
                >
                  <div className="imgButton video progressWrapper">
                    <svg className="progressRing" viewBox="0 0 40 40">
                      <circle className="progressBg" cx="20" cy="20" r="18" />
                      <circle
                        className="progressBar"
                        cx="20"
                        cy="20"
                        r="18"
                        style={{
                          strokeDashoffset: 113 - (113 * downloadProgress) / 100,
                        }}
                      />
                    </svg>

                    <img src="/download.png" alt="download" className="shareIcon" />
                  </div>

                  <span>
                    {isExporting
                      ? t("share.exporting") || "Exportando..."
                      : t("share.downloadMp4") || "Download MP4"}
                  </span>
                </button>
              </div>

              {exportError ? (
                <p className="error" style={{ marginTop: 10 }}>
                  {exportError}
                </p>
              ) : null}

              <div className="shareExportHidden" ref={shareExportContainerRef}>
                <ShareCard
                  ref={shareExportRef}
                  track={shareTrack}
                  selectedBg={selectedBg}
                  bgCoverUrl={cover}
                  vinylSrc={selectedVinyl}
                  labelOffset={{ x: -8, y: 10 }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {openModal && (
        <div className="modalOverlay" onClick={handleCloseModal}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            {modalView === "main" && (
              <button className="closeModal" onClick={handleCloseModal}>
                +
              </button>
            )}

            {modalView !== "main" && (
              <button
                className="backModal"
                onClick={() => {
                  setModalView("main")
                  setDeleteEmail("")
                  setDeleteError("")
                }}
              >
                <BackIcon />
              </button>
            )}

            {modalView === "main" && (
              <div className="modalViewMain">
                <h2>{t("options.title")}</h2>

                {isFreeTrial && (
                  <div className="freeTrialUpgradeCard">
                    <p>{t("options.unlockFullAccess")}</p>
                    <span>{t("options.unlockFullAccessText")}</span>
                    <button
                      type="button"
                      onClick={() => {
                        sessionStorage.setItem("sona:registerFromFreeTrial", "true")
                        handleCloseModal()
                        navigate("/register", {
                          state: { fromFreeTrial: true },
                        })
                      }}
                    >
                      {t("options.unlockFullAccessCta")}
                    </button>
                  </div>
                )}

                <div className="optionsItem">
                  <div className="title">
                    <p>{t("options.general")}</p>
                  </div>
                  <div className="optionsItemContent">
                    <div
                      className={`item ${isFreeTrial ? "disabled providerLocked" : "clickable"}`}
                      onClick={() => {
                        if (isFreeTrial) return
                        setModalView("provider")
                      }}
                      aria-disabled={isFreeTrial ? "true" : undefined}
                    >
                      <span>{t("options.provider")}</span>
                      <span className="itemValue">{providerLabel}</span>
                    </div>

                    <div className="item clickable langItem">
                      <span>{t("options.lang")}</span>
                      <LanguageSwitcher />
                    </div>

                    <div
                      className="item clickable"
                      onClick={() =>
                        window.open("https://sona.fernandovasquez.tech/faq", "_blank")
                      }
                    >
                      <span>{t("options.faq")}</span>
                    </div>
                  </div>
                </div>

                <div className="optionsItem">
                  <div className="title">
                    <p>{t("options.support")}</p>
                  </div>
                  <div className="optionsItemContent">
                    <div
                      className="item clickable"
                      onClick={async () => {
                        const shareData = {
                          title: "Sona",
                          text: `${t("options.shareText")} https://sona.fernandovasquez.tech`,
                        }

                        try {
                          if (navigator.share) {
                            await navigator.share(shareData)
                          } else {
                            await navigator.clipboard.writeText(shareData.url)
                            alert(t("options.linkCopied"))
                          }
                        } catch {}
                      }}
                    >
                      <span>{t("options.share")}</span>
                    </div>
                  </div>
                </div>

                {isFreeTrial ? (
                  <div className="optionsItem">
                    <div className="title">
                      <p>{t("options.freeTrial")}</p>
                    </div>
                    <div className="optionsItemContent">
                      <div
                        className="item clickable deleteAccount"
                        onClick={handleFreeTrialHome}
                      >
                        <span>{t("options.backHome")}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="optionsItem">
                    <div className="title">
                      <p>{t("options.account")}</p>
                    </div>
                    <div className="optionsItemContent">
                      <div className="item clickable" onClick={handleLogout}>
                        <span>{t("options.session")}</span>
                      </div>

                      <div
                        className="item clickable deleteAccount"
                        onClick={() => {
                          setDeleteEmail("")
                          setDeleteError("")
                          setModalView("deleteAccount")
                        }}
                      >
                        <span>{t("options.delete")}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rights">
                  <SonaLogo />
                  <p>{t("options.developed")}</p>
                  <span>{t("options.version")}</span>
                </div>
              </div>
            )}

            {modalView === "provider" && (
              <div className="modalViewSub">
                <h2>{t("options.provider")}</h2>
                <div className="providerList">
                  <div
                    className={`providerItem ${
                      !isDemoMode && provider === "apple_music" ? "active" : ""
                    } ${switchingProvider === "apple_music" ? "loading" : ""}`}
                    onClick={() => handleProviderSelect("apple_music")}
                  >
                    <img src="/AppleMusic.png" alt="Apple Music" />
                    <span>Apple Music</span>
                    {!isDemoMode && provider === "apple_music" && (
                      <span className="providerBadge">{t("options.connected")}</span>
                    )}
                    {switchingProvider === "apple_music" && (
                      <span className="providerBadge">...</span>
                    )}
                  </div>

                  <div
                    className={`providerItem ${
                      !isDemoMode && provider === "spotify" ? "active" : ""
                    } ${switchingProvider === "spotify" ? "loading" : ""} disabled`}
                    onClick={() => {
                      if (true) return
                      handleProviderSelect("spotify")
                    }}
                    aria-disabled="true"
                    title="Spotify próximamente"
                  >
                    <img src="/spotify.png" alt="Spotify" />
                    <span>Spotify</span>

                    <span className="providerBadge comingSoon">
                      {t("options.comingSoon")}
                    </span>

                    {!isDemoMode && provider === "spotify" && (
                      <span className="providerBadge">{t("options.connected")}</span>
                    )}
                    {switchingProvider === "spotify" && (
                      <span className="providerBadge">...</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {modalView === "deleteAccount" && (
              <div className="modalViewSub">
                <h2>{t("options.delete")}</h2>

                <div className="providerList">
                  <div className="providerItem deleteWarning" style={{ cursor: "default" }}>
                    <p>
                      <span>
                        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M10.62 4.34c.6-1.07 2.16-1.07 2.76 0l6.9 12.3c.59 1.05-.16 2.36-1.38 2.36H5.1c-1.22 0-1.97-1.31-1.38-2.36l6.9-12.3Z"
                            fill="#FF4A4A"
                          />
                          <rect x="11.15" y="8.1" width="1.7" height="6.1" rx="0.85" fill="white" />
                          <circle cx="12" cy="16.7" r="1.05" fill="white" />
                        </svg>
                      </span>
                      {t("options.deleteWarning")}
                    </p>
                  </div>

                  <div className="deleteText">
                    <p>{t("options.deleteWarningText")}</p>
                    <p>{t("options.deleteWarningTextConfirm")}</p>
                  </div>

                  <div className="inputDelete">
                    <input
                      type="email"
                      value={deleteEmail}
                      onChange={(e) => setDeleteEmail(e.target.value)}
                      placeholder={loggedEmail || t("options.deletePlaceholder") || "Enter your email"}
                      autoComplete="email"
                    />
                  </div>

                  <div className="secondWarning">
                    <p>
                      <span></span> {t("options.deleteSecondWarning")}
                    </p>
                  </div>

                  {deleteError ? (
                    <p className="error" style={{ marginTop: 10 }}>
                      {deleteError}
                    </p>
                  ) : null}

                  <div className="btnsDelete">
                    <button
                      className="deleteAccountBtn"
                      disabled={!canDeleteAccount}
                      onClick={handleDeleteAccount}
                    >
                      {deletingAccount
                        ? t("options.deleting") || "Deleting..."
                        : t("options.delete")}
                    </button>

                    <button
                      className="deleteAccountCancel"
                      onClick={() => {
                        setDeleteEmail("")
                        setDeleteError("")
                        setModalView("main")
                      }}
                      disabled={deletingAccount}
                    >
                      {t("options.deleteCancel")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <FreeTrialUpgradeOverlay
        visible={showFreeTrialUpgrade}
        title={t("sona.freeTrialUpgradeMessage")}
        cta={t("sona.freeTrialUpgradeCta")}
        later={t("sona.freeTrialUpgradeLater")}
        onCta={handleFreeTrialUpgradeCta}
        onLater={handleFreeTrialUpgradeLater}
      />
    </>
  )
}

export default MenuComponent
