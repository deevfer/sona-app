import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import "../styles/Home.css"
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "../components/LanguageSwitcher"

const API_BASE = import.meta.env.VITE_API_BASE
const APPLE_DEV_NAME = "Sona"

function Home() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [loadingSpotify, setLoadingSpotify] = useState(false)
  const [loadingApple, setLoadingApple] = useState(false)
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

        const headers = {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        }

        try {
          const spotifyRes = await fetch(`${API_BASE}/api/spotify/status`, {
            headers,
          })

          if (spotifyRes.ok) {
            const spotifyData = await spotifyRes.json()
            if (spotifyData.connected) {
              localStorage.setItem("musicProvider", "spotify")
              navigate("/sona", { replace: true })
              return
            }
          }
        } catch (err) {
          console.error("Spotify status error:", err)
        }

        try {
          const appleRes = await fetch(`${API_BASE}/api/apple-music/status`, {
            headers,
          })

          if (appleRes.ok) {
            const appleData = await appleRes.json()
            if (appleData.connected) {
              localStorage.setItem("musicProvider", "apple_music")
              localStorage.setItem("appleMusicConnected", "true")
              navigate("/sona", { replace: true })
              return
            }
          }
        } catch (err) {
          console.error("Apple Music status error:", err)
        }
      } catch (err) {
        console.error("checkConnection error:", err)
      } finally {
        setChecking(false)
      }
    }

    checkConnection()
  }, [navigate])

  const handleSpotifyConnect = async () => {
    setLoadingSpotify(true)
    setError("")

    try {
      const token = localStorage.getItem("token")

      if (!token) {
        throw new Error("Usuario no autenticado")
      }

      const res = await fetch(`${API_BASE}/api/spotify/redirect?token=${token}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      })

      if (!res.ok) {
        throw new Error("Error al conectar con Spotify")
      }

      const data = await res.json()

      if (!data.url) {
        throw new Error("No se recibió URL de Spotify")
      }

      localStorage.setItem("musicProvider", "spotify")
      window.location.href = data.url
    } catch (err) {
      console.error(err)
      setError(err.message || t("connect.error"))
      setLoadingSpotify(false)
    }
  }

  const waitForMusicKit = () => {
    return new Promise((resolve, reject) => {
      if (window.MusicKit && typeof window.MusicKit.configure === "function") {
        resolve(window.MusicKit)
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error("MusicKit JS no terminó de cargar"))
      }, 8000)

      const handleLoaded = () => {
        clearTimeout(timeout)

        if (window.MusicKit && typeof window.MusicKit.configure === "function") {
          resolve(window.MusicKit)
        } else {
          reject(new Error("MusicKit no está disponible"))
        }
      }

      window.addEventListener("musickitloaded", handleLoaded, { once: true })
    })
  }

  const getOrCreateMusicKitInstance = async (developerToken) => {
    const MusicKit = await waitForMusicKit()

    let music = null

    try {
      music = MusicKit.getInstance()
    } catch {
      music = null
    }

    if (music) return music

    MusicKit.configure({
      developerToken,
      app: {
        name: APPLE_DEV_NAME,
        build: "1.0.0",
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 350))

    try {
      music = MusicKit.getInstance()
    } catch {
      music = null
    }

    if (!music) {
      throw new Error("Apple Music aún no terminó de inicializar. Intenta de nuevo.")
    }

    return music
  }

  const handleAppleMusicConnect = async () => {
    setLoadingApple(true)
    setError("")

    try {
      const token = localStorage.getItem("token")

      if (!token) {
        throw new Error("Usuario no autenticado")
      }

      const tokenRes = await fetch(`${API_BASE}/api/apple-music/token`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      })

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text()
        throw new Error(errorText || "No se pudo obtener el developer token de Apple Music")
      }

      const tokenData = await tokenRes.json()
      const developerToken = tokenData.token

      if (!developerToken) {
        throw new Error("No se recibió el developer token")
      }

      const music = await getOrCreateMusicKitInstance(developerToken)
      const musicUserToken = await music.authorize()

      if (!musicUserToken) {
        throw new Error("No se recibió el Music User Token")
      }

      const connectRes = await fetch(`${API_BASE}/api/apple-music/connect`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          music_user_token: musicUserToken,
          provider_user_id: null,
          scopes: ["musickit_web"],
        }),
      })

      if (!connectRes.ok) {
        const errorText = await connectRes.text()
        throw new Error(errorText || "No se pudo guardar la conexión de Apple Music")
      }

      localStorage.setItem("appleMusicConnected", "true")
      localStorage.setItem("appleMusicUserToken", musicUserToken)
      localStorage.setItem("musicProvider", "apple_music")

      navigate("/sona", { replace: true })
    } catch (err) {
      console.error(err)
      setError(err.message || t("connect.error"))
    } finally {
      setLoadingApple(false)
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
              <button
                onClick={handleAppleMusicConnect}
                disabled={loadingSpotify || loadingApple}
              >
                <img src="/AppleMusic.png" alt="Apple Music" />
                {loadingApple ? t("connect.loading") : "Apple Music"}
              </button>
            </div>

            <div className="btnPrimary">
              <button
                onClick={handleSpotifyConnect}
                disabled={true}
                className="disabledProviderBtn"
                title="Coming soon"
              >
                <img src="/spotify.png" alt="Spotify" />
                Spotify
                <span className="comingSoonBadge">Coming soon</span>
              </button>
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