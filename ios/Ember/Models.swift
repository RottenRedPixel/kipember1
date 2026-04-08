import Foundation

enum EmberMediaType: String, Codable, Sendable {
    case image = "IMAGE"
    case video = "VIDEO"
    case audio = "AUDIO"
}

enum ImageAccessType: String, Codable, Sendable {
    case owner
    case contributor
    case network
}

struct UserRecord: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String?
    let email: String
    let phoneNumber: String?

    var displayName: String {
        let trimmedName = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmedName.isEmpty ? email : trimmedName
    }
}

struct AuthEnvelope: Decodable, Sendable {
    let user: UserRecord
}

struct FeedImageRecord: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let filename: String
    let mediaType: EmberMediaType
    let posterFilename: String?
    let durationSeconds: Double?
    let originalName: String
    let title: String?
    let description: String?
    let createdAt: String
    let shareToNetwork: Bool
    let owner: UserRecord
    let accessType: ImageAccessType
    let count: FeedCounts
    let wiki: FeedWikiSummary?

    enum CodingKeys: String, CodingKey {
        case id
        case filename
        case mediaType
        case posterFilename
        case durationSeconds
        case originalName
        case title
        case description
        case createdAt
        case shareToNetwork
        case owner
        case accessType
        case count = "_count"
        case wiki
    }

    var emberTitle: String {
        let trimmedTitle = title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmedTitle.isEmpty ? originalName : trimmedTitle
    }

    var previewFilename: String {
        posterFilename ?? filename
    }
}

struct FeedCounts: Decodable, Hashable, Sendable {
    let contributors: Int
    let tags: Int
}

struct FeedWikiSummary: Decodable, Hashable, Sendable {
    let id: String
}

struct ImageDetailRecord: Decodable, Identifiable, Sendable {
    let id: String
    let filename: String
    let mediaType: EmberMediaType
    let posterFilename: String?
    let durationSeconds: Double?
    let originalName: String
    let title: String?
    let description: String?
    let createdAt: String
    let shareToNetwork: Bool
    let accessType: ImageAccessType
    let canManage: Bool
    let owner: UserRecord
    let contributors: [ImageContributor]
    let attachments: [ImageAttachment]
    let analysis: ImageAnalysis?
    let wiki: ImageWikiSummary?

    var emberTitle: String {
        let trimmedTitle = title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmedTitle.isEmpty ? originalName : trimmedTitle
    }
}

struct ImageContributor: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String?
    let email: String?
    let phoneNumber: String?
    let createdAt: String
    let user: UserRecord?

    var displayName: String {
        if let user {
            return user.displayName
        }

        let trimmedName = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !trimmedName.isEmpty {
            return trimmedName
        }

        if let email, !email.isEmpty {
            return email
        }

        if let phoneNumber, !phoneNumber.isEmpty {
            return phoneNumber
        }

        return "Contributor"
    }
}

struct ImageAttachment: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let filename: String
    let mediaType: EmberMediaType
    let posterFilename: String?
    let durationSeconds: Double?
    let originalName: String
    let description: String?
    let createdAt: String
    let updatedAt: String

    var previewFilename: String {
        posterFilename ?? filename
    }
}

struct ImageAnalysis: Decodable, Hashable, Sendable {
    let status: String
    let summary: String?
    let visualDescription: String?
    let metadataSummary: String?
    let capturedAt: String?
    let cameraMake: String?
    let cameraModel: String?
    let lensModel: String?
}

struct ImageWikiSummary: Decodable, Hashable, Sendable {
    let id: String
    let content: String
    let version: Int
    let updatedAt: String
}

struct WikiRecord: Decodable, Identifiable, Sendable {
    let id: String
    let content: String
    let version: Int
    let updatedAt: String
    let canManage: Bool
    let image: WikiImage
}

struct WikiImage: Decodable, Hashable, Sendable {
    let originalName: String
    let title: String?
    let description: String?
    let filename: String
    let mediaType: EmberMediaType
    let posterFilename: String?
    let durationSeconds: Double?
    let attachments: [ImageAttachment]

    var emberTitle: String {
        let trimmedTitle = title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmedTitle.isEmpty ? originalName : trimmedTitle
    }
}

struct UploadResult: Decodable, Sendable {
    let id: String
    let mediaType: EmberMediaType
    let wikiGenerated: Bool
    let warning: String?
}

struct ServerMessage: Decodable, Sendable {
    let error: String?
    let success: Bool?
}
