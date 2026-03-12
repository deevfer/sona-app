import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import '../styles/Landing.css'
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "../components/LanguageSwitcher"
import SonaLogo from "../assets/sonaAnimated.svg?react"

const API_BASE = import.meta.env.VITE_API_BASE

function Landing() {
  const [openModal, setOpenModal] = useState(false)
  const [checking, setChecking] = useState(true)
  const navigate = useNavigate()
  const { t } = useTranslation()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) {
          setChecking(false)
          return
        }

        // Verificar si tiene conexión con proveedor de música
        const res = await fetch(`${API_BASE}/api/spotify/status`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        })

        if (res.ok) {
          const data = await res.json()
          if (data.connected) {
            navigate("/sona", { replace: true })
            return
          }
          // Tiene token pero no spotify → ir a home
          navigate("/home", { replace: true })
          return
        }
      } catch {}
      setChecking(false)
    }

    checkAuth()
  }, [navigate])

  if (checking) return null

  return (
    <div className="landing">
        <div className="container-lang">
            <LanguageSwitcher />
        </div>
        <div className="contentLanding">
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
                <div className="vinylLanding">
                    <img src="/vinylLanding.svg" alt="" />
                </div>
            </div>
        </div>
        {openModal && (
          <div className="modalOverlay" onClick={() => setOpenModal(false)}>
              <div className="modalContent" onClick={(e) => e.stopPropagation()}>
                <button className="closeModal" onClick={() => setOpenModal(false)}>+</button>
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

                    <p className="noteRequirement">
                        {t("landing.note")}
                    </p>
                </div>

                <div className="rights">
                    <SonaLogo/>
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