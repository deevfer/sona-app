import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import "../styles/Landing.css"
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "../components/LanguageSwitcher"
import SonaLogo from "../assets/sonaAnimated.svg?react"

const API_BASE = import.meta.env.VITE_API_BASE

function Landing() {
  const [openModal, setOpenModal] = useState(false)
  const [checking, setChecking] = useState(true)
  const [loadingArtworks, setLoadingArtworks] = useState(true)
  const [artworks, setArtworks] = useState([])
  const [landingBg, setLandingBg] = useState("")
  const [isPortrait, setIsPortrait] = useState(
    typeof window !== "undefined"
      ? window.matchMedia("(orientation: portrait)").matches
      : false
  )

  const navigate = useNavigate()
  const { t } = useTranslation()

  useEffect(() => {
    const media = window.matchMedia("(orientation: portrait)")

    const handleChange = () => {
      setIsPortrait(media.matches)
    }

    handleChange()
    media.addEventListener("change", handleChange)

    return () => {
      media.removeEventListener("change", handleChange)
    }
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) {
          setChecking(false)
          return
        }

        const headers = {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        }

        const [appleRes, spotifyRes] = await Promise.allSettled([
          fetch(`${API_BASE}/api/apple-music/status`, { headers }),
          fetch(`${API_BASE}/api/spotify/status`, { headers }),
        ])

        if (appleRes.status === "fulfilled" && appleRes.value.ok) {
          const appleData = await appleRes.value.json()
          if (appleData.connected) {
            navigate("/sona", { replace: true })
            return
          }
        }

        if (spotifyRes.status === "fulfilled" && spotifyRes.value.ok) {
          const spotifyData = await spotifyRes.value.json()
          if (spotifyData.connected) {
            navigate("/sona", { replace: true })
            return
          }
        }

        navigate("/home", { replace: true })
      } catch {
        setChecking(false)
      } finally {
        setChecking(false)
      }
    }

    checkAuth()
  }, [navigate])

  useEffect(() => {
    const fetchLandingArtworks = async () => {
      try {
        setLoadingArtworks(true)

        const res = await fetch(
          `${API_BASE}/api/apple-music/landing-artworks?storefront=us&limit=18`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        )

        if (!res.ok) throw new Error("No se pudieron cargar artworks")

        const data = await res.json()
        const items = Array.isArray(data?.items) ? data.items : []

        setArtworks(items)

        if (items.length > 0) {
          const randomItem = items[Math.floor(Math.random() * items.length)]
          setLandingBg(randomItem?.image || "")
        } else {
          setLandingBg("")
        }
      } catch (err) {
        console.error(err)
        setArtworks([])
        setLandingBg("")
      } finally {
        setLoadingArtworks(false)
      }
    }

    fetchLandingArtworks()
  }, [])

  const columns = useMemo(() => {
    if (!artworks.length) return [[], [], []]

    const col1 = []
    const col2 = []
    const col3 = []

    artworks.forEach((item, index) => {
      if (index % 3 === 0) col1.push(item)
      else if (index % 3 === 1) col2.push(item)
      else col3.push(item)
    })

    return [
      [...col1, ...col1],
      [...col2, ...col2],
      [...col3, ...col3],
    ]
  }, [artworks])

  const portraitRows = useMemo(() => {
    if (!artworks.length) return [[], []]

    const row1 = []
    const row2 = []

    artworks.forEach((item, index) => {
      if (index % 2 === 0) row1.push(item)
      else row2.push(item)
    })

    return [
      [...row1, ...row1],
      [...row2, ...row2],
    ]
  }, [artworks])

  const skeletonColumns = useMemo(() => {
    const placeholders = Array.from({ length: 18 }, (_, i) => ({
      id: `skeleton-${i}`,
    }))

    const col1 = []
    const col2 = []
    const col3 = []

    placeholders.forEach((item, index) => {
      if (index % 3 === 0) col1.push(item)
      else if (index % 3 === 1) col2.push(item)
      else col3.push(item)
    })

    return [
      [...col1, ...col1],
      [...col2, ...col2],
      [...col3, ...col3],
    ]
  }, [])

  const portraitSkeletonRows = useMemo(() => {
    const placeholders = Array.from({ length: 18 }, (_, i) => ({
      id: `skeleton-${i}`,
    }))

    const row1 = []
    const row2 = []

    placeholders.forEach((item, index) => {
      if (index % 2 === 0) row1.push(item)
      else row2.push(item)
    })

    return [
      [...row1, ...row1],
      [...row2, ...row2],
    ]
  }, [])

  if (checking) return null

  const landingStyle = landingBg
    ? {
        backgroundImage: `url(${landingBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : {}

  return (
    <div className="landing" style={landingStyle}>
      <div className="overlayBackgroundLanding"></div>

      <div className="container-lang">
        <LanguageSwitcher />
      </div>

      <div className={`contentLanding ${isPortrait ? "portraitLayout" : ""}`}>
        <div className="contentLeft">
          <div className="titleContentLeft">
            <h1>{t("landing.title")}</h1>
          </div>

          <div className="btnsContentLeft">
            <div className="btnPrimary">
              <button onClick={() => navigate("/login")}>
                {t("landing.start")}
              </button>
            </div>

            <div className="btnSecondary">
              <button id="requisitos" onClick={() => setOpenModal(true)}>
                {t("landing.requirements")}
              </button>
            </div>
          </div>
        </div>

        <div className="contentRight">
          {!isPortrait ? (
            <div className="chartsGrid">
              {loadingArtworks || !artworks.length ? (
                <>
                  <div className="chartsColumn scrollUp">
                    {skeletonColumns[0].map((item, index) => (
                      <div
                        className="albumArtwork skeleton shimmer"
                        key={`skeleton-col1-${item.id}-${index}`}
                      >
                        <div className="skeletonBox" />
                      </div>
                    ))}
                  </div>

                  <div className="chartsColumn scrollDown">
                    {skeletonColumns[1].map((item, index) => (
                      <div
                        className="albumArtwork skeleton shimmer"
                        key={`skeleton-col2-${item.id}-${index}`}
                      >
                        <div className="skeletonBox" />
                      </div>
                    ))}
                  </div>

                  <div className="chartsColumn scrollUpSlow">
                    {skeletonColumns[2].map((item, index) => (
                      <div
                        className="albumArtwork skeleton shimmer"
                        key={`skeleton-col3-${item.id}-${index}`}
                      >
                        <div className="skeletonBox" />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="chartsColumn scrollUp">
                    {columns[0].map((item, index) => (
                      <div className="albumArtwork" key={`col1-${item.id}-${index}`}>
                        <img src={item.image} alt={item.title || ""} loading="lazy" />
                      </div>
                    ))}
                  </div>

                  <div className="chartsColumn scrollDown">
                    {columns[1].map((item, index) => (
                      <div className="albumArtwork" key={`col2-${item.id}-${index}`}>
                        <img src={item.image} alt={item.title || ""} loading="lazy" />
                      </div>
                    ))}
                  </div>

                  <div className="chartsColumn scrollUpSlow">
                    {columns[2].map((item, index) => (
                      <div className="albumArtwork" key={`col3-${item.id}-${index}`}>
                        <img src={item.image} alt={item.title || ""} loading="lazy" />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="chartsRowsMobile">
              {loadingArtworks || !artworks.length ? (
                <>
                  <div className="chartsRow scrollLeftRow">
                    {portraitSkeletonRows[0].map((item, index) => (
                      <div
                        className="albumArtwork mobileArtwork skeleton shimmer"
                        key={`skeleton-row1-${item.id}-${index}`}
                      >
                        <div className="skeletonBox" />
                      </div>
                    ))}
                  </div>

                  <div className="chartsRow scrollRightRow">
                    {portraitSkeletonRows[1].map((item, index) => (
                      <div
                        className="albumArtwork mobileArtwork skeleton shimmer"
                        key={`skeleton-row2-${item.id}-${index}`}
                      >
                        <div className="skeletonBox" />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="chartsRow scrollLeftRow">
                    {portraitRows[0].map((item, index) => (
                      <div
                        className="albumArtwork mobileArtwork"
                        key={`row1-${item.id}-${index}`}
                      >
                        <img src={item.image} alt={item.title || ""} loading="lazy" />
                      </div>
                    ))}
                  </div>

                  <div className="chartsRow scrollRightRow">
                    {portraitRows[1].map((item, index) => (
                      <div
                        className="albumArtwork mobileArtwork"
                        key={`row2-${item.id}-${index}`}
                      >
                        <img src={item.image} alt={item.title || ""} loading="lazy" />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {openModal && (
        <div className="modalOverlay" onClick={() => setOpenModal(false)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <button className="closeModal" onClick={() => setOpenModal(false)}>
              +
            </button>

            <h2>{t("landing.modalTitle")}</h2>

            <div className="requirementsContent">
              <p>{t("landing.intro")}</p>

              <ul className="requirementsList">
                <div className="lifetimeAccess">
                  <p>{t("landing.lifetime")}</p>
                  <div className="iconRequirement">
                    <img src="/tocadiscos.png" alt="" />
                  </div>
                </div>

                <div className="spotifyConection">
                  <p>{t("landing.premium")}</p>
                  <div className="iconRequirement">
                    <img src="/premium.png" alt="" />
                  </div>
                </div>

                <div className="permission">
                  <p>{t("landing.permission")}</p>
                  <div className="iconRequirement">
                    <img src="/spotify.png" alt="" />
                  </div>
                </div>

                <div className="appleMusic">
                  <p>{t("landing.appleMusic")}</p>
                  <div className="iconRequirement">
                    <img src="/AppleMusic.png" alt="" />
                  </div>
                </div>
              </ul>

              <p className="noteRequirement">{t("landing.note")}</p>
            </div>

            <div className="rights">
              <SonaLogo />
              <p>{t("landing.developed")}</p>
              <span>{t("landing.version")}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Landing