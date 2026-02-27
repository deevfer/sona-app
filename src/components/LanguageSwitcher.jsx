import { useState, useEffect } from "react"
import i18n from "../i18n"
import "../styles/LanguageSwitcher.css"

function LanguageSwitcher() {
  const [currentLang, setCurrentLang] = useState(i18n.language)

  useEffect(() => {
    setCurrentLang(i18n.language)
  }, [])

  const toggleLanguage = () => {
    const newLang = currentLang === "en" ? "es" : "en"
    i18n.changeLanguage(newLang)
    localStorage.setItem("lang", newLang)
    setCurrentLang(newLang)
  }

  return (
    <div className="languageSwitcher" onClick={toggleLanguage}>
      <div className={`switch ${currentLang === "es" ? "active" : ""}`}>
        <span className="label">EN</span>
        <span className="label">ES</span>
      </div>
    </div>
  )
}

export default LanguageSwitcher