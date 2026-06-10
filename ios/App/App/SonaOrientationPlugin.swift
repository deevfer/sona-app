import Foundation
import Capacitor
import UIKit

@objc(SonaOrientationPlugin)
public class SonaOrientationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SonaOrientationPlugin"
    public let jsName = "SonaOrientationPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "lockPortrait", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unlock", returnType: CAPPluginReturnPromise)
    ]

    static var orientationMask: UIInterfaceOrientationMask = .allButUpsideDown

    @objc func lockPortrait(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            SonaOrientationPlugin.orientationMask = .portrait
            self.refreshOrientation()
            call.resolve()
        }
    }

    @objc func unlock(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            SonaOrientationPlugin.orientationMask = .allButUpsideDown
            self.refreshOrientation()
            call.resolve()
        }
    }

    private func refreshOrientation() {
        if #available(iOS 16.0, *) {
            bridge?.viewController?.setNeedsUpdateOfSupportedInterfaceOrientations()

            bridge?.viewController?.view.window?.windowScene?.requestGeometryUpdate(
                .iOS(interfaceOrientations: SonaOrientationPlugin.orientationMask)
            ) { error in
                print("SonaOrientationPlugin geometry update failed: \(error.localizedDescription)")
            }
        }

        UIViewController.attemptRotationToDeviceOrientation()
    }
}
