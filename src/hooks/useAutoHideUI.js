import { useEffect, useRef, useState, useCallback } from "react"

export function useAutoHideUI(delay = 5000) {
  const [visible, setVisible] = useState(true)
  const timeoutRef = useRef(null)

  const clearHideTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const startHideTimeout = useCallback(() => {
    clearHideTimeout()
    timeoutRef.current = setTimeout(() => {
      setVisible(false)
    }, delay)
  }, [clearHideTimeout, delay])

  const showAndReset = useCallback(() => {
    setVisible(true)
    startHideTimeout()
  }, [startHideTimeout])

  useEffect(() => {
    startHideTimeout()

    const handleUserActivity = () => {
      showAndReset()
    }

    window.addEventListener("click", handleUserActivity)
    window.addEventListener("touchstart", handleUserActivity)
    window.addEventListener("mousemove", handleUserActivity)
    window.addEventListener("keydown", handleUserActivity)

    return () => {
      clearHideTimeout()
      window.removeEventListener("click", handleUserActivity)
      window.removeEventListener("touchstart", handleUserActivity)
      window.removeEventListener("mousemove", handleUserActivity)
      window.removeEventListener("keydown", handleUserActivity)
    }
  }, [showAndReset, startHideTimeout, clearHideTimeout])

  return {
    visible,
    showAndReset,
    setVisible,
  }
}