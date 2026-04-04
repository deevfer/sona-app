import Foundation
import Capacitor
import MusicKit
import StoreKit

@objc(AppleMusicAuthPlugin)
public class AppleMusicAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleMusicAuthPlugin"
    public let jsName = "AppleMusicAuthPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise)
    ]

    @objc func status(_ call: CAPPluginCall) {
        let status = MusicAuthorization.currentStatus

        call.resolve([
            "status": mapStatus(status),
            "authorized": status == .authorized
        ])
    }

    @objc func connect(_ call: CAPPluginCall) {
        guard let developerToken = call.getString("developerToken"),
              !developerToken.isEmpty else {
            call.reject("Missing developerToken")
            return
        }

        Task {
            let authStatus = await MusicAuthorization.request()

            guard authStatus == .authorized else {
                call.reject("Apple Music authorization denied")
                return
            }

            let controller = SKCloudServiceController()

            controller.requestUserToken(forDeveloperToken: developerToken) { token, error in
                if let error = error {
                    call.reject("Failed to get Music User Token: \(error.localizedDescription)")
                    return
                }

                guard let token = token, !token.isEmpty else {
                    call.reject("Music User Token not found")
                    return
                }

                call.resolve([
                    "authorized": true,
                    "status": self.mapStatus(authStatus),
                    "musicUserToken": token
                ])
            }
        }
    }

    private func mapStatus(_ status: MusicAuthorization.Status) -> String {
        switch status {
        case .authorized:
            return "authorized"
        case .denied:
            return "denied"
        case .restricted:
            return "restricted"
        case .notDetermined:
            return "notDetermined"
        @unknown default:
            return "unknown"
        }
    }
}