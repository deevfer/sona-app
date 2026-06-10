import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        SonaOrientationPlugin.orientationMask
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        webView?.backgroundColor = .black
        webView?.isOpaque = false
        setNeedsUpdateOfHomeIndicatorAutoHidden()

        bridge?.registerPluginInstance(StoreKitPlugin())
        bridge?.registerPluginInstance(AppleMusicAuthPlugin())
        bridge?.registerPluginInstance(AppleMusicPlaybackPlugin())
        bridge?.registerPluginInstance(MediaListenerPlugin())
        bridge?.registerPluginInstance(SonaOrientationPlugin())
    }
}
