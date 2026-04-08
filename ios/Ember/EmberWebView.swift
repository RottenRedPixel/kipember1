import Observation
import SwiftUI
import UIKit
import WebKit

@Observable
final class EmberWebViewModel {
    var isLoading = true
    var hasLoadError = false

    @ObservationIgnored
    private weak var webView: WKWebView?

    func attach(_ webView: WKWebView) {
        self.webView = webView
    }

    func beginNavigation() {
        isLoading = true
        hasLoadError = false
    }

    func finishNavigation() {
        isLoading = false
        webView?.scrollView.refreshControl?.endRefreshing()
    }

    func failNavigation() {
        isLoading = false
        hasLoadError = true
        webView?.scrollView.refreshControl?.endRefreshing()
    }

    func reload() {
        isLoading = true
        hasLoadError = false
        webView?.reload()
    }
}

struct EmberWebView: UIViewRepresentable {
    let config: AppConfig
    let model: EmberWebViewModel

    func makeCoordinator() -> Coordinator {
        Coordinator(config: config, model: model)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.alwaysBounceVertical = true
        webView.backgroundColor = .white
        webView.isOpaque = false

        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(
            context.coordinator,
            action: #selector(Coordinator.handlePullToRefresh(_:)),
            for: .valueChanged
        )
        webView.scrollView.refreshControl = refreshControl

        context.coordinator.webView = webView
        model.attach(webView)
        webView.load(URLRequest(url: config.url))

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.webView = webView
        model.attach(webView)
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        let config: AppConfig
        let model: EmberWebViewModel
        weak var webView: WKWebView?

        init(config: AppConfig, model: EmberWebViewModel) {
            self.config = config
            self.model = model
        }

        @objc
        func handlePullToRefresh(_ sender: UIRefreshControl) {
            webView?.reload()
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            if navigationAction.targetFrame == nil {
                if config.isInternal(url) {
                    webView.load(navigationAction.request)
                } else {
                    UIApplication.shared.open(url)
                }

                decisionHandler(.cancel)
                return
            }

            if config.isInternal(url) {
                decisionHandler(.allow)
                return
            }

            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            model.beginNavigation()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            model.finishNavigation()
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            handle(error)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            handle(error)
        }

        private func handle(_ error: Error) {
            let nsError = error as NSError

            if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
                webView?.scrollView.refreshControl?.endRefreshing()
                return
            }

            if nsError.domain == WKError.errorDomain,
               nsError.code == WKError.Code.frameLoadInterruptedByPolicyChange.rawValue {
                webView?.scrollView.refreshControl?.endRefreshing()
                return
            }

            model.failNavigation()
        }
    }
}
