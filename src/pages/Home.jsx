import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import "../styles/Home.css"
import "../styles/Responsive.css"
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "../components/LanguageSwitcher"
import FullScreenLoader from "../components/FullScreenLoader"
import { Capacitor } from "@capacitor/core"
import AppleMusicAuthPlugin from "../plugins/appleMusicAuth"

const API_BASE = import.meta.env.VITE_API_BASE
const APPLE_DEV_NAME = "Sona"

// 🔥 DETECCIÓN DE SIMULADOR
const isSimulator =
  Capacitor.getPlatform() === "ios" &&
  !window?.webkit?.messageHandlers

function Home() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [loadingSpotify, setLoadingSpotify] = useState(false)
  const [loadingApple, setLoadingApple] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState("")
  const [startingDemo, setStartingDemo] = useState(false)
  const demoTimerRef = useRef(null)

  const isNativeIOS =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios"

  const startDemoMode = useCallback(() => {
    setStartingDemo(true)
    localStorage.removeItem("appleMusicConnected")
    localStorage.removeItem("appleMusicUserToken")
    localStorage.setItem("musicProvider", "apple_music")
    localStorage.setItem("appleMusicDemo", "true")

    if (demoTimerRef.current) clearTimeout(demoTimerRef.current)

    demoTimerRef.current = setTimeout(() => {
      navigate("/sona", { replace: true })
    }, 1500)
  }, [navigate])

  useEffect(() => {
    return () => {
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) {
          setChecking(false)
          return
        }

        // 🔥 DEMO MODE
        if (localStorage.getItem("appleMusicDemo") === "true") {
          startDemoMode()
          return
        }

        // 🔥 MOCK EN SIMULADOR (EVITA LLAMADAS REALES)
        if (isSimulator) {
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
            } else {
              if (localStorage.getItem("musicProvider") === "spotify") {
                localStorage.removeItem("musicProvider")
              }
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
              localStorage.removeItem("appleMusicDemo")
              navigate("/sona", { replace: true })
              return
            } else {
              // 🔥 LIMPIEZA CRÍTICA
              localStorage.removeItem("appleMusicConnected")
              if (localStorage.getItem("musicProvider") === "apple_music") {
                localStorage.removeItem("musicProvider")
              }
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
  }, [navigate, startDemoMode])

  const handleDemoMode = () => {
    if (startingDemo) return
    startDemoMode()
  }

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

  const handleAppleMusicConnectNative = async (token) => {
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

    const nativeResult = await AppleMusicAuthPlugin.connect({
      developerToken,
    })

    const musicUserToken = nativeResult?.musicUserToken

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
        scopes: ["native_ios"],
      }),
    })

    if (!connectRes.ok) {
      const errorText = await connectRes.text()
      throw new Error(errorText || "No se pudo guardar la conexión de Apple Music")
    }

    localStorage.removeItem("appleMusicDemo")
    localStorage.setItem("appleMusicConnected", "true")
    localStorage.setItem("appleMusicUserToken", musicUserToken)
    localStorage.setItem("musicProvider", "apple_music")

    navigate("/sona", { replace: true })
  }

  const handleAppleMusicConnectWeb = async (token) => {
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

    localStorage.removeItem("appleMusicDemo")
    localStorage.setItem("appleMusicConnected", "true")
    localStorage.setItem("appleMusicUserToken", musicUserToken)
    localStorage.setItem("musicProvider", "apple_music")

    navigate("/sona", { replace: true })
  }

  const handleAppleMusicConnect = async () => {
    setLoadingApple(true)
    setError("")

    try {
      const token = localStorage.getItem("token")

      if (!token) {
        throw new Error("Usuario no autenticado")
      }

      // 🔥 MOCK EN SIMULADOR
      if (isSimulator) {
        localStorage.removeItem("appleMusicDemo")
        localStorage.setItem("musicProvider", "apple_music")
        localStorage.setItem("appleMusicConnected", "true")

        setTimeout(() => {
          navigate("/sona", { replace: true })
        }, 300)

        return
      }

      if (isNativeIOS) {
        await handleAppleMusicConnectNative(token)
      } else {
        await handleAppleMusicConnectWeb(token)
      }
    } catch (err) {
      console.error("Apple Music connect error:", err)
      console.error("Error code:", err?.code)
      console.error("Error message:", err?.message)
      console.error("Error errorMessage:", err?.errorMessage)
      console.error("Error stringify:", JSON.stringify(err))
    
      const msg = (err?.message || err?.errorMessage || "").toLowerCase()
    
      const showAlert = (title, message) => {
        if (isNativeIOS && window.Capacitor?.Plugins?.Dialog) {
          window.Capacitor.Plugins.Dialog.alert({
            title,
            message,
          }).catch(() => {
            alert(message)
          })
        } else {
          alert(message)
        }
      }
    
      // 0. Error vacío o silencioso del plugin
      if (!msg || msg.trim() === "") {
        showAlert("Apple Music", t("connect.unknownError"))
        return
      }
    
      // 1. Permiso denegado
      if (
        msg.includes("authorization denied") ||
        msg.includes("permission denied") ||
        msg.includes("not authorized") ||
        msg.includes("user denied") ||
        msg.includes("access denied")
      ) {
        if (isNativeIOS && window.Capacitor?.Plugins?.Dialog) {
          window.Capacitor.Plugins.Dialog.confirm({
            title: "Apple Music",
            message: t("connect.authDenied"),
            okButtonTitle: t("connect.openSettings"),
            cancelButtonTitle: "OK",
          }).then((result) => {
            if (result.value) {
              window.Capacitor.Plugins.App.openUrl({ url: "app-settings:" })
            }
          }).catch(() => {})
        } else {
          alert(t("connect.authDenied"))
        }
        return
      }
    
      // 2. Sin suscripción / token fallido / Apple Music requerido
      if (
        msg.includes("skerrordomain") ||
        msg.includes("music user token not found") ||
        msg.includes("failed to get music user token") ||
        msg.includes("missing developertoken") ||
        msg.includes("cancelled") ||
        msg.includes("canceled") ||
        msg.includes("not subscribed") ||
        msg.includes("subscription required") ||
        msg.includes("no active subscription") ||
        msg.includes("user not eligible") ||
        msg.includes("music subscription") ||
        msg.includes("apple music subscription")
      ) {
        showAlert("Apple Music", t("connect.appleMusicRequired"))
        return
      }
    
      // 3. Apple Music no disponible en el dispositivo / servicio no disponible
      if (
        msg.includes("apple music is not available") ||
        msg.includes("service not available") ||
        msg.includes("media services are not enabled") ||
        msg.includes("not available on this device") ||
        msg.includes("music service unavailable") ||
        msg.includes("service unavailable")
      ) {
        showAlert("Apple Music", t("connect.notAvailable"))
        return
      }
    
      // 4. Error de red / timeout
      if (
        msg.includes("failed to fetch") ||
        msg.includes("networkerror") ||
        msg.includes("timeout") ||
        msg.includes("timed out") ||
        msg.includes("network request failed") ||
        msg.includes("the request timed out") ||
        msg.includes("couldn’t be completed") ||
        msg.includes("couldn't be completed") ||
        msg.includes("connection lost") ||
        msg.includes("offline")
      ) {
        showAlert("Apple Music", t("connect.networkError"))
        return
      }
    
      // 5. Error de servidor / developer token / backend
      if (
        msg.includes("developer token") ||
        msg.includes("no se recibió el developer token") ||
        msg.includes("no se pudo obtener") ||
        msg.includes("no se pudo guardar") ||
        msg.includes("failed to save") ||
        msg.includes("server error") ||
        msg.includes("internal server error") ||
        msg.includes("invalid developer token")
      ) {
        showAlert("Apple Music", t("connect.serverError"))
        return
      }
    
      // 6. Región / storefront / país no compatible
      if (
        msg.includes("storefront") ||
        msg.includes("country") ||
        msg.includes("region") ||
        msg.includes("not allowed in this region") ||
        msg.includes("not available in your country") ||
        msg.includes("territory")
      ) {
        showAlert("Apple Music", t("connect.regionError"))
        return
      }
    
      // 7. Usuario no autenticado en Apple Music
      if (
        msg.includes("not logged in") ||
        msg.includes("user token is invalid") ||
        msg.includes("authorization failed") ||
        msg.includes("login required") ||
        msg.includes("authentication required") ||
        msg.includes("invalid user token")
      ) {
        showAlert("Apple Music", t("connect.loginRequired"))
        return
      }
    
      // 8. MusicKit / inicialización / plugin no disponible
      if (
        msg.includes("musickit") ||
        msg.includes("not configured") ||
        msg.includes("instance not available") ||
        msg.includes("plugin not implemented") ||
        msg.includes("unimplemented") ||
        msg.includes("not initialized") ||
        msg.includes("initialization failed")
      ) {
        showAlert("Apple Music", t("connect.initError"))
        return
      }
    
      // 9. Error desconocido
      const errorCode = err?.code ? ` (${err.code})` : ""
      const errorMsg = msg || "Unknown error"

      showAlert(
        "Apple Music",
        `${t("connect.error")}\n\n${errorMsg}${errorCode}`
      )
    } finally {
      setLoadingApple(false)
    }
  }

  if (checking) return <FullScreenLoader visible={startingDemo} />

  return (
    <>
      <div className="landing">
        <div className="container-lang">
          <LanguageSwitcher />
        </div>

        <div className="container">
          <div className="loginForm connectService">
            <h1>{t("connect.title")}</h1>
            <span>{t("connect.subtitle")}</span>

            {error && <p className="error">{error}</p>}

            <div className="btnsConect">
              <div className="btnPrimary">
                <button
                  onClick={handleAppleMusicConnect}
                  disabled={loadingSpotify || loadingApple || startingDemo}
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
                  <span className="comingSoon">Coming soon</span>
                </button>
              </div>
              <div className="btnPrimary noAccountBtn">
                <button onClick={handleDemoMode} disabled={startingDemo}>
                  <span>{t("connect.noAccount")}</span>
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
      <FullScreenLoader visible={startingDemo} />
    </>
  )
}

export default Home
