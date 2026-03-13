import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import "../styles/MenuComponent.css"

import ShareIcon from "../assets/share.svg?react"
import OptionsIcon from "../assets/options.svg?react"
import BackIcon from "../assets/back.svg?react"
import SonaLogo from "../assets/sonaAnimated.svg?react"
import LanguageSwitcher from "./LanguageSwitcher"
import { useTranslation } from "react-i18next"
import ShareCard from "./ShareCard"

import { exportStoryVideo } from "../utils/exportStoryVideo"
import { useProvider } from "../hooks/useProvider"

const API_BASE = import.meta.env.VITE_API_BASE
const APPLE_DEV_NAME = "Sona"

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

  const dropdownRef = useRef(null)

  const vinyls = [
    "/vinyl-1.svg",
    "/vinyl-2.png",
    "/vinyl-3.png",
    "/vinyl-4.png",
    "/vinyl-5.png",
    "/vinyl-6.png",
  ]

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
      }
    }

    document.addEventListener("mousedown", onClickOutside)
    document.addEventListener("keydown", onEsc)

    return () => {
      document.removeEventListener("mousedown", onClickOutside)
      document.removeEventListener("keydown", onEsc)
    }
  }, [])

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

  const switchToSpotify = async () => {
    const status = await apiFetch("/api/spotify/status")

    if (status?.connected) {
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

    window.location.href = data.url
  }

  const switchToAppleMusic = async () => {
    const status = await apiFetch("/api/apple-music/status")

    if (status?.connected) {
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
    } catch {
      // ya configurado
    }

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

    await reloadWithConnectedProvider("apple_music")
  }

  const handleProviderSelect = async (targetProvider) => {
    if (!targetProvider) return
    if (provider === targetProvider) return

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
      } catch {
        // si también falla, mostramos alerta
      }

      alert(
        e?.message ||
          t("connect.error") ||
          "No se pudo cambiar el proveedor de música."
      )
    } finally {
      setSwitchingProvider("")
    }
  }

  const toggleDropdown = () => setOpen((v) => !v)

  const handleSelectVinyl = (vinyl) => {
    onSelectVinyl(vinyl)
    setOpen(false)
  }

  const handleSelectBg = (bg) => {
    onSelectBg(bg)
    setOpen(false)
  }

  const handleCloseModal = () => {
    setOpenModal(false)
    setModalView("main")
  }

  const providerLabel = (() => {
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
  
      // detener Apple Music
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
  
      // reload completo (funciona en PWA)
      window.location.replace("/login")
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
                {vinyls.map((vinyl) => (
                  <button
                    key={vinyl}
                    type="button"
                    onClick={() => handleSelectVinyl(vinyl)}
                    className={selectedVinyl === vinyl ? "active" : ""}
                  >
                    <img src={vinyl} alt="" />
                  </button>
                ))}
              </div>
            </div>

            <div className="backgrounds">
              <div className="vinilosText">
                <p>{t("stylesMenu.background")}</p>
              </div>
              <div className="backgroundsButtons">
                <button
                  type="button"
                  className={`white ${selectedBg === "white" ? "active" : ""}`}
                  onClick={() => handleSelectBg("white")}
                  aria-label="White background"
                />
                <button
                  type="button"
                  className={`gray ${selectedBg === "gray" ? "active" : ""}`}
                  onClick={() => handleSelectBg("gray")}
                  aria-label="Gray background"
                />
                <button
                  type="button"
                  className={`yellow ${selectedBg === "yellow" ? "active" : ""}`}
                  onClick={() => handleSelectBg("yellow")}
                  aria-label="Yellow background"
                />
                <button
                  type="button"
                  className={`black ${selectedBg === "black" ? "active" : ""}`}
                  onClick={() => handleSelectBg("black")}
                  aria-label="Black background"
                />
                <button
                  type="button"
                  className={`cover ${selectedBg === "cover" ? "active" : ""}`}
                  onClick={() => handleSelectBg("cover")}
                  aria-label="Cover background"
                >
                  <div className="overlay" />
                  <img src={cover || "/AppleMusic.png"} alt="" />
                </button>
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
              <button className="backModal" onClick={() => setModalView("main")}>
                <BackIcon />
              </button>
            )}

            {modalView === "main" && (
              <div className="modalViewMain">
                <h2>{t("options.title")}</h2>

                <div className="optionsItem">
                  <div className="title">
                    <p>{t("options.general")}</p>
                  </div>
                  <div className="optionsItemContent">
                    <div className="item clickable" onClick={() => setModalView("provider")}>
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
                      onClick={() =>
                        window.open(
                          "https://www.paypal.com/paypalme/mindsguatemala",
                          "_blank"
                        )
                      }
                    >
                      <span>{t("options.donation")}</span>
                    </div>

                    <div
                      className="item clickable"
                      onClick={async () => {
                        const shareData = {
                          title: "Sona",
                          text: t("options.shareText"),
                          url: "https://sona.fernandovasquez.tech",
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

                <div className="optionsItem">
                  <div className="title">
                    <p>{t("options.account")}</p>
                  </div>
                  <div className="optionsItemContent">
                    <div className="item clickable" onClick={handleLogout}>
                      <span>{t("options.session")}</span>
                    </div>
                  </div>
                </div>

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
                    className={`providerItem ${provider === "apple_music" ? "active" : ""} ${
                      switchingProvider === "apple_music" ? "loading" : ""
                    }`}
                    onClick={() => handleProviderSelect("apple_music")}
                  >
                    <img src="/AppleMusic.png" alt="Apple Music" />
                    <span>Apple Music</span>
                    {provider === "apple_music" && (
                      <span className="providerBadge">{t("options.connected")}</span>
                    )}
                    {switchingProvider === "apple_music" && (
                      <span className="providerBadge">...</span>
                    )}
                  </div>

                  <div
                    className={`providerItem ${provider === "spotify" ? "active" : ""} ${
                      switchingProvider === "spotify" ? "loading" : ""
                    } disabled`}
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

                    {provider === "spotify" && (
                      <span className="providerBadge">{t("options.connected")}</span>
                    )}
                    {switchingProvider === "spotify" && (
                      <span className="providerBadge">...</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default MenuComponent