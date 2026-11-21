import SwiftUI

@main
struct PholaApp: App {
    init() {
        // Start always-on background location tracking immediately on launch
        LocationService.shared.start()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
