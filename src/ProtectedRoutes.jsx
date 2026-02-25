import { Navigate } from "react-router-dom"

export function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token") 
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return children
}

export function AuthRoute({ children }) {
  const token = localStorage.getItem("token")
  if (token) {
    return <Navigate to="/home" replace />
  }
  return children
}