import "../styles/Register.css"
import { useNavigate } from "react-router-dom"
import BackIcon from "../assets/back.svg?react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "../components/LanguageSwitcher"

function Register() {
  const navigate = useNavigate()
  const paypalRef = useRef(null)
  const { t } = useTranslation()

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  })

  useEffect(() => {
    if (!window.paypal || !paypalRef.current) return
    if (!window.paypal.HostedButtons) return

    paypalRef.current.innerHTML = ""

    window.paypal
      .HostedButtons({
        hostedButtonId: "QFKYNDTKY8HAN",
      })
      .render(paypalRef.current)
      .catch((err) => {
        console.error("PayPal Hosted Button error:", err)
      })
  }, [])

  return (
    <div className="login">
      <div className="container-lang">
        <LanguageSwitcher />
      </div>

      <div className="container">
        <div className="backButton">
          <button onClick={() => navigate("/login")}>
            <BackIcon />
          </button>
        </div>

        <div className="loginForm">
          <h1>{t("register.title")}</h1>
          <span>{t("register.subtitle")}</span>

          <form className="material-form" onSubmit={(e) => e.preventDefault()}>
            <div className="input-field">
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
              <label>{t("register.name")}</label>
            </div>

            <div className="input-field">
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
              <label>{t("register.email")}</label>
            </div>

            <div className="input-field">
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
              <label>{t("register.password")}</label>
            </div>

            <span className="price">{t("register.price")}</span>

            <div ref={paypalRef} id="paypal-container-QFKYNDTKY8HAN"></div>

            <div className="alreadyHave">
              <p>
                {t("register.haveAccount")}{" "}
                <button type="button" onClick={() => navigate("/login")}>
                  {t("register.login")}
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Register