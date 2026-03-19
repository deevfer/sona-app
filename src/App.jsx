import { useState, useEffect } from "react"
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { Toaster } from "sileo"
import { ProtectedRoute, AuthRoute } from "./ProtectedRoutes"
import Landing from "./pages/Landing"
import Register from "./pages/Register"
import Login from "./pages/Login"
import Home from "./pages/Home"
import Sona from "./pages/Sona"
import Albums from "./pages/Albums"
import Queue from "./pages/Queue"
import MenuBottomComponent from "./components/MenuBottomComponent"
import SonaLogo from "./assets/sonaAnimated.svg?react"

const SONA_ROUTES = ["/sona", "/sona-albums", "/sona-queue"]

function AnimatedRoutes() {
  const location = useLocation()
  const showBottom = SONA_ROUTES.includes(location.pathname)
  const [showSplash, setShowSplash] = useState(false)

  useEffect(() => {
    setShowSplash(true)
    const timer = setTimeout(() => setShowSplash(false), 800)
    return () => clearTimeout(timer)
  }, [location.pathname])

  const isSonaRoute = SONA_ROUTES.includes(location.pathname)
  const splashBg = isSonaRoute ? "rgb(15 15 15 / 33%)" : "#0f0f0f"

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: splashBg,
            }}
          >
            <SonaLogo style={{ width: "200px", height: "auto" }} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
          <Route path="/register" element={<PageTransition><AuthRoute><Register /></AuthRoute></PageTransition>} />
          <Route path="/login" element={<PageTransition><AuthRoute><Login /></AuthRoute></PageTransition>} />
          <Route path="/home" element={<PageTransition><ProtectedRoute><Home /></ProtectedRoute></PageTransition>} />
          <Route path="/sona" element={<PageTransition><ProtectedRoute><Sona /></ProtectedRoute></PageTransition>} />
          <Route path="/sona-albums" element={<PageTransition><ProtectedRoute><Albums /></ProtectedRoute></PageTransition>} />
          <Route path="/sona-queue" element={<PageTransition><ProtectedRoute><Queue /></ProtectedRoute></PageTransition>} />
        </Routes>
      </AnimatePresence>

      {showBottom && <MenuBottomComponent />}
    </>
  )
}

function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      style={{ width: "100%", minHeight: "100vh" }}
    >
      {children}
    </motion.div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div style={{ position: "relative", overflow: "hidden" }}>
      <div id="vaul-root"></div>
        <Toaster
          position="top-center"
          options={{
            fill: "#171717",
            roundness: 16,
            styles: {
              title: "text-white!",
              description: "text-white/75!",
              badge: "bg-white/10!",
              button: "bg-white/10! hover:bg-white/15!",
            },
          }}
        />
        <AnimatedRoutes />
      </div>
    </BrowserRouter>
  )
}

export default App