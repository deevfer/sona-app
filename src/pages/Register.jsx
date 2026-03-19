import "../styles/Register.css"
import { useNavigate } from "react-router-dom"
import BackIcon from "../assets/back.svg?react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "../components/LanguageSwitcher"
import { sileo } from "sileo"

const API_BASE = import.meta.env.VITE_API_BASE

function Register() {
  const navigate = useNavigate()
  const paypalRef = useRef(null)
  const { t } = useTranslation()

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  })

  const formDataRef = useRef(formData)

  useEffect(() => {
    formDataRef.current = formData
  }, [formData])

  /* =========================
     TOAST HELPERS
  ========================= */

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

  /* =========================
     PAYPAL
  ========================= */

  useEffect(() => {
    if (!window.paypal || !paypalRef.current) return

    paypalRef.current.innerHTML = ""

    const buttons = window.paypal.Buttons({

      createOrder: (data, actions) => {
        return actions.order.create({
          purchase_units: [
            {
              amount: { value: "2.99" },
            },
          ],
        })
      },

      onApprove: async (data, actions) => {
        try {

          const order = await actions.order.capture()

          if (order.status !== "COMPLETED") {
            showErrorToast({
              title: t("register.paymentErrorTitle"),
              description: t("register.paymentErrorDesc"),
            })
            return
          }

          const response = await fetch(`${API_BASE}/api/register-with-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              ...formDataRef.current,
              orderID: data.orderID,
            }),
          })

          const result = await response.json().catch(() => ({}))

          if (!response.ok) {
            showErrorToast({
              title: result?.message || t("register.registerErrorTitle"),
              description: t("register.registerErrorDesc"),
            })
            return
          }

          showSuccessToast({
            title: t("register.successTitle"),
            description: t("register.successDesc"),
          })

          setTimeout(() => {
            navigate("/login")
          }, 1200)

        } catch (error) {

          console.error("Error al procesar el pago:", error)

          showErrorToast({
            title: t("register.paymentErrorTitle"),
            description: t("register.paymentErrorDesc"),
          })
        }
      },

      onError: (err) => {

        console.error("PayPal error:", err)

        showErrorToast({
          title: t("register.paypalErrorTitle"),
          description: t("register.paypalErrorDesc"),
        })
      },
    })

    buttons.render(paypalRef.current)

    return () => {
      buttons.close()
    }

  }, [navigate, t])

  /* =========================
     JSX
  ========================= */

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

          <form
            className="material-form"
            onSubmit={(e) => e.preventDefault()}
          >

            <div className="input-field">
              <input
                type="text"
                required
                value={formData.name || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    name: e.target.value,
                  })
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
                  setFormData({
                    ...formData,
                    email: e.target.value,
                  })
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
                  setFormData({
                    ...formData,
                    password: e.target.value,
                  })
                }
              />
              <label>{t("register.password")}</label>
            </div>

            <span className="price">
              {t("register.price")}
            </span>

            <div ref={paypalRef}></div>

            <div className="alreadyHave">
              <p>
                {t("register.haveAccount")}{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                >
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