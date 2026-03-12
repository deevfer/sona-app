import { useState, useEffect, useCallback, useRef } from "react"

const API_BASE = import.meta.env.VITE_API_BASE

export function useProvider() {
  const [provider, setProvider] = useState("")
  const [ready, setReady] = useState(false)
  const musicInstanceRef = useRef(null)

  useEffect(() => {
    const resolve = async () => {
      const token = localStorage.getItem("token")
      const saved = localStorage.getItem("musicProvider")
      const appleLocal = localStorage.getItem("appleMusicConnected") === "true"

      if (!token) {
        setProvider("")
        setReady(true)
        return
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      }

      // -----------------------------
      // 1. Si explícitamente el provider es apple_music,
      //    SOLO validar Apple Music
      // -----------------------------
      if (saved === "apple_music") {
        try {
          const res = await fetch(`${API_BASE}/api/apple-music/status`, {
            headers,
          })

          if (res.ok) {
            const data = await res.json()
            if (data.connected) {
              setProvider("apple_music")
              setReady(true)
              return
            }
          }
        } catch {}

        // fallback local solo para Apple Music
        if (appleLocal) {
          setProvider("apple_music")
          setReady(true)
          return
        }

        localStorage.removeItem("musicProvider")
        setProvider("")
        setReady(true)
        return
      }

      // -----------------------------
      // 2. Si explícitamente el provider es spotify,
      //    SOLO validar Spotify
      // -----------------------------
      if (saved === "spotify") {
        try {
          const res = await fetch(`${API_BASE}/api/spotify/status`, {
            headers,
          })

          if (res.ok) {
            const data = await res.json()
            if (data.connected) {
              setProvider("spotify")
              setReady(true)
              return
            }
          }
        } catch {}

        localStorage.removeItem("musicProvider")
        setProvider("")
        setReady(true)
        return
      }

      // -----------------------------
      // 3. Si no hay provider guardado,
      //    priorizar Apple Music si viene de una sesión Apple
      // -----------------------------
      if (appleLocal) {
        try {
          const res = await fetch(`${API_BASE}/api/apple-music/status`, {
            headers,
          })

          if (res.ok) {
            const data = await res.json()
            if (data.connected) {
              setProvider("apple_music")
              localStorage.setItem("musicProvider", "apple_music")
              setReady(true)
              return
            }
          }
        } catch {}

        setProvider("apple_music")
        localStorage.setItem("musicProvider", "apple_music")
        setReady(true)
        return
      }

      // -----------------------------
      // 4. Si no hay nada definido, intenta Apple primero
      // -----------------------------
      try {
        const appleRes = await fetch(`${API_BASE}/api/apple-music/status`, {
          headers,
        })

        if (appleRes.ok) {
          const data = await appleRes.json()
          if (data.connected) {
            setProvider("apple_music")
            localStorage.setItem("musicProvider", "apple_music")
            setReady(true)
            return
          }
        }
      } catch {}

      // -----------------------------
      // 5. Luego Spotify
      // -----------------------------
      try {
        const spotifyRes = await fetch(`${API_BASE}/api/spotify/status`, {
          headers,
        })

        if (spotifyRes.ok) {
          const data = await spotifyRes.json()
          if (data.connected) {
            setProvider("spotify")
            localStorage.setItem("musicProvider", "spotify")
            setReady(true)
            return
          }
        }
      } catch {}

      setProvider("")
      setReady(true)
    }

    resolve()
  }, [])

  // --- Apple Music helpers ---

  const fetchAppleDeveloperToken = useCallback(async () => {
    const token = localStorage.getItem("token")
    if (!token) throw new Error("No hay token")

    const res = await fetch(`${API_BASE}/api/apple-music/token`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.token) throw new Error("No developer token")

    return data.token
  }, [])

  const waitForMusicKit = useCallback(
    () =>
      new Promise((resolve, reject) => {
        if (window.MusicKit && typeof window.MusicKit.configure === "function") {
          resolve(window.MusicKit)
          return
        }

        const timeout = setTimeout(() => {
          reject(new Error("MusicKit timeout"))
        }, 8000)

        window.addEventListener(
          "musickitloaded",
          () => {
            clearTimeout(timeout)
            if (window.MusicKit) resolve(window.MusicKit)
            else reject(new Error("MusicKit no disponible"))
          },
          { once: true }
        )
      }),
    []
  )

  const getMusicInstance = useCallback(async () => {
    if (provider !== "apple_music") return null
    if (musicInstanceRef.current) return musicInstanceRef.current

    const MusicKit = await waitForMusicKit()
    let music = null

    try {
      music = MusicKit.getInstance()
    } catch {}

    if (!music) {
      const devToken = await fetchAppleDeveloperToken()
      MusicKit.configure({
        developerToken: devToken,
        app: { name: "Sona", build: "1.0.0" },
      })

      await new Promise((r) => setTimeout(r, 350))

      try {
        music = MusicKit.getInstance()
      } catch {}
    }

    if (!music) throw new Error("No se pudo inicializar Apple Music")

    musicInstanceRef.current = music
    return music
  }, [provider, waitForMusicKit, fetchAppleDeveloperToken])

  const resolveAppleArtwork = useCallback((artwork, w = 600, h = 600) => {
    if (!artwork?.url) return "/sonaDefault.png"
    return artwork.url
      .replace("{w}", w)
      .replace("{h}", h)
      .replace("{f}", "jpg")
  }, [])

  return {
    provider,
    ready,
    isSpotify: provider === "spotify",
    isAppleMusic: provider === "apple_music",
    getMusicInstance,
    resolveAppleArtwork,
  }
}