import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
  Navigate,
} from "react-router-dom"
import { Toaster } from "sileo"
import { useState, useEffect, useCallback, useRef } from "react"

import { ProtectedRoute, AuthRoute } from "./ProtectedRoutes"
import Landing from "./pages/Landing"
import Register from "./pages/Register"
import Login from "./pages/Login"
import Home from "./pages/Home"
import Sona from "./pages/Sona"
import Albums from "./pages/Albums"
import Queue from "./pages/Queue"

import MenuBottomComponent from "./components/MenuBottomComponent"
import {
  lockPortraitOrientation,
  unlockOrientation,
} from "./utils/orientation"

const API_BASE = import.meta.env.VITE_API_BASE

const SONA_ROUTES = ["/sona", "/sona-albums", "/sona-queue"]
const PORTRAIT_LOCKED_ROUTES = ["/", "/home", "/login", "/register"]
const ACCESS_MODE_KEY = "sonaAccessMode"
const ACCESS_MODE_PAID = "paid"
const ACCESS_MODE_FREE = "free"
const APPLE_DEMO_KEY = "appleMusicDemo"
const MUSIC_PROVIDER_KEY = "musicProvider"

const LEGACY_FREE_ROUTE_REDIRECTS = {
  "/sona-free": "/sona",
  "/sona-albums-free": "/sona-albums",
  "/sona-queue-free": "/sona-queue",
}

function isFreeAccessMode() {
  return (
    localStorage.getItem(ACCESS_MODE_KEY) === ACCESS_MODE_FREE ||
    localStorage.getItem(APPLE_DEMO_KEY) === "true"
  )
}

function getAccessMode() {
  if (localStorage.getItem("token")) return ACCESS_MODE_PAID
  if (isFreeAccessMode()) return ACCESS_MODE_FREE
  return ""
}

function enableFreeAccess() {
  localStorage.setItem(ACCESS_MODE_KEY, ACCESS_MODE_FREE)
  localStorage.setItem(MUSIC_PROVIDER_KEY, "apple_music")
  localStorage.setItem(APPLE_DEMO_KEY, "true")
  localStorage.removeItem("appleMusicConnected")
  localStorage.removeItem("appleMusicUserToken")
}

function enablePaidAccess() {
  localStorage.setItem(ACCESS_MODE_KEY, ACCESS_MODE_PAID)
}

function SonaAccessRoute({ children }) {
  const token = localStorage.getItem("token")
  const accessMode = getAccessMode()

  useEffect(() => {
    if (accessMode === ACCESS_MODE_FREE) {
      enableFreeAccess()
      return
    }

    if (token) {
      enablePaidAccess()
    }
  }, [accessMode, token])

  if (!token && accessMode !== ACCESS_MODE_FREE) {
    return <Navigate to="/login" replace />
  }

  return children
}

function FreeRouteRedirect({ to }) {
  const navigate = useNavigate()

  useEffect(() => {
    enableFreeAccess()
    navigate(to, { replace: true })
  }, [navigate, to])

  return null
}

function SonaCarousel() {
  const location = useLocation()
  const path = location.pathname

  const SLIDE_ORDER_MAP = {
    "/sona-albums": 0,
    "/sona": 1,
    "/sona-queue": 2,
  }

  const currentIndex = SLIDE_ORDER_MAP[path] ?? 1
  const [activeIndex, setActiveIndex] = useState(currentIndex)
  const [prevIndex, setPrevIndex] = useState(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const menuTimerRef = useRef(null)

  useEffect(() => {
    let enabled = false
    const enableTimer = setTimeout(() => { enabled = true }, 1000)

    const handleTap = (e) => {
      if (!enabled) return

      const interactive = e.target.closest(
        "button, a, input, .coverItem, .album3D, .albumFront, .albumBack, .albumSpine, .trackRow, .menuItem, .menuContent, .menuDropdown, .modalOverlay, .modalContent, .freeTrialOverlay, .freeTrialGlass, .freeTrialLater, .menuTopOptions, .menuBottom, .searchMenuTop, .controlers, .vinyl, .play, .backM, .nextM, .menuBottomElements, .switch, .searchExpandable"
      )
      if (interactive) return

      setShowMenu(true)

      if (menuTimerRef.current) clearTimeout(menuTimerRef.current)
      menuTimerRef.current = setTimeout(() => {
        setShowMenu(false)
      }, 5000)
    }

    document.addEventListener("touchstart", handleTap, { passive: true })
    document.addEventListener("mousedown", handleTap)

    return () => {
      clearTimeout(enableTimer)
      document.removeEventListener("touchstart", handleTap)
      document.removeEventListener("mousedown", handleTap)
      if (menuTimerRef.current) clearTimeout(menuTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const idx = SLIDE_ORDER_MAP[path]
    if (idx !== undefined && idx !== activeIndex) {
      setPrevIndex(activeIndex)
      setActiveIndex(idx)
      setIsTransitioning(true)
    }
  }, [path, activeIndex])

  const handleTransitionEnd = useCallback(() => {
    setIsTransitioning(false)
    setPrevIndex(null)
  }, [])

  const isSkipTransition =
    isTransitioning &&
    prevIndex !== null &&
    Math.abs(activeIndex - prevIndex) === 2

  const getSlideStyle = (index) => {
    const isActive = index === activeIndex

    const translateX = (index - activeIndex) * 100

    return {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      overflow: "hidden",
      transform: `translate3d(${translateX}%, 0, 0)`,
      transition: isTransitioning
        ? "transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
        : "none",
      willChange: "transform",
      backfaceVisibility: "hidden",
      WebkitBackfaceVisibility: "hidden",
      transformStyle: "preserve-3d",
      contain: "layout paint size style",
      zIndex: isActive ? 3 : index === prevIndex ? 2 : 1,
      pointerEvents: isActive ? "auto" : "none",
      isolation: "isolate",
    }
  }

  const getInnerStyle = (index) => {
    const isMiddleSkip =
      isSkipTransition &&
      index === 1 &&
      activeIndex !== 1 &&
      prevIndex !== 1

    return {
      width: "100%",
      height: "100%",
      overflow: "hidden",
      filter: isMiddleSkip ? "blur(8px)" : "none",
      opacity: isMiddleSkip ? 0.7 : 1,
      transition: isTransitioning
        ? "filter 0.45s ease, opacity 0.45s ease"
        : "none",
      backfaceVisibility: "hidden",
      WebkitBackfaceVisibility: "hidden",
      transform: "translateZ(0)",
    }
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100dvh",
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      <div
        style={getSlideStyle(0)}
        onTransitionEnd={activeIndex === 0 ? handleTransitionEnd : undefined}
      >
        <div style={getInnerStyle(0)}>
          <Albums />
        </div>
      </div>

      <div
        style={getSlideStyle(1)}
        onTransitionEnd={activeIndex === 1 ? handleTransitionEnd : undefined}
      >
        <div style={getInnerStyle(1)}>
          <Sona />
        </div>
      </div>

      <div
        style={getSlideStyle(2)}
        onTransitionEnd={activeIndex === 2 ? handleTransitionEnd : undefined}
      >
        <div style={getInnerStyle(2)}>
          <Queue />
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          zIndex: 50,
        }}
      >
        <MenuBottomComponent visible={showMenu} />
      </div>
    </div>
  )
}

function AutoRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem("token")
    const provider = localStorage.getItem("musicProvider")
    const accessMode = getAccessMode()

    if (accessMode === ACCESS_MODE_FREE) {
      enableFreeAccess()
      navigate("/sona", { replace: true })
    } else if (token && provider) {
      enablePaidAccess()
      navigate("/sona", { replace: true })
    } else if (token && !provider) {
      enablePaidAccess()
      navigate("/home", { replace: true })
    }
  }, [navigate])

  const token = localStorage.getItem("token")
  const accessMode = getAccessMode()
  if (token || accessMode === ACCESS_MODE_FREE) return null

  return <Landing />
}

function AppRoutes() {
  const location = useLocation()
  const legacyFreeRoute = LEGACY_FREE_ROUTE_REDIRECTS[location.pathname]
  const isSonaRoute = SONA_ROUTES.includes(location.pathname)

  useEffect(() => {
    if (PORTRAIT_LOCKED_ROUTES.includes(location.pathname)) {
      lockPortraitOrientation()
      return
    }

    unlockOrientation()
  }, [location.pathname])

  if (legacyFreeRoute) {
    return <FreeRouteRedirect to={legacyFreeRoute} />
  }

  if (isSonaRoute) {
    return (
      <SonaAccessRoute>
        <SonaCarousel />
      </SonaAccessRoute>
    )
  }

  return (
    <Routes location={location}>
      <Route path="/" element={<AutoRedirect />} />
      <Route
        path="/register"
        element={
          <AuthRoute>
            <Register />
          </AuthRoute>
        }
      />
      <Route
        path="/login"
        element={
          <AuthRoute>
            <Login />
          </AuthRoute>
        }
      />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function useHeartbeat() {
  useEffect(() => {
    const sendHeartbeat = () => {
      const token = localStorage.getItem("token")
      if (!token) return

      fetch(`${API_BASE}/api/heartbeat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }).catch(() => {})
    }

    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])
}

function App() {
  useHeartbeat()
  return (
    <BrowserRouter>
      <div style={{ width: "100%", height: "100dvh", overflow: "hidden" }}>
        <Toaster
          position="top-center"
          options={{
            fill: "#171717",
            roundness: 16,
            zIndex: 9999,
            styles: {
              title: "text-white!",
              description: "text-white/75!",
              badge: "bg-white/10!",
              button: "bg-white/10! hover:bg-white/15!",
            },
          }}
        />
        <AppRoutes />
      </div>
    </BrowserRouter>
  )
}

export default App
