import SwiftUI
import WebKit

struct ContentView: View {
    // Production URL matching capacitor.config.ts
    private let appURL = URL(string: "https://phola-beta.vercel.app")!
    @State private var isLoading = true
    @State private var loadError: String? = nil
    @State private var reloadTrigger = UUID()

    var body: some View {
        ZStack {
            // Match Phola web background so there is never a stuck dark-green screen
            Color.white
                .ignoresSafeArea()

            PholaWebView(
                url: appURL,
                isLoading: $isLoading,
                loadError: $loadError,
                reloadTrigger: reloadTrigger
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .ignoresSafeArea(.container, edges: .bottom)

            if isLoading {
                VStack(spacing: 14) {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: Color(red: 13/255.0, green: 110/255.0, blue: 110/255.0)))
                        .scaleEffect(1.35)
                    Text("Connecting to Phola...")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(Color(red: 15/255.0, green: 23/255.0, blue: 42/255.0))
                    Text("Phola Emergency Network")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.gray)
                }
                .padding(24)
                .background(Color.white.opacity(0.95))
                .cornerRadius(20)
                .shadow(color: Color.black.opacity(0.08), radius: 12, x: 0, y: 4)
            }

            if let errorMsg = loadError {
                VStack(spacing: 16) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.system(size: 38, weight: .bold))
                        .foregroundColor(Color(red: 13/255.0, green: 110/255.0, blue: 110/255.0))
                    Text("Unable to reach Phola")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.black)
                    Text(errorMsg)
                        .font(.system(size: 13))
                        .foregroundColor(.gray)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                    Button(action: {
                        loadError = nil
                        isLoading = true
                        reloadTrigger = UUID()
                    }) {
                        Text("Retry Connection")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 24)
                            .padding(.vertical, 12)
                            .background(Color(red: 13/255.0, green: 110/255.0, blue: 110/255.0))
                            .cornerRadius(12)
                    }
                }
                .padding(28)
                .background(Color.white)
                .cornerRadius(24)
                .shadow(color: Color.black.opacity(0.12), radius: 16, x: 0, y: 6)
                .padding(24)
            }
        }
    }
}

struct PholaWebView: UIViewRepresentable {
    let url: URL
    @Binding var isLoading: Bool
    @Binding var loadError: String?
    let reloadTrigger: UUID

    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var parent: PholaWebView
        var lastTrigger: UUID

        init(_ parent: PholaWebView) {
            self.parent = parent
            self.lastTrigger = parent.reloadTrigger
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.parent.loadError = nil
            }
        }

        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.parent.isLoading = false
                self.parent.loadError = nil
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.parent.isLoading = false
                self.parent.loadError = nil
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            let nsErr = error as NSError
            if nsErr.code == NSURLErrorCancelled { return }
            DispatchQueue.main.async {
                self.parent.isLoading = false
                self.parent.loadError = error.localizedDescription
            }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            let nsErr = error as NSError
            if nsErr.code == NSURLErrorCancelled { return }
            DispatchQueue.main.async {
                self.parent.isLoading = false
                self.parent.loadError = error.localizedDescription
            }
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            webView.reload()
        }

        // Handle target="_blank" / window.open (e.g., WhatsApp, Uber, Bolt, tel:, mailto:, sms:)
        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if let targetURL = navigationAction.request.url {
                let scheme = (targetURL.scheme ?? "").lowercased()
                if scheme != "http" && scheme != "https" {
                    UIApplication.shared.open(targetURL, options: [:], completionHandler: nil)
                    return nil
                }
                if navigationAction.targetFrame == nil {
                    UIApplication.shared.open(targetURL, options: [:], completionHandler: nil)
                    return nil
                }
            }
            return nil
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            if let targetURL = navigationAction.request.url,
               let scheme = targetURL.scheme?.lowercased(),
               ["tel", "sms", "mailto", "whatsapp", "uber", "bolt"].contains(scheme) {
                UIApplication.shared.open(targetURL, options: [:], completionHandler: nil)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.websiteDataStore = .default()

        let webView = WKWebView(frame: UIScreen.main.bounds, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.isOpaque = true
        webView.backgroundColor = .white
        webView.scrollView.backgroundColor = .white

        // Attach webView to background location service so native updates stream into JS
        LocationService.shared.webView = webView

        let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
        webView.load(request)
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        LocationService.shared.webView = uiView
        if context.coordinator.lastTrigger != reloadTrigger {
            context.coordinator.lastTrigger = reloadTrigger
            let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
            uiView.load(request)
        }
    }
}
