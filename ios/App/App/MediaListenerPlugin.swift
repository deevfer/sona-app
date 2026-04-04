import Foundation
import Capacitor
import MediaPlayer

@objc(MediaListenerPlugin)
public class MediaListenerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MediaListenerPlugin"
    public let jsName = "MediaListenerPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getNowPlaying", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "next", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "previous", returnType: CAPPluginReturnPromise),
    ]

    private let systemPlayer = MPMusicPlayerController.systemMusicPlayer

    override public func load() {
        systemPlayer.beginGeneratingPlaybackNotifications()
    }

    deinit {
        systemPlayer.endGeneratingPlaybackNotifications()
    }

    @objc func getNowPlaying(_ call: CAPPluginCall) {
        let item = systemPlayer.nowPlayingItem
        let state = systemPlayer.playbackState
        let isPlaying = state == .playing

        print("MediaListener: item = \(String(describing: item?.title)), state = \(state.rawValue)")

        guard let item = item else {
            call.resolve([
                "is_playing": isPlaying,
                "has_track": false
            ])
            return
        }

        let title = item.title ?? ""
        let artist = item.artist ?? ""
        let album = item.albumTitle ?? ""
        let duration = item.playbackDuration
        let elapsed = systemPlayer.currentPlaybackTime

        var artworkBase64 = ""
        if let artwork = item.artwork {
            let image = artwork.image(at: CGSize(width: 600, height: 600))
            if let data = image?.jpegData(compressionQuality: 0.6) {
                artworkBase64 = "data:image/jpeg;base64," + data.base64EncodedString()
            }
        }

        // Detectar Apple Music: systemMusicPlayer SOLO reproduce Apple Music
        let isAppleMusic = true

        call.resolve([
            "is_playing": isPlaying,
            "has_track": true,
            "is_apple_music": isAppleMusic,
            "progress_ms": Int(elapsed * 1000),
            "track": [
                "id": String(item.persistentID),
                "name": title,
                "artists": [artist],
                "album": album,
                "image": artworkBase64,
                "duration_ms": Int(duration * 1000)
            ] as [String : Any]
        ])
    }

    @objc func play(_ call: CAPPluginCall) {
        systemPlayer.play()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            call.resolve(["success": true])
        }
    }

    @objc func pause(_ call: CAPPluginCall) {
        systemPlayer.pause()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            call.resolve(["success": true])
        }
    }

    @objc func next(_ call: CAPPluginCall) {
        systemPlayer.skipToNextItem()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.getNowPlaying(call)
        }
    }

    @objc func previous(_ call: CAPPluginCall) {
        systemPlayer.skipToPreviousItem()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.getNowPlaying(call)
        }
    }
}