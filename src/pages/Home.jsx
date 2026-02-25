import { useState } from "react"
import { useNavigate } from "react-router-dom"
import '../styles/Home.css'

function Home() {

  const navigate = useNavigate()

  return (
    <div className="landing">
        <div className="container">
            <div className="loginForm">
                <h1>Conecta tu música</h1>
                <span>Permite que Sona acceda a tu biblioteca para controlar la pista actual en la aplicación.</span>
                <div className="btnsConect">
                    <div className="btnPrimary">
                        <button>
                            <img src="/spotify.png" alt="" />
                            Spotify
                        </button>
                    </div>
                    <div className="btnPrimary">
                        <button>
                            <img src="/AppleMusic.png" alt="" />
                            Apple Music
                        </button>
                        <div className="comingSoon">
                            <span>Coming soon</span>
                        </div>
                    </div>
                </div>
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

export default Home