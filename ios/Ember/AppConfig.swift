import Foundation

struct AppConfig {
    let url: URL
    let host: String

    private static let placeholderHosts: Set<String> = [
        "your-ember-domain.com",
        "staging.your-ember-domain.com",
        "example.com",
    ]

    static func load(from bundle: Bundle = .main) -> Result<AppConfig, String> {
        let rawValue = (bundle.object(forInfoDictionaryKey: "EmberAppURL") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        guard !rawValue.isEmpty else {
            return .failure(
                "Set EMBER_APP_URL in ios/Configurations/*.xcconfig before launching the app."
            )
        }

        let normalized = rawValue.contains("://") ? rawValue : "https://\(rawValue)"

        guard
            let url = URL(string: normalized),
            let scheme = url.scheme?.lowercased(),
            let host = url.host?.lowercased()
        else {
            return .failure(
                "EMBER_APP_URL is not a valid URL. Example: https://your-ember-domain.com"
            )
        }

        guard scheme == "http" || scheme == "https" else {
            return .failure(
                "EMBER_APP_URL must use http:// or https:// so WKWebView can load it."
            )
        }

        guard !placeholderHosts.contains(host) else {
            return .failure(
                "Replace the placeholder EMBER_APP_URL with your real Ember site before building this app."
            )
        }

        let displayHost = url.port.map { "\(host):\($0)" } ?? host

        return .success(
            AppConfig(
                url: url,
                host: displayHost
            )
        )
    }

    func apiURL(path: String) -> URL {
        let cleanedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        return url.appending(path: cleanedPath)
    }

    func uploadURL(filename: String) -> URL {
        apiURL(path: "/api/uploads/\(filename)")
    }

    func appURL(path: String) -> URL {
        apiURL(path: path)
    }

    func isInternal(_ candidate: URL) -> Bool {
        if let scheme = candidate.scheme?.lowercased(), ["about", "blob", "data"].contains(scheme) {
            return true
        }

        return Self.originKey(for: candidate) == Self.originKey(for: url)
    }

    private static func originKey(for url: URL) -> String {
        let scheme = url.scheme?.lowercased() ?? ""
        let host = url.host?.lowercased() ?? ""
        let port = url.port ?? defaultPort(for: scheme)
        return "\(scheme)://\(host):\(port)"
    }

    private static func defaultPort(for scheme: String) -> Int {
        switch scheme {
        case "http":
            return 80
        case "https":
            return 443
        default:
            return -1
        }
    }
}
