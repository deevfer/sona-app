const CUSTOM_BG_PREFIX = "custom:"

export function isCustomBackground(bg) {
  return typeof bg === "string" && bg.startsWith(CUSTOM_BG_PREFIX)
}

export function toCustomBackground(color) {
  return `${CUSTOM_BG_PREFIX}${color}`
}

export function getCustomBackgroundColor(bg, fallback = "#fca519") {
  if (!isCustomBackground(bg)) return fallback
  const color = bg.slice(CUSTOM_BG_PREFIX.length)
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback
}

function getLuminance(hex) {
  const color = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#fca519"
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000
}

export function getBackgroundClass(bg) {
  if (bg === "cover") return "bg-cover"
  if (isCustomBackground(bg)) return "bg-custom"
  return `bg-${bg || "yellow"}`
}

export function getBackgroundStyles(bg, coverUrl = "") {
  if (bg === "cover" && coverUrl) {
    return {
      backgroundImage: `url(${coverUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    }
  }

  if (isCustomBackground(bg)) {
    const color = getCustomBackgroundColor(bg)

    return {
      "--sona-custom-bg": color,
      backgroundColor: color,
    }
  }

  return {}
}

export function getBackgroundTextClass(bg, coverTextClass = "text-light") {
  if (bg === "cover") return coverTextClass
  if (bg === "black") return "text-light"
  if (isCustomBackground(bg)) {
    return getLuminance(getCustomBackgroundColor(bg)) > 170
      ? "text-dark"
      : "text-light"
  }
  return "text-dark"
}
