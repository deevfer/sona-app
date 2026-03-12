import { useState, useRef, useEffect } from "react"
import "../styles/MenuComponent.css"

import ShareIcon from "../assets/share.svg?react"
import OptionsIcon from "../assets/options.svg?react"
import BackIcon from "../assets/back.svg?react"
import SonaLogo from "../assets/sonaAnimated.svg?react"
import LanguageSwitcher from "./LanguageSwitcher"
import { useTranslation } from "react-i18next"
import ShareCard from "./ShareCard"

import { exportStoryVideo } from "../utils/exportStoryVideo"

function MenuComponent({
  selectedVinyl,
  onSelectVinyl,
  selectedBg,
  onSelectBg,
  cover,
  shareTrack,
}) {
  const [open, setOpen] = useState(false)
  const [openModal, setOpenModal] = useState(false)
  const [modalView, setModalView] = useState("main")

  const [openSharePreview, setOpenSharePreview] = useState(false)

  // ✅ refs separados
  const sharePreviewRef = useRef(null)
  const shareExportRef = useRef(null)
  const shareExportContainerRef = useRef(null)

  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState("")

  const [provider, setProvider] = useState(null)
  const dropdownRef = useRef(null)
  const { t } = useTranslation()
  const [downloadProgress, setDownloadProgress] = useState(0)
  const vinyls = [
    "/vinyl-1.svg",
    "/vinyl-2.png",
    "/vinyl-3.png",
    "/vinyl-4.png",
    "/vinyl-5.png",
    "/vinyl-6.png",
  ]

  useEffect(() => {
    const fetchProvider = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) return
        const res = await fetch("/api/spotify/status", {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        })
        if (!res.ok) return
        const data = await res.json()
        setProvider(data.provider || null)
      } catch {}
    }
    fetchProvider()
  }, [])

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

  const providerLabel = provider
    ? provider.charAt(0).toUpperCase() + provider.slice(1)
    : "—"

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
  
      // 1️⃣ Grabar WebM
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
  
      // 2️⃣ Upload con progreso
      const xhr = new XMLHttpRequest()
  
      const response = await new Promise((resolve, reject) => {
  
        xhr.open("POST", "/api/story/upload-webm")
  
        xhr.setRequestHeader("Authorization", `Bearer ${token}`)
  
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
  
      // progreso completo
      setDownloadProgress(100)
  
      // 3️⃣ Descargar MP4
      window.location.href = `/api/story/${response.id}/download-mp4`
  
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

  return (
    <>
      <div className="menuContent" ref={dropdownRef}>
        <div className="menuTopOptions">
          <div className="share">
            <button type="button" onClick={handleOpenSharePreview} aria-label="Share">
              <ShareIcon />
            </button>
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

      {/* ========================= SHARE PREVIEW MODAL ========================= */}
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
                        <circle
                          className="progressBg"
                          cx="20"
                          cy="20"
                          r="18"
                        />

                        <circle
                          className="progressBar"
                          cx="20"
                          cy="20"
                          r="18"
                          style={{
                            strokeDashoffset: 113 - (113 * downloadProgress) / 100
                          }}
                        />
                      </svg>

                      <img src="/download.png" alt="download" className="shareIcon" />

                    </div>

                    <span>
                      {isExporting
                        ? (t("share.exporting") || "Exportando...")
                        : (t("share.downloadMp4") || "Download MP4")}
                    </span>
                  </button>

                </div>

              {exportError ? (
                <p className="error" style={{ marginTop: 10 }}>
                  {exportError}
                </p>
              ) : null}

              {/* ✅ Export oculto (tamaño real) */}
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

      {/* ========================= OPTIONS MODAL ========================= */}
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
                      onClick={() => window.open("https://sona.fernandovasquez.tech/faq", "_blank")}
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
                      onClick={() => window.open("https://www.paypal.com/paypalme/mindsguatemala", "_blank")}
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
                          if (navigator.share) await navigator.share(shareData)
                          else {
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
                    <div
                      className="item clickable"
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem("token")
                          if (token) {
                            await fetch("http://127.0.0.1:8000/api/logout", {
                              method: "POST",
                              headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
                            })
                          }
                          localStorage.clear()
                          window.location.href = "/login"
                        } catch {
                          localStorage.clear()
                          window.location.href = "/login"
                        }
                      }}
                    >
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
                  <div className={`providerItem ${provider === "spotify" ? "active" : ""}`}>
                    <img src="/spotify.png" alt="Spotify" />
                    <span>Spotify</span>
                    {provider === "spotify" && (
                      <span className="providerBadge">{t("options.connected")}</span>
                    )}
                  </div>

                  <div className="providerItem disabled">
                    <img src="/AppleMusic.png" alt="Apple Music" />
                    <span>Apple Music</span>
                    <span className="providerBadge comingSoon">{t("connect.comingSoon")}</span>
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