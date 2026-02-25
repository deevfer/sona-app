import '../styles/Register.css'
import { useNavigate } from "react-router-dom"
import BackIcon from "../assets/back.svg?react"
import { useEffect, useRef, useState } from "react";

function Register() {
  const navigate = useNavigate();
  const paypalRef = useRef();

  // Estado del formulario
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    password_confirmation: ""
  });

  // Ref para tener siempre la data más reciente dentro de onApprove
  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Montar PayPal Buttons
  useEffect(() => {
    if (!window.paypal || !paypalRef.current) return;

    // Limpiar HTML previo
    paypalRef.current.innerHTML = "";

    const buttons = window.paypal.Buttons({
      createOrder: (data, actions) => {
        return actions.order.create({
          purchase_units: [{ amount: { value: "1.99" } }]
        });
      },

      onApprove: async (data, actions) => {
        try {
          const order = await actions.order.capture();

          if (order.status === "COMPLETED") {
            const response = await fetch("http://127.0.0.1:8000/api/register-with-payment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
              },
              body: JSON.stringify({
                ...formDataRef.current, // se obtienen siempre los datos más recientes
                orderID: data.orderID,
                paypalDetails: order
              })
            });

            const result = await response.json();
            console.log(result);

            if (!result.errors) navigate("/login");
          }
        } catch (error) {
          console.error("Error al procesar el pago:", error);
          alert("Ocurrió un error al procesar el pago. Intenta de nuevo.");
        }
      },

      onError: (err) => {
        console.error("PayPal error:", err);
        alert("Ocurrió un error con PayPal. Intenta de nuevo.");
      }
    });

    buttons.render(paypalRef.current);

    return () => {
      buttons.close();
    };
  }, []);

  return (
    <div className="login">
      <div className="container">
        <div className="backButton">
          <button onClick={() => navigate("/login")}>
            <BackIcon />
          </button>
        </div>

        <div className="loginForm">
          <h1>Crear una cuenta</h1>
          <span>Completa tus datos para crear tu cuenta y comenzar a disfrutar la experiencia completa de Sona.</span>
          <form className="material-form" onSubmit={(e) => e.preventDefault()}>
          <div className="input-field">
            <input
                type="text"
                required
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <label>Nombre</label>
            </div>
            <div className="input-field">
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <label>Email</label>
            </div>

            <div className="input-field">
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <label>Password</label>
            </div>

            <span className="price">
              Pago único de USD 1.99 para acceso de por vida.
            </span>

            <div ref={paypalRef}></div>

            <div className="alreadyHave">
              <p>¿Ya tienes cuenta? <button type="button" onClick={() => navigate("/login")}>Inicia sesión</button></p>
            </div>
          </form>
        </div>
      </div>

      <div className="vinylBottom">
        <div className="leftVinyl"><img src="/leftVinyl.svg" alt="" /></div>
        <div className="centerVinyl"><img src="/centerVinyl.svg" alt="" /></div>
        <div className="rightVinyl"><img src="/rightVinyl.svg" alt="" /></div>
      </div>
    </div>
  );
}

export default Register;