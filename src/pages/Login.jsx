import '../styles/Login.css'
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import BackIcon from "../assets/back.svg?react"

function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("http://127.0.0.1:8000/api/login", { 
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()
      setLoading(false)

      if (res.ok) {
        localStorage.setItem("token", data.token)
        localStorage.setItem("user", JSON.stringify(data.user))

        navigate("/home")
      } else {
        setError(data.message || "Email o contraseña incorrectos.")
      }
    } catch (err) {
      setLoading(false)
      setError("Email o contraseña incorrectos.")
      console.error(err)
    }
  }

  return (
    <div className="login">
      <div className="container">
        <div className="backButton">
          <button onClick={() => navigate("/")}>
            <BackIcon />
          </button>
        </div>
        <div className="loginForm">
          <h1>Inicia sesión</h1>
          <span>Completa tus datos para iniciar sesión en tu cuenta y comenzar a disfrutar la experiencia completa de Sona.</span>
          <form className="material-form" onSubmit={handleSubmit}>
            <div className="input-field">
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
              <label>Email</label>
              <span className="bar"></span>
            </div>
            <div className="input-field">
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
              <label>Password</label>
              <span className="bar"></span>
            </div>

            {error && <p className="error">{error}</p>}

            <button type="submit" disabled={loading}>
              {loading ? "Cargando..." : "Iniciar"}
            </button>


            <div className="alreadyHave">
              <p>¿Todavía no tienes cuenta? <button type="button" onClick={() => navigate("/register")}>Regístrate</button></p>
            </div>
          </form>
        </div>
      </div>
      <div className="vinylBottom">
        <div className="leftVinyl">
          <img src="/leftVinyl.svg" alt="" />
        </div>
        <div className="centerVinyl">
          <img src="/centerVinyl.svg" alt="" />
        </div>
        <div className="rightVinyl">
          <img src="/rightVinyl.svg" alt="" />
        </div>
      </div>
    </div>
  )
}

export default Login