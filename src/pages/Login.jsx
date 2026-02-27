import '../styles/Login.css'
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import BackIcon from "../assets/back.svg?react"
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "../components/LanguageSwitcher"

function Login() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("http://127.0.0.1:8000/api/login", { 
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()
      setLoading(false)

      if (res.ok) {
        localStorage.setItem("token", data.token)
        localStorage.setItem("user", JSON.stringify(data.user))

        navigate("/home")
      } else {
        setError(data.message || t("login.error") )
      }
    } catch (err) {
      setLoading(false)
      setError(t("login.error"))
      console.error(err)
    }
  }

  return (
    <div className="login">
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

            {error && <p className="error">{error}</p>}

            <button type="submit" disabled={loading}>
                {loading ? t("login.loading") : t("login.button")}
            </button>


            <div className="alreadyHave">
              <p>{t("login.notYet")} <button type="button" onClick={() => navigate("/register")}>{t("login.register")}</button></p>
            </div>
          </form>
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

export default Login