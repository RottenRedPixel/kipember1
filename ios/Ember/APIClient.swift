import Foundation
import UniformTypeIdentifiers

enum APIError: LocalizedError {
    case invalidResponse
    case unauthorized
    case server(message: String, statusCode: Int)
    case transport(message: String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "The server returned an invalid response."
        case .unauthorized:
            return "Your session expired. Please log in again."
        case .server(let message, _):
            return message
        case .transport(let message):
            return message
        }
    }
}

struct UploadAsset {
    let data: Data
    let filename: String
    let mimeType: String
}

final class APIClient {
    private let config: AppConfig
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(config: AppConfig) {
        self.config = config

        let configuration = URLSessionConfiguration.default
        configuration.httpCookieStorage = .shared
        configuration.httpShouldSetCookies = true
        configuration.httpCookieAcceptPolicy = .always
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        self.session = URLSession(configuration: configuration)
    }

    func fetchProfile() async throws -> UserRecord {
        let envelope: AuthEnvelope = try await send(path: "/api/profile")
        return envelope.user
    }

    func login(email: String, password: String) async throws -> UserRecord {
        struct Body: Encodable {
            let email: String
            let password: String
        }

        let envelope: AuthEnvelope = try await send(
            path: "/api/auth/login",
            method: "POST",
            body: try encoder.encode(Body(email: email, password: password)),
            contentType: "application/json"
        )

        return envelope.user
    }

    func signup(
        name: String?,
        email: String,
        phoneNumber: String?,
        password: String
    ) async throws -> UserRecord {
        struct Body: Encodable {
            let name: String?
            let email: String
            let phoneNumber: String?
            let password: String
        }

        let envelope: AuthEnvelope = try await send(
            path: "/api/auth/signup",
            method: "POST",
            body: try encoder.encode(
                Body(
                    name: name?.nilIfBlank,
                    email: email,
                    phoneNumber: phoneNumber?.nilIfBlank,
                    password: password
                )
            ),
            contentType: "application/json"
        )

        return envelope.user
    }

    func logout() async throws {
        let _: ServerMessage = try await send(
            path: "/api/auth/logout",
            method: "POST"
        )
    }

    func fetchFeed() async throws -> [FeedImageRecord] {
        try await send(path: "/api/images")
    }

    func fetchImage(id: String) async throws -> ImageDetailRecord {
        try await send(path: "/api/images/\(id)")
    }

    func fetchWiki(imageID: String) async throws -> WikiRecord {
        try await send(path: "/api/wiki/\(imageID)")
    }

    func generateWiki(imageID: String) async throws {
        let _: ServerMessage = try await send(
            path: "/api/wiki/\(imageID)",
            method: "POST"
        )
    }

    func updateProfile(
        name: String,
        email: String,
        phoneNumber: String
    ) async throws -> UserRecord {
        struct Body: Encodable {
            let name: String?
            let email: String
            let phoneNumber: String?
        }

        let envelope: AuthEnvelope = try await send(
            path: "/api/profile",
            method: "PATCH",
            body: try encoder.encode(
                Body(
                    name: name.nilIfBlank,
                    email: email,
                    phoneNumber: phoneNumber.nilIfBlank
                )
            ),
            contentType: "application/json"
        )

        return envelope.user
    }

    func uploadMedia(asset: UploadAsset, description: String?) async throws -> UploadResult {
        let boundary = "Boundary-\(UUID().uuidString)"
        let body = MultipartFormData(boundary: boundary)
            .addingTextField(named: "description", value: description?.nilIfBlank)
            .addingFileField(
                named: "file",
                filename: asset.filename,
                mimeType: asset.mimeType,
                data: asset.data
            )
            .encoded()

        return try await send(
            path: "/api/images",
            method: "POST",
            body: body,
            contentType: "multipart/form-data; boundary=\(boundary)"
        )
    }

    private func send<T: Decodable>(
        path: String,
        method: String = "GET",
        body: Data? = nil,
        contentType: String? = nil
    ) async throws -> T {
        var request = URLRequest(url: config.apiURL(path: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = body
        request.httpShouldHandleCookies = true

        if let contentType {
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        }

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }

            guard 200 ..< 300 ~= httpResponse.statusCode else {
                if httpResponse.statusCode == 401 {
                    throw APIError.unauthorized
                }

                let serverMessage = try? decoder.decode(ServerMessage.self, from: data)
                throw APIError.server(
                    message: serverMessage?.error ?? "Request failed.",
                    statusCode: httpResponse.statusCode
                )
            }

            if T.self == ServerMessage.self, data.isEmpty {
                return ServerMessage(error: nil, success: true) as! T
            }

            return try decoder.decode(T.self, from: data)
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.transport(message: error.localizedDescription)
        }
    }
}

private struct MultipartFormData {
    let boundary: String
    private var parts: [Data] = []

    init(boundary: String) {
        self.boundary = boundary
    }

    func addingTextField(named name: String, value: String?) -> MultipartFormData {
        guard let value else {
            return self
        }

        var next = self
        next.parts.append(
            """
            --\(boundary)\r
            Content-Disposition: form-data; name="\(name)"\r
            \r
            \(value)\r
            """.data(using: .utf8) ?? Data()
        )
        return next
    }

    func addingFileField(
        named name: String,
        filename: String,
        mimeType: String,
        data: Data
    ) -> MultipartFormData {
        var next = self
        next.parts.append(
            """
            --\(boundary)\r
            Content-Disposition: form-data; name="\(name)"; filename="\(filename)"\r
            Content-Type: \(mimeType)\r
            \r
            """.data(using: .utf8) ?? Data()
        )
        next.parts.append(data)
        next.parts.append("\r\n".data(using: .utf8) ?? Data())
        return next
    }

    func encoded() -> Data {
        var data = Data()
        for part in parts {
            data.append(part)
        }
        data.append("--\(boundary)--\r\n".data(using: .utf8) ?? Data())
        return data
    }
}

extension UTType {
    var emberMediaType: EmberMediaType? {
        if conforms(to: .image) {
            return .image
        }

        if conforms(to: .movie) || conforms(to: .video) {
            return .video
        }

        if conforms(to: .audio) {
            return .audio
        }

        return nil
    }
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
