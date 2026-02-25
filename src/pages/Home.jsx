import { useState } from "react"
import { useNavigate } from "react-router-dom"
import '../styles/Home.css'

function Home() {

  const navigate = useNavigate()

  return (
    <div className="landing">
        <h1>Logeado</h1>
    </div>
  )
}

export default Home