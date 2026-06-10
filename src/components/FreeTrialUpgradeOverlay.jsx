import "../styles/FreeTrialUpgradeOverlay.css"

function FreeTrialUpgradeOverlay({ visible, title, cta, later, onCta, onLater }) {
  if (!visible) return null

  return (
    <div
      className="freeTrialOverlay"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <button type="button" className="freeTrialLater" onClick={onLater}>
        {later}
      </button>

      <div className="freeTrialGlass">
        <p>{title}</p>
        <button type="button" onClick={onCta}>
          {cta}
        </button>
      </div>
    </div>
  )
}

export default FreeTrialUpgradeOverlay
