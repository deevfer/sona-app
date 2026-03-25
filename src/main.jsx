// import React from 'react'
// import ReactDOM from 'react-dom/client'
// import App from './App'
// import './styles/global.css'
// import "./i18n"

// ReactDOM.createRoot(document.getElementById('root')).render(
//   <React.StrictMode>
//     <App />
//   </React.StrictMode>,
// )

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'
import './i18n'
import { Capacitor } from '@capacitor/core'
import { StatusBar } from '@capacitor/status-bar'
import OneSignal from 'onesignal-cordova-plugin'

const ONESIGNAL_APP_ID = 'dc5a6944-c909-4cf5-92c5-85ba7926af18'

if (Capacitor.isNativePlatform()) {
  StatusBar.hide().catch(() => {})
}

if (Capacitor.isNativePlatform()) {
  OneSignal.Debug.setLogLevel(6)
  OneSignal.initialize(ONESIGNAL_APP_ID)

  OneSignal.Notifications.requestPermission(false).then((accepted) => {
    console.log('User accepted notifications:', accepted)
  })

  OneSignal.User.pushSubscription.addEventListener('change', (event) => {
    console.log('OneSignal push subscription changed:', event)
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)