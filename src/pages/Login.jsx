import "../styles/Login.css"
import { useState, useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import BackIcon from "../assets/back.svg?react"
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "../components/LanguageSwitcher"
import { sileo } from "sileo"
import { Capacitor } from "@capacitor/core"

const API_BASE = import.meta.env.VITE_API_BASE

const TOTAL_VISIBLE_CARDS = 24
const FLIP_INTERVAL_MIN = 2200
const FLIP_INTERVAL_MAX = 4000
const FLIP_DURATION = 100

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffleArray(arr) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function Login() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const [loadingArtworks, setLoadingArtworks] = useState(true)
  const [artworks, setArtworks] = useState([])
  const [loginBg, setLoginBg] = useState("")
  const [displayCards, setDisplayCards] = useState([])
  const [flippingIndex, setFlippingIndex] = useState(null)

  const flipTimeoutRef = useRef(null)
  const replaceTimeoutRef = useRef(null)
  const releaseTimeoutRef = useRef(null)

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

  useEffect(() => {
    const fetchLoginArtworks = async () => {
      try {
        setLoadingArtworks(true)

        const res = await fetch(
          `${API_BASE}/api/apple-music/landing-artworks?storefront=us&limit=40`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        )

        if (!res.ok) throw new Error("No se pudieron cargar artworks")

        const data = await res.json()
        const items = Array.isArray(data?.items) ? data.items : []

        const uniqueItems = items.filter(
          (item, index, self) =>
            item?.id &&
            item?.image &&
            self.findIndex((x) => x.id === item.id) === index
        )

        setArtworks(uniqueItems)

        if (uniqueItems.length > 0) {
          const shuffled = shuffleArray(uniqueItems)
          const initialCards = shuffled.slice(0, TOTAL_VISIBLE_CARDS)
          setDisplayCards(initialCards)

          const randomBg =
            uniqueItems[Math.floor(Math.random() * uniqueItems.length)]
          setLoginBg(randomBg?.image || "")
        } else {
          setDisplayCards([])
          setLoginBg("")
        }
      } catch (err) {
        console.error(err)
        setArtworks([])
        setDisplayCards([])
        setLoginBg("")
      } finally {
        setLoadingArtworks(false)
      }
    }

    fetchLoginArtworks()

    return () => {
      if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current)
      if (replaceTimeoutRef.current) clearTimeout(replaceTimeoutRef.current)
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (loadingArtworks) return
    if (artworks.length <= displayCards.length) return
    if (displayCards.length === 0) return

    const scheduleNextFlip = () => {
      const nextDelay = getRandomInt(FLIP_INTERVAL_MIN, FLIP_INTERVAL_MAX)

      flipTimeoutRef.current = setTimeout(() => {
        setDisplayCards((prevCards) => {
          if (!prevCards.length) return prevCards

          const randomIndex = Math.floor(Math.random() * prevCards.length)
          const currentCard = prevCards[randomIndex]

          const visibleIds = new Set(prevCards.map((card) => card.id))
          visibleIds.delete(currentCard.id)

          const availablePool = artworks.filter(
            (item) => item?.id && item?.image && !visibleIds.has(item.id)
          )

          if (!availablePool.length) {
            scheduleNextFlip()
            return prevCards
          }

          const nextArtwork =
            availablePool[Math.floor(Math.random() * availablePool.length)]

          setFlippingIndex(randomIndex)

          replaceTimeoutRef.current = setTimeout(() => {
            setDisplayCards((cardsNow) =>
              cardsNow.map((card, index) =>
                index === randomIndex ? nextArtwork : card
              )
            )
          }, FLIP_DURATION / 2)

          releaseTimeoutRef.current = setTimeout(() => {
            setFlippingIndex(null)
            scheduleNextFlip()
          }, FLIP_DURATION)

          return prevCards
        })
      }, nextDelay)
    }

    scheduleNextFlip()

    return () => {
      if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current)
      if (replaceTimeoutRef.current) clearTimeout(replaceTimeoutRef.current)
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current)
    }
  }, [loadingArtworks, artworks, displayCards.length])

  const rows = useMemo(() => {
    if (!displayCards.length) return [[], []]

    const row1 = displayCards.slice(0, Math.ceil(displayCards.length / 2))
    const row2 = displayCards.slice(Math.ceil(displayCards.length / 2))

    return [row1, row2]
  }, [displayCards])

  const skeletonRows = useMemo(() => {
    const placeholders = Array.from({ length: TOTAL_VISIBLE_CARDS }, (_, i) => ({
      id: `skeleton-${i}`,
    }))

    const row1 = placeholders.slice(0, Math.ceil(placeholders.length / 2))
    const row2 = placeholders.slice(Math.ceil(placeholders.length / 2))

    return [row1, row2]
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          device_name: "android",
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        localStorage.setItem("token", data.token)
        localStorage.setItem("user", JSON.stringify(data.user))
        const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
        navigate(isAndroidNative ? "/sona" : "/home")
        return
      }

      if (data?.error === "SESSION_ACTIVE") {
        showErrorToast({
          title: t("login.sessionActive"),
          description: t("login.sessionActiveDesc"),
        })
        return
      }

      if (data?.error === "INVALID_CREDENTIALS") {
        showErrorToast({
          title: t("login.invalidCredentials"),
          description: t("login.invalidCredentialsDesc"),
        })
        return
      }

      showErrorToast({
        title: t("login.errorS"),
        description: t("login.tryAgainLater"),
      })
    } catch (err) {
      console.error(err)
      showErrorToast({
        title: t("login.errorS"),
        description: t("login.tryAgainLater"),
      })
    } finally {
      setLoading(false)
    }
  }

  const loginStyle = loginBg
    ? {
        backgroundImage: `url(${loginBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : {}

  return (
    <div className="login" style={loginStyle}>
      <div className="overlayBackgroundLogin"></div>

      <div className="container-lang">
        <LanguageSwitcher />
      </div>

      <div className="container">
        <div className="backButton">
          <button onClick={() => navigate("/")}>
            <BackIcon />
          </button>
        </div>

        <div className="loginForm">
          <h1>{t("login.title")}</h1>
          <span>{t("login.subtitle")}</span>

          <form className="material-form" onSubmit={handleSubmit}>
            <div className="input-field">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <label>{t("login.email")}</label>
              <span className="bar"></span>
            </div>

            <div className="input-field">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <label>{t("login.password")}</label>
              <span className="bar"></span>
            </div>

            <button type="submit" disabled={loading}>
              {loading ? t("login.loading") : t("login.button")}
            </button>

            <div className="alreadyHave">
              <p>
                {t("login.notYet")}{" "}
                <button type="button" onClick={() => navigate("/register")}>
                  {t("login.register")}
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* <div className="loginArtworksBottom">
        {loadingArtworks || !displayCards.length ? (
          <>
            <div className="loginArtworkRowFixed">
              {skeletonRows[0].map((item) => (
                <div
                  className="loginArtworkCard skeleton shimmer"
                  key={item.id}
                >
                  <div className="skeletonBox" />
                </div>
              ))}
            </div>

            <div className="loginArtworkRowFixed">
              {skeletonRows[1].map((item) => (
                <div
                  className="loginArtworkCard skeleton shimmer"
                  key={item.id}
                >
                  <div className="skeletonBox" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="loginArtworkRowFixed">
              {rows[0].map((item, index) => (
                <div
                  className={`loginArtworkCard ${
                    flippingIndex === index ? "isFlipping" : ""
                  }`}
                  key={`row1-${item.id}`}
                >
                  <img src={item.image} alt={item.title || ""} loading="lazy" />
                </div>
              ))}
            </div>

            <div className="loginArtworkRowFixed">
              {rows[1].map((item, index) => {
                const realIndex = rows[0].length + index
                return (
                  <div
                    className={`loginArtworkCard ${
                      flippingIndex === realIndex ? "isFlipping" : ""
                    }`}
                    key={`row2-${item.id}`}
                  >
                    <img src={item.image} alt={item.title || ""} loading="lazy" />
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div> */}
    </div>
  )
}

export default Login