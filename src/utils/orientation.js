import { Capacitor, registerPlugin } from "@capacitor/core"

let SonaOrientationPlugin = null

if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
  SonaOrientationPlugin = registerPlugin("SonaOrientationPlugin")
}

export async function lockPortraitOrientation() {
  try {
    if (SonaOrientationPlugin) {
      await SonaOrientationPlugin.lockPortrait()
      return
    }

    await screen.orientation?.lock?.("portrait")
  } catch {
    // Some browsers only allow orientation changes in fullscreen/native contexts.
  }
}

export async function unlockOrientation() {
  try {
    if (SonaOrientationPlugin) {
      await SonaOrientationPlugin.unlock()
      return
    }

    screen.orientation?.unlock?.()
  } catch {
    // Orientation support varies by platform.
  }
}
