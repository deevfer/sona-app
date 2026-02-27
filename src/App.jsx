import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { ProtectedRoute, AuthRoute } from "./ProtectedRoutes"
import Landing from "./pages/Landing"
import Register from "./pages/Register"
import Login from "./pages/Login"
import Home from "./pages/Home"
import Sona from "./pages/Sona"

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
     <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Landing /></PageTransition>} />

        <Route
          path="/register"
          element={
            <PageTransition>
              <AuthRoute>
                <Register />
              </AuthRoute>
            </PageTransition>
          }
        />

        <Route
          path="/login"
          element={
            <PageTransition>
              <AuthRoute>
                <Login />
              </AuthRoute>
            </PageTransition>
          }
        />

        <Route
          path="/home"
          element={
            <PageTransition>
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            </PageTransition>
          }
        />
        <Route
          path="/sona"
          element={
            <PageTransition>
              <ProtectedRoute>
                <Sona />
              </ProtectedRoute>
            </PageTransition>
          }
        />
      </Routes>
    </AnimatePresence>
  )
}

function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -100, opacity: 0 }}
      transition={{
        type: "spring",
        stiffness: 120,
        damping: 20
      }}
      style={{
        width: "100%",
        minHeight: "100vh"
      }}
    >
      {children}
    </motion.div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div style={{ position: "relative", overflow: "hidden" }}>
        <AnimatedRoutes />
      </div>
    </BrowserRouter>
  )
}

export default App