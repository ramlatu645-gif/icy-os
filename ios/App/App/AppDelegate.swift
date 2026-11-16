import UIKit
import WebKit

/**
 * IC App Launcher iOS/iPadOS AppDelegate & Native Bridge.
 *
 * Uses `UIApplication.shared.open(_:options:completionHandler:)` to launch
 * verified Universal Links (`https://`) and registered URL schemes declared in
 * `LSApplicationQueriesSchemes`. Never attempts to silently install third-party
 * binaries or bypass iOS App Store distribution rules.
 */
@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        return true
    }

    func openExternalUniversalLinkOrScheme(
        _ urlString: String,
        completion: @escaping (Bool, String?) -> Void
    ) {
        guard let url = URL(string: urlString),
              let scheme = url.scheme?.lowercased(),
              scheme != "javascript" && scheme != "data" && scheme != "file" else {
            completion(false, "Invalid or prohibited URL scheme.")
            return
        }

        DispatchQueue.main.async {
            if UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url, options: [:]) { success in
                    completion(success, success ? nil : "iOS declined to open the target URL.")
                }
            } else {
                completion(
                    false,
                    "Target application is not installed or scheme is not registered in LSApplicationQueriesSchemes."
                )
            }
        }
    }
}
