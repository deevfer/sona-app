import { Capacitor, registerPlugin } from "@capacitor/core"

const isNativeIOS =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios"

let MediaListenerPlugin = null
try {
  if (isNativeIOS) {
    MediaListenerPlugin = registerPlugin("MediaListenerPlugin")
  }
} catch {}

export default MediaListenerPlugin