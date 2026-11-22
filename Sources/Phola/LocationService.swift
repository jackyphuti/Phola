import Foundation
import CoreLocation
import WebKit

@MainActor
public class LocationService: NSObject, ObservableObject, CLLocationManagerDelegate {
    public static let shared = LocationService()

    private let locationManager = CLLocationManager()
    public weak var webView: WKWebView?

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 5.0 // Update every 5 meters
        locationManager.pausesLocationUpdatesAutomatically = false

        // Guard allowsBackgroundLocationUpdates: on free Apple Developer accounts (Sideloadly),
        // Apple strips the background-location entitlement, and setting this property to true
        // without the entitlement throws an uncaught NSInternalInconsistencyException unless verified.
        if let bgModes = Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String],
           bgModes.contains("location") {
            locationManager.showsBackgroundLocationIndicator = true
        }
    }

    public func start() {
        locationManager.requestAlwaysAuthorization()
        locationManager.startUpdatingLocation()
        locationManager.startMonitoringSignificantLocationChanges()
    }

    nonisolated public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        if status == .authorizedAlways || status == .authorizedWhenInUse {
            manager.startUpdatingLocation()
            manager.startMonitoringSignificantLocationChanges()
        }
    }

    nonisolated public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        let lat = location.coordinate.latitude
        let lng = location.coordinate.longitude
        let speed = location.speed >= 0 ? "\(location.speed)" : "null"
        let heading = location.course >= 0 ? "\(location.course)" : "null"

        let js = """
        (function() {
            try {
                var payload = { lat: \(lat), lng: \(lng), speed: \(speed), heading: \(heading), ts: Date.now() };
                window.localStorage.setItem('phola_last_gps', JSON.stringify(payload));
                window.sessionStorage.setItem('phola_last_gps', JSON.stringify(payload));
                window.dispatchEvent(new CustomEvent('phola-background-location', { detail: payload }));
                window.postMessage({ type: 'PHOLA_BACKGROUND_LOCATION', data: payload }, '*');
            } catch (e) {}
        })();
        """

        Task { @MainActor in
            self.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    nonisolated public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("[Phola LocationService] Background GPS Error: \(error.localizedDescription)")
    }
}
