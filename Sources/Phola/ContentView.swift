import SwiftUI
import WebKit

struct ContentView: View {
    // Production URL matching capacitor.config.ts
    private let appURL = URL(string: "https://phola-beta.vercel.app")!

    var body: some View {
        ZStack {
            // Background brand color to prevent any white flash during initial connection
            Color(red: 13/255.0, green: 110/255.0, blue: 110/255.0)
                .ignoresSafeArea()

            PholaWebView(url: appURL)
                .ignoresSafeArea()
        }
    }
}

struct PholaWebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = .clear

        // Attach webView to background location service so native updates stream into JS
        LocationService.shared.webView = webView

        let request = URLRequest(url: url)
        webView.load(request)
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        LocationService.shared.webView = uiView
    }
}
