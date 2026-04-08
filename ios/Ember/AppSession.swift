import Foundation
import Observation

enum AuthMode: String, CaseIterable, Identifiable {
    case login
    case signup

    var id: String { rawValue }
}

enum SessionPhase {
    case bootstrapping
    case signedOut
    case signedIn
}

@MainActor
@Observable
final class AppSession {
    let config: AppConfig
    let client: APIClient

    var phase: SessionPhase = .bootstrapping
    var authMode: AuthMode = .login
    var user: UserRecord?

    private var hasBootstrapped = false

    init(config: AppConfig) {
        self.config = config
        self.client = APIClient(config: config)
    }

    func bootstrapIfNeeded() async {
        guard !hasBootstrapped else {
            return
        }

        hasBootstrapped = true
        await refreshProfile()
    }

    func refreshProfile() async {
        phase = .bootstrapping

        do {
            user = try await client.fetchProfile()
            phase = .signedIn
        } catch let error as APIError {
            if case .unauthorized = error {
                user = nil
                phase = .signedOut
                return
            }

            user = nil
            phase = .signedOut
        } catch {
            user = nil
            phase = .signedOut
        }
    }

    func authenticate(
        mode: AuthMode,
        name: String,
        email: String,
        phoneNumber: String,
        password: String
    ) async throws {
        let authenticatedUser: UserRecord

        switch mode {
        case .login:
            authenticatedUser = try await client.login(email: email, password: password)
        case .signup:
            authenticatedUser = try await client.signup(
                name: name,
                email: email,
                phoneNumber: phoneNumber,
                password: password
            )
        }

        user = authenticatedUser
        authMode = .login
        phase = .signedIn
    }

    func updateProfile(name: String, email: String, phoneNumber: String) async throws {
        user = try await client.updateProfile(name: name, email: email, phoneNumber: phoneNumber)
    }

    func logout() async {
        do {
            try await client.logout()
        } catch {
            // Server-side cleanup is best-effort here; the app should still return to auth.
        }

        user = nil
        phase = .signedOut
    }

    func handle(error: Error) -> String {
        guard let apiError = error as? APIError else {
            return error.localizedDescription
        }

        if case .unauthorized = apiError {
            user = nil
            phase = .signedOut
        }

        return apiError.errorDescription ?? "Something went wrong."
    }
}
