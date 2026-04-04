import "../styles/Register.css"
import "../styles/Responsive.css"
import { useNavigate } from "react-router-dom"
import BackIcon from "../assets/back.svg?react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "../components/LanguageSwitcher"
import { sileo } from "sileo"
import { Capacitor, registerPlugin } from "@capacitor/core"

const API_BASE = import.meta.env.VITE_API_BASE
const PRODUCT_ID = "com.fernandovasquez.sona.lifetime"

let StoreKit = null
try {
  if (Capacitor.isNativePlatform()) {
    StoreKit = registerPlugin("StoreKitPlugin")
  }
} catch {}

function Register() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [purchasing, setPurchasing] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  })

  const formDataRef = useRef(formData)

  useEffect(() => {
    formDataRef.current = formData
  }, [formData])

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

  const handlePurchase = async () => {
    const { name, email, password } = formDataRef.current

    if (!name || !email || !password) {
      showErrorToast({
        title: t("register.registerErrorTitle"),
        description:
          t("register.fillAllFields") || "Please fill all fields",
      })
      return
    }

    try {
      const checkRes = await fetch(`${API_BASE}/api/check-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const checkData = await checkRes.json().catch(() => ({}))

      if (checkData?.exists) {
        showErrorToast({
          title: t("register.registerErrorTitle"),
          description:
            t("register.emailExists") ||
            "This email is already registered",
        })
        return
      }
    } catch (error) {
      console.error("Email check error:", error)
    }

    if (!StoreKit) {
      showErrorToast({
        title: t("register.paymentErrorTitle"),
        description:
          t("register.iapNotAvailable") ||
          "In-App Purchase is not available",
      })
      return
    }

    setPurchasing(true)

    try {
      console.log("Trying product:", PRODUCT_ID)

      try {
        const productDebug = await StoreKit.getProduct({
          productId: PRODUCT_ID,
        })
        console.log("IAP product loaded:", productDebug)
      } catch (productError) {
        console.error("IAP getProduct failed:", productError)
      }

      const result = await StoreKit.purchase({ productId: PRODUCT_ID })
      console.log("IAP result:", result)

      if (result?.cancelled) {
        setPurchasing(false)
        return
      }

      if (result?.pending) {
        showErrorToast({
          title: t("register.paymentErrorTitle"),
          description:
            t("register.purchasePending") ||
            "Your purchase is pending approval.",
        })
        setPurchasing(false)
        return
      }

      if (result?.success) {
        const payload = {
          ...formDataRef.current,
          transactionId: result.transactionId,
          productId: result.productId,
        }

        console.log("register-with-iap payload:", payload)

        const response = await fetch(`${API_BASE}/api/register-with-iap`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        })

        const data = await response.json().catch(() => ({}))
        console.log("register-with-iap response:", data)

        if (!response.ok) {
          showErrorToast({
            title: data?.message || t("register.registerErrorTitle"),
            description:
              data?.error ||
              data?.details ||
              (data?.errors ? JSON.stringify(data.errors) : null) ||
              t("register.registerErrorDesc"),
          })
          setPurchasing(false)
          return
        }

        showSuccessToast({
          title: t("register.successTitle"),
          description: t("register.successDesc"),
        })

        setTimeout(() => {
          navigate("/login")
        }, 1200)

        return
      }

      showErrorToast({
        title: t("register.paymentErrorTitle"),
        description:
          t("register.paymentErrorDesc") ||
          "We couldn't complete your purchase.",
      })
    } catch (e) {
      console.error("Purchase error:", e)

      const message =
        e?.errorMessage ||
        e?.message ||
        t("register.paymentErrorDesc")

      showErrorToast({
        title: t("register.paymentErrorTitle"),
        description: message,
      })
    } finally {
      setPurchasing(false)
    }
  }

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

            <span className="price">{t("register.price")}</span>

            <button
              type="button"
              className="purchaseBtn"
              onClick={handlePurchase}
              disabled={purchasing}
            >
              {purchasing
                ? t("register.processing") || "Processing..."
                : t("register.purchase") || "Purchase"}
            </button>

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