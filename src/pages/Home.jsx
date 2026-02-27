import { useState } from "react"
import { useNavigate } from "react-router-dom"
import '../styles/Home.css'
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "../components/LanguageSwitcher"

function Home() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSpotifyConnect = async () => {
    setLoading(true)
    setError("")
  
    try {
      const token = localStorage.getItem("token"); // tu token de login
      const res = await fetch(`http://127.0.0.1:8000/api/spotify/redirect?token=${token}`, {
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