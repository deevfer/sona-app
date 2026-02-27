import { useState } from "react"
import { useNavigate } from "react-router-dom"
import '../styles/Sona.css'
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "../components/LanguageSwitcher"

function Sona() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  
  return (
    <div className="sonaBody">
     
      <div className="container">
        
      </div>

    </div>
  )
}

export default Sona