import { useState } from "react"
import { useNavigate } from "react-router-dom"
import '../styles/Landing.css'

function Landing() {

  const [openModal, setOpenModal] = useState(false)  
  const navigate = useNavigate()

  return (
    <div className="landing">
        <div className="contentLanding">
            <div className="contentLeft">
                <div className="titleContentLeft">
                    <h1>Redescubre tu música favorita en vinilo.</h1>
                </div>
                <div className="btnsContentLeft">
                    <div className="btnPrimary">
                        <button onClick={() => navigate("/login")}>
                            Toca para empezar
                        </button>
                    </div>
                    <div className="btnSecondary">
                        <button id="requisitos" onClick={() => setOpenModal(true)}>Ver requisitos</button>
                    </div>
                </div>
            </div>
            <div className="contentRight">
                <div className="vinylLanding">
                    <img src="/vinylLanding.svg" alt="" />
                </div>
            </div>
        </div>
        {openModal && (
          <div className="modalOverlay" onClick={() => setOpenModal(false)}>
              <div className="modalContent" onClick={(e) => e.stopPropagation()}>
                <button className="closeModal" onClick={() => setOpenModal(false)}>+</button>
                <h2>Requisitos</h2>
                <div className="requirementsContent">
                    <p>Para disfrutar de toda la experiencia de la app necesitas:</p>

                    <ul className="requirementsList">
                        <div className="lifetimeAccess">
                            <p>Pago único de <strong>USD 2.99</strong> para desbloquear acceso de por vida.</p>
                            <div className="iconRequirement">
                                <img src="/tocadiscos.png" alt="" />
                            </div>
                        </div>
                        <div className="spotifyConection">
                            <p>Cuenta <strong>Premium</strong> de tus plataformas de streaming activa.</p>
                            <div className="iconRequirement">
                                <img src="/premium.png" alt="" />
                            </div>
                        </div>
                        <div className="permission">
                            <p>Permitir acceso a tu cuenta de Spotify para sincronizar tu música.</p>
                            <div className="iconRequirement">
                                <img src="/spotify.png" alt="" />
                            </div>
                        </div>
                        <div className="appleMusic">
                            <p>Próximamente podrás conectar tu cuenta de Apple Music.</p>
                            <div className="iconRequirement">
                                <img src="/AppleMusic.png" alt="" />
                            </div>
                        </div>
                    </ul>

                    <p className="noteRequirement">La app no incluye música propia. Todo el contenido se reproduce directamente desde tu cuenta de streaming favorita.</p>
                </div>

                <div className="rights">
                    <p><strong>Sona</strong></p>
                    <p>Desarrollado por Devfer</p>
                    <span>Versión 1.0.1</span>
                </div>
                
              </div>
          </div>
        )}     
    </div>
  )
}

export default Landing