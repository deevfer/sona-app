import "../styles/Login.css"
import "../styles/Responsive.css"
import { useState, useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import BackIcon from "../assets/back.svg?react"
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "../components/LanguageSwitcher"
import { sileo } from "sileo"

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

  // Reset password states
  const [resetView, setResetView] = useState(null) // null | "email" | "code" | "newPassword"
  const [resetEmail, setResetEmail] = useState("")
  const [resetCode, setResetCode] = useState("")
  const [resetPassword, setResetPassword] = useState("")
  const [resetLoading, setResetLoading] = useState(false)

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

  const successTitle = (text) => (
    <span style={{ color: "#32d74b", fontWeight: 600 }}>{text}</span>
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

  const showSuccessToast = ({ title, description }) => {
    sileo.success({
      title: successTitle(title),
      description: toastDescription(description),
    })
  }

  useEffect(() => {
    const fetchLoginArtworks = async () => {
      try {
        setLoadingArtworks(true)

        const res = await fetch(
          `${API_BASE}/api/apple-music/landing-artworks?storefront=us&limit=40`,
          { headers: { Accept: "application/json" } }
        )

        if (!res.ok) throw new Error("No se pudieron cargar artworks")

        const data = await res.json()
        const items = Array.isArray(data?.items) ? data.items : []

        const uniqueItems = items.filter(
          (item, index, self) =>
            item?.id && item?.image && self.findIndex((x) => x.id === item.id) === index
        )

        setArtworks(uniqueItems)

        if (uniqueItems.length > 0) {
          const shuffled = shuffleArray(uniqueItems)
          setDisplayCards(shuffled.slice(0, TOTAL_VISIBLE_CARDS))
          setLoginBg(uniqueItems[Math.floor(Math.random() * uniqueItems.length)]?.image || "")
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

          const nextArtwork = availablePool[Math.floor(Math.random() * availablePool.length)]

          setFlippingIndex(randomIndex)

          replaceTimeoutRef.current = setTimeout(() => {
            setDisplayCards((cardsNow) =>
              cardsNow.map((card, index) => (index === randomIndex ? nextArtwork : card))
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password, device_name: "ios" }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        localStorage.setItem("token", data.token)
        localStorage.setItem("user", JSON.stringify(data.user))
        navigate("/home")
        return
      }

      if (data?.error === "SESSION_ACTIVE") {
        showErrorToast({ title: t("login.sessionActive"), description: t("login.sessionActiveDesc") })
        return
      }

      if (data?.error === "INVALID_CREDENTIALS") {
        showErrorToast({ title: t("login.invalidCredentials"), description: t("login.invalidCredentialsDesc") })
        return
      }

      showErrorToast({ title: t("login.errorS"), description: t("login.tryAgainLater") })
    } catch (err) {
      console.error(err)
      showErrorToast({ title: t("login.errorS"), description: t("login.tryAgainLater") })
    } finally {
      setLoading(false)
    }
  }

  const handleSendCode = async (e) => {
    e.preventDefault()
    if (!resetEmail) return
    setResetLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/password/send-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok && data?.sent) {
        showSuccessToast({ title: t("reset.codeSentTitle"), description: t("reset.codeSentDesc") })
        setResetView("code")
        return
      }

      if (data?.error === "USER_NOT_FOUND") {
        showErrorToast({ title: t("reset.errorTitle"), description: t("reset.userNotFound") })
        return
      }

      showErrorToast({ title: t("reset.errorTitle"), description: t("reset.errorDesc") })
    } catch {
      showErrorToast({ title: t("reset.errorTitle"), description: t("reset.errorDesc") })
    } finally {
      setResetLoading(false)
    }
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    if (!resetCode || resetCode.length !== 6) return
    setResetLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/password/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: resetEmail, code: resetCode }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok && data?.verified) {
        setResetView("newPassword")
        return
      }

      if (data?.error === "CODE_EXPIRED") {
        showErrorToast({ title: t("reset.errorTitle"), description: t("reset.codeExpired") })
        return
      }

      showErrorToast({ title: t("reset.errorTitle"), description: t("reset.invalidCode") })
    } catch {
      showErrorToast({ title: t("reset.errorTitle"), description: t("reset.errorDesc") })
    } finally {
      setResetLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!resetPassword || resetPassword.length < 8) {
      showErrorToast({ title: t("reset.errorTitle"), description: t("reset.passwordMin") })
      return
    }
    setResetLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: resetEmail, code: resetCode, password: resetPassword }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok && data?.reset) {
        showSuccessToast({ title: t("reset.successTitle"), description: t("reset.successDesc") })
        setResetView(null)
        setResetEmail("")
        setResetCode("")
        setResetPassword("")
        return
      }

      if (data?.error === "CODE_EXPIRED") {
        showErrorToast({ title: t("reset.errorTitle"), description: t("reset.codeExpired") })
        return
      }

      showErrorToast({ title: t("reset.errorTitle"), description: t("reset.errorDesc") })
    } catch {
      showErrorToast({ title: t("reset.errorTitle"), description: t("reset.errorDesc") })
    } finally {
      setResetLoading(false)
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
          <button onClick={() => resetView ? setResetView(null) : navigate("/")}>
            <BackIcon />
          </button>
        </div>

        <div className="loginForm">
          {!resetView && (
            <>
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
                    <button type="button" onClick={() => setResetView("email")}>
                      {t("login.forgotPassword")}
                    </button>
                  </p>
                </div>

                <div className="alreadyHave">
                  <p>
                    {t("login.notYet")}{" "}
                    <button type="button" onClick={() => navigate("/register")}>
                      {t("login.register")}
                    </button>
                  </p>
                </div>
              </form>
            </>
          )}

          {resetView === "email" && (
            <>
              <h1>{t("reset.title")}</h1>
              <span>{t("reset.enterEmail")}</span>

              <form className="material-form" onSubmit={handleSendCode}>
                <div className="input-field">
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                  <label>{t("login.email")}</label>
                  <span className="bar"></span>
                </div>

                <button type="submit" disabled={resetLoading}>
                  {resetLoading ? t("login.loading") : t("reset.sendCode")}
                </button>
              </form>
            </>
          )}

          {resetView === "code" && (
            <>
              <h1>{t("reset.verifyTitle")}</h1>
              <span>{t("reset.enterCode")}</span>

              <form className="material-form" onSubmit={handleVerifyCode}>
                <div className="input-field">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                  />
                  <label>{t("reset.code")}</label>
                  <span className="bar"></span>
                </div>

                <button type="submit" disabled={resetLoading || resetCode.length !== 6}>
                  {resetLoading ? t("login.loading") : t("reset.verify")}
                </button>

                <div className="alreadyHave">
                  <p>
                    <button type="button" onClick={() => setResetView("email")}>
                      {t("reset.resendCode")}
                    </button>
                  </p>
                </div>
              </form>
            </>
          )}

          {resetView === "newPassword" && (
            <>
              <h1>{t("reset.newPasswordTitle")}</h1>
              <span>{t("reset.enterNewPassword")}</span>

              <form className="material-form" onSubmit={handleResetPassword}>
                <div className="input-field">
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    required
                  />
                  <label>{t("login.password")}</label>
                  <span className="bar"></span>
                </div>

                <button type="submit" disabled={resetLoading}>
                  {resetLoading ? t("login.loading") : t("reset.resetButton")}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login