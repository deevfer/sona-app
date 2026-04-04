import Foundation
import Capacitor
import MediaPlayer
import MusicKit

@objc(AppleMusicPlaybackPlugin)
public class AppleMusicPlaybackPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleMusicPlaybackPlugin"
    public let jsName = "AppleMusicPlaybackPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getNowPlaying", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setQueueAndPlay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "next", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "previous", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setQueueOnly", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "changeToIndex", returnType: CAPPluginReturnPromise),
    ]

    private let player = MPMusicPlayerController.applicationQueuePlayer

    @objc func getNowPlaying(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(self.buildNowPlayingPayload())
        }
    }

    @objc func setQueueAndPlay(_ call: CAPPluginCall) {
        guard let entries = call.getArray("entries", JSObject.self), !entries.isEmpty else {
            call.reject("Missing entries")
            return
        }

        let requestedIndex = max(0, call.getInt("index") ?? 0)

        let ids = entries.compactMap { entry -> String? in
            return entry["id"] as? String
        }

        guard !ids.isEmpty else {
            call.reject("No playable ids found")
            return
        }

        let safeIndex = min(requestedIndex, ids.count - 1)
        let orderedIds = Array(ids[safeIndex...]) + Array(ids[..<safeIndex])

        DispatchQueue.main.async {
            let descriptor = MPMusicPlayerStoreQueueDescriptor(storeIDs: orderedIds)
            self.player.setQueue(with: descriptor)

            self.player.prepareToPlay { error in
                if let error = error {
                    call.reject("Failed to prepare queue: \(error.localizedDescription)")
                    return
                }

                let previousId = self.player.nowPlayingItem?.playbackStoreID ?? ""

                self.player.play()

                self.waitForTrackChange(
                    previousId: previousId,
                    timeout: 2.5
                ) { payload in
                    let hasTrack = self.player.nowPlayingItem != nil
                    let isPlaying = self.player.playbackState == .playing

                    if !hasTrack && !isPlaying {
                        call.reject("Failed to prepare queue: The operation couldn't be completed. (MPMusicPlayerControllerErrorDomain error 6.)")
                        return
                    }

                    call.resolve(payload)
                }
            }
        }
    }

    @objc func play(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let previousId = self.player.nowPlayingItem?.playbackStoreID ?? ""

            self.player.play()

            self.waitForPlaybackOrTrack(
                previousId: previousId,
                timeout: 1.8
            ) { payload in
                call.resolve(payload)
            }
        }
    }

    @objc func pause(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.player.pause()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                call.resolve(self.buildNowPlayingPayload())
            }
        }
    }

    @objc func next(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let previousId = self.player.nowPlayingItem?.playbackStoreID ?? ""

            self.player.skipToNextItem()

            self.waitForTrackChange(
                previousId: previousId,
                timeout: 2.2
            ) { payload in
                call.resolve(payload)
            }
        }
    }

    @objc func previous(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let previousId = self.player.nowPlayingItem?.playbackStoreID ?? ""

            self.player.skipToPreviousItem()

            self.waitForTrackChange(
                previousId: previousId,
                timeout: 2.2
            ) { payload in
                call.resolve(payload)
            }
        }
    }

    private func waitForTrackChange(
        previousId: String,
        timeout: TimeInterval,
        completion: @escaping ([String: Any]) -> Void
    ) {
        let start = Date()

        func poll() {
            let currentId = self.player.nowPlayingItem?.playbackStoreID ?? ""
            let hasTrack = self.player.nowPlayingItem != nil

            if hasTrack && currentId != previousId {
                completion(self.buildNowPlayingPayload())
                return
            }

            if Date().timeIntervalSince(start) >= timeout {
                completion(self.buildNowPlayingPayload())
                return
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
                poll()
            }
        }

        poll()
    }

    private func waitForPlaybackOrTrack(
        previousId: String,
        timeout: TimeInterval,
        completion: @escaping ([String: Any]) -> Void
    ) {
        let start = Date()

        func poll() {
            let payload = self.buildNowPlayingPayload()
            let currentId = self.player.nowPlayingItem?.playbackStoreID ?? ""
            let playing = self.player.playbackState == .playing

            if playing || currentId != previousId {
                completion(payload)
                return
            }

            if Date().timeIntervalSince(start) >= timeout {
                completion(payload)
                return
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
                poll()
            }
        }

        poll()
    }

    private func buildNowPlayingPayload() -> [String: Any] {
        let item = player.nowPlayingItem
        let isPlaying = player.playbackState == .playing
        let progressMs = Int(player.currentPlaybackTime * 1000)
        
        guard let item = item else {
            return [
                "is_playing": isPlaying,
                "progress_ms": progressMs
            ]
        }

        var artworkString = ""

        if let artwork = item.artwork {
            let sizes: [CGSize] = [
                CGSize(width: 300, height: 300),
                CGSize(width: 200, height: 200),
                CGSize(width: 100, height: 100),
            ]

            for size in sizes {
                if let image = artwork.image(at: size),
                let data = image.jpegData(compressionQuality: 0.75) {
                    artworkString = "data:image/jpeg;base64," + data.base64EncodedString()
                    break
                }
            }
        }

        return [
            "is_playing": isPlaying,
            "progress_ms": progressMs,
            "track": [
                "id": item.playbackStoreID,
                "name": item.title ?? "",
                "artists": [item.artist ?? ""].filter { !$0.isEmpty },
                "album": item.albumTitle ?? "",
                "image": artworkString,
                "duration_ms": Int(item.playbackDuration * 1000),
                "storeId": item.playbackStoreID
            ]
        ]
    }

    @objc func setQueueOnly(_ call: CAPPluginCall) {
        guard let entries = call.getArray("entries", JSObject.self), !entries.isEmpty else {
            call.reject("Missing entries")
            return
        }

        let requestedIndex = max(0, call.getInt("index") ?? 0)

        let ids = entries.compactMap { entry -> String? in
            return entry["id"] as? String
        }

        guard !ids.isEmpty else {
            call.reject("No playable ids found")
            return
        }

        let safeIndex = min(requestedIndex, ids.count - 1)
        let orderedIds = Array(ids[safeIndex...]) + Array(ids[..<safeIndex])

        DispatchQueue.main.async {
            let descriptor = MPMusicPlayerStoreQueueDescriptor(storeIDs: orderedIds)
            self.player.setQueue(with: descriptor)

            self.player.prepareToPlay { error in
                if let error = error {
                    call.reject("Failed to prepare queue: \(error.localizedDescription)")
                    return
                }

                self.player.pause()

                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                    call.resolve(self.buildNowPlayingPayload())
                }
            }
        }
    }
    @objc func changeToIndex(_ call: CAPPluginCall) {
        guard let trackIds = call.getArray("trackIds", String.self), !trackIds.isEmpty else {
            call.reject("Missing trackIds")
            return
        }

        let requestedIndex = max(0, call.getInt("index") ?? 0)
        let safeIndex = min(requestedIndex, trackIds.count - 1)
        let reorderedIds = Array(trackIds[safeIndex...]) + Array(trackIds[..<safeIndex])

        DispatchQueue.main.async {
            let descriptor = MPMusicPlayerStoreQueueDescriptor(storeIDs: reorderedIds)
            self.player.setQueue(with: descriptor)

            self.player.prepareToPlay { error in
                if let error = error {
                    call.reject("Failed to change index: \(error.localizedDescription)")
                    return
                }

                self.player.play()

                self.waitForTrackChange(
                    previousId: self.player.nowPlayingItem?.playbackStoreID ?? "",
                    timeout: 2.2
                ) { payload in
                    call.resolve(payload)
                }
            }
        }
    }
}