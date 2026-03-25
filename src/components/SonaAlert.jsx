import { useTranslation } from "react-i18next"
import "../styles/SonaAlert.css"

function SonaAlert({ message, onClose }) {
  const { t } = useTranslation()

  if (!message) return null

  return (
    <div className="sonaAlertOverlay" onClick={onClose}>
      <div className="sonaAlertBox" onClick={(e) => e.stopPropagation()}>
        <p>{message}</p>
        <button onClick={onClose}>OK</button>
      </div>
    </div>
  )
}

export default SonaAlert