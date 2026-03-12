import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import '../styles/Home.css'
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "../components/LanguageSwitcher"

const API_BASE = import.meta.env.VITE_API_BASE

function Home() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) {
          setChecking(false)
          return
        }

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
        }
      } catch (err) {
        console.error(err)
      } finally {
        setChecking(false)
      }
    }

    checkConnection()
  }, [navigate])

  const handleSpotifyConnect = async () => {
    setLoading(true)
    setError("")

    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API_BASE}/api/spotify/redirect?token=${token}`, {
        method: "GET"
      })

      if (!res.ok) throw new Error("Error al conectar con Spotify")

      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error("No se recibió URL de Spotify")
      }
    } catch (err) {
      console.error(err)
      setError(t("connect.error"))
      setLoading(false)
    }
  }

  if (checking) return null

  return (
    <div className="landing">
      <div className="container-lang">
        <LanguageSwitcher />
      </div>

      <div className="container">
        <div className="loginForm">
          <h1>{t("connect.title")}</h1>
          <span>{t("connect.subtitle")}</span>

          {error && <p className="error">{error}</p>}

          <div className="btnsConect">
            <div className="btnPrimary">
              <button onClick={handleSpotifyConnect} disabled={loading}>
                <img src="/spotify.png" alt="" />
                {loading ? t("connect.loading") : "Spotify"}
              </button>
            </div>
            <div className="btnPrimary">
              <button disabled>
                <img src="/AppleMusic.png" alt="" />
                Apple Music
              </button>
              <div className="comingSoon">
                <span>{t("connect.comingSoon")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="vinylBottom">
        <div className="leftVinyl">
          <img src="/leftVinyl.svg" alt="" />
        </div>
        <div className="centerVinyl">
          <img src="/centerVinyl.svg" alt="" />
        </div>
        <div className="rightVinyl">
          <img src="/rightVinyl.svg" alt="" />
        </div>
      </div>
    </div>
  )
}

export default Home