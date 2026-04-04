import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        setNeedsUpdateOfHomeIndicatorAutoHidden()

        bridge?.registerPluginInstance(StoreKitPlugin())
        bridge?.registerPluginInstance(AppleMusicAuthPlugin())
        bridge?.registerPluginInstance(AppleMusicPlaybackPlugin())
        bridge?.registerPluginInstance(MediaListenerPlugin())
    }
}