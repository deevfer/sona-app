import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'
import "./i18n"
import { Capacitor } from "@capacitor/core"
import { StatusBar } from "@capacitor/status-bar"

if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
  StatusBar.hide().catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)