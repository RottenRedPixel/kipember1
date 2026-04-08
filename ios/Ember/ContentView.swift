import SwiftUI

@MainActor
struct ContentView: View {
    private let configResult = AppConfig.load()

    var body: some View {
        switch configResult {
        case .success(let config):
            ConfiguredNativeAppView(config: config)
        case .failure(let message):
            MissingConfigurationView(message: message)
        }
    }
}

@MainActor
private struct ConfiguredNativeAppView: View {
    @State private var session: AppSession

    init(config: AppConfig) {
        _session = State(initialValue: AppSession(config: config))
    }

    var body: some View {
        Group {
            switch session.phase {
            case .bootstrapping:
                LaunchStateView()
            case .signedOut:
                AuthView()
            case .signedIn:
                AppShellView()
            }
        }
        .environment(session)
        .task {
            await session.bootstrapIfNeeded()
        }
    }
}

private struct LaunchStateView: View {
    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
                .tint(EmberPalette.primary)

            Text("Loading Ember...")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(EmberPalette.body)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(EmberPalette.surface.ignoresSafeArea())
    }
}

private struct MissingConfigurationView: View {
    let message: String

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Ember iPhone")
                .font(.system(size: 12, weight: .bold))
                .textCase(.uppercase)
                .kerning(1.4)
                .foregroundStyle(EmberPalette.primary)

            Text("Set the site URL first")
                .font(.system(size: 32, weight: .heavy))
                .foregroundStyle(EmberPalette.title)

            Text(message)
                .font(.system(size: 16, weight: .medium))
                .lineSpacing(8)
                .foregroundStyle(EmberPalette.body)

            Text("EMBER_APP_URL=https://your-ember-domain.com")
                .font(.system(.footnote, design: .monospaced).weight(.semibold))
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.white)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .foregroundStyle(EmberPalette.title)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        .padding(.horizontal, 24)
        .background(EmberPalette.surface.ignoresSafeArea())
    }
}
