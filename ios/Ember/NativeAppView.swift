import AVKit
import Observation
import PhotosUI
import SwiftUI
import UIKit

@MainActor
struct AppShellView: View {
    @State private var selectedTab: AppTab = .feed

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                FeedView()
            }
            .tabItem { AppTab.feed.label }
            .tag(AppTab.feed)

            NavigationStack {
                CreateView()
            }
            .tabItem { AppTab.create.label }
            .tag(AppTab.create)

            NavigationStack {
                ProfileView()
            }
            .tabItem { AppTab.profile.label }
            .tag(AppTab.profile)
        }
        .tint(EmberPalette.primary)
    }
}

private enum AppTab: Hashable {
    case feed
    case create
    case profile

    @ViewBuilder
    var label: some View {
        switch self {
        case .feed:
            Label("Feed", systemImage: "square.grid.2x2")
        case .create:
            Label("Create", systemImage: "plus.circle")
        case .profile:
            Label("Profile", systemImage: "person.crop.circle")
        }
    }
}

@MainActor
struct AuthView: View {
    @Environment(AppSession.self) private var session

    @State private var name = ""
    @State private var email = ""
    @State private var phoneNumber = ""
    @State private var password = ""
    @State private var errorMessage = ""
    @State private var isSubmitting = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Ember")
                        .font(.system(size: 13, weight: .bold))
                        .textCase(.uppercase)
                        .kerning(1.4)
                        .foregroundStyle(EmberPalette.primary)

                    Text(session.authMode == .signup ? "Create your account" : "Log in to Ember")
                        .font(.system(size: 34, weight: .heavy))
                        .foregroundStyle(EmberPalette.title)

                    Text(
                        session.authMode == .signup
                            ? "This native iPhone app now signs in directly against your Ember backend."
                            : "Use your Ember email and password to load your memories natively."
                    )
                    .font(.system(size: 16, weight: .medium))
                    .lineSpacing(6)
                    .foregroundStyle(EmberPalette.body)
                }

                Picker(
                    "Mode",
                    selection: Binding(
                        get: { session.authMode },
                        set: { session.authMode = $0 }
                    )
                ) {
                    Text("Log In").tag(AuthMode.login)
                    Text("Sign Up").tag(AuthMode.signup)
                }
                .pickerStyle(.segmented)

                if session.authMode == .signup {
                    LabeledField(title: "Name", text: $name, textContentType: .name)
                    LabeledField(title: "Phone", text: $phoneNumber, textContentType: .telephoneNumber)
                }

                LabeledField(
                    title: "Email",
                    text: $email,
                    keyboardType: .emailAddress,
                    textContentType: .emailAddress,
                    autocapitalization: .never
                )

                SecureLabeledField(title: "Password", text: $password)

                if !errorMessage.isEmpty {
                    ErrorBanner(message: errorMessage)
                }

                Button(action: submit) {
                    HStack {
                        Spacer()
                        if isSubmitting {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text(session.authMode == .signup ? "Create Account" : "Log In")
                                .font(.system(size: 16, weight: .bold))
                        }
                        Spacer()
                    }
                    .frame(minHeight: 54)
                }
                .buttonStyle(.borderedProminent)
                .tint(EmberPalette.primary)
                .disabled(isSubmitting || !isFormReady)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Current native scope")
                        .font(.system(size: 12, weight: .bold))
                        .textCase(.uppercase)
                        .foregroundStyle(EmberPalette.muted)

                    Text("Password auth, feed, create, wiki, and profile are now native. Magic-link and phone-code auth can be ported next.")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(EmberPalette.body)
                }
                .padding(16)
                .background(.white)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
            .padding(24)
        }
        .background(EmberPalette.surface.ignoresSafeArea())
    }

    private var isFormReady: Bool {
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let passwordValid = session.authMode == .signup ? password.count >= 8 : !password.isEmpty
        return !trimmedEmail.isEmpty && passwordValid
    }

    private func submit() {
        guard !isSubmitting else {
            return
        }

        isSubmitting = true
        errorMessage = ""

        Task {
            do {
                try await session.authenticate(
                    mode: session.authMode,
                    name: name,
                    email: email,
                    phoneNumber: phoneNumber,
                    password: password
                )
            } catch {
                errorMessage = session.handle(error: error)
            }

            isSubmitting = false
        }
    }
}

@MainActor
struct FeedView: View {
    @Environment(AppSession.self) private var session

    @State private var items: [FeedImageRecord] = []
    @State private var layout: FeedLayout = .grid
    @State private var isLoading = true
    @State private var errorMessage = ""

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 10), count: 3)

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Native feed")
                        .font(.system(size: 12, weight: .bold))
                        .textCase(.uppercase)
                        .kerning(1.2)
                        .foregroundStyle(EmberPalette.primary)

                    Text("Your photos, videos, and generated memory records now load directly from the Ember API.")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(EmberPalette.body)
                }

                if isLoading {
                    FeedLoadingView(layout: layout)
                } else if !errorMessage.isEmpty {
                    ErrorBanner(message: errorMessage)
                } else if items.isEmpty {
                    EmptyStateView(
                        title: "No embers yet",
                        message: "Create your first Ember from the Create tab to start the native feed."
                    )
                } else {
                    switch layout {
                    case .grid:
                        LazyVGrid(columns: columns, spacing: 10) {
                            ForEach(items) { item in
                                NavigationLink(destination: MemoryDetailView(imageID: item.id)) {
                                    FeedGridCell(item: item)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    case .list:
                        LazyVStack(spacing: 14) {
                            ForEach(items) { item in
                                NavigationLink(destination: MemoryDetailView(imageID: item.id)) {
                                    FeedListCell(item: item)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 28)
        }
        .background(EmberPalette.surface.ignoresSafeArea())
        .navigationTitle("My Embers")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Picker("Layout", selection: $layout) {
                    Image(systemName: "square.grid.2x2").tag(FeedLayout.grid)
                    Image(systemName: "list.bullet").tag(FeedLayout.list)
                }
                .pickerStyle(.segmented)
                .frame(width: 110)
            }
        }
        .task {
            guard items.isEmpty else {
                return
            }

            await loadFeed()
        }
        .refreshable {
            await loadFeed()
        }
    }

    private func loadFeed() async {
        isLoading = true
        errorMessage = ""

        do {
            items = try await session.client.fetchFeed()
        } catch {
            errorMessage = session.handle(error: error)
        }

        isLoading = false
    }
}

private enum FeedLayout: Hashable {
    case grid
    case list
}

@MainActor
struct MemoryDetailView: View {
    @Environment(AppSession.self) private var session

    let imageID: String

    @State private var image: ImageDetailRecord?
    @State private var isLoading = true
    @State private var errorMessage = ""
    @State private var isGeneratingWiki = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if isLoading {
                    ProgressCard(message: "Loading Ember...")
                } else if let image {
                    mediaSection(image: image)
                    summarySection(image: image)
                    contributorsSection(image: image)
                    attachmentsSection(image: image)
                    analysisSection(image: image)
                    wikiSection(image: image)
                } else if !errorMessage.isEmpty {
                    ErrorBanner(message: errorMessage)
                }
            }
            .padding(20)
            .padding(.bottom, 28)
        }
        .background(EmberPalette.surface.ignoresSafeArea())
        .navigationTitle(image?.emberTitle ?? "Ember")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            guard image == nil else {
                return
            }

            await loadImage()
        }
        .refreshable {
            await loadImage()
        }
    }

    @ViewBuilder
    private func mediaSection(image: ImageDetailRecord) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            RemoteHeroMediaView(
                url: mediaURL(for: image.mediaType, filename: image.filename, posterFilename: image.posterFilename),
                mediaType: image.mediaType
            )
            .frame(maxWidth: .infinity)
            .frame(height: 320)
            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))

            HStack(spacing: 8) {
                DetailChip(text: image.accessType.rawValue.capitalized)
                DetailChip(text: image.shareToNetwork ? "Shared to network" : "Private")
                if image.wiki != nil {
                    DetailChip(text: "Wiki ready")
                }
            }
        }
    }

    private func summarySection(image: ImageDetailRecord) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(image.emberTitle)
                .font(.system(size: 32, weight: .heavy))
                .foregroundStyle(EmberPalette.title)

            Text(image.description?.nilIfBlank ?? "No caption yet. Use the Create flow or the web editor to add more context to this memory.")
                .font(.system(size: 16, weight: .medium))
                .lineSpacing(6)
                .foregroundStyle(EmberPalette.body)

            VStack(alignment: .leading, spacing: 8) {
                DetailRow(label: "Owner", value: image.owner.displayName)
                DetailRow(label: "Created", value: formattedDate(image.createdAt))
                DetailRow(label: "Contributors", value: "\(image.contributors.count)")
                DetailRow(label: "Attachments", value: "\(image.attachments.count)")
            }
        }
        .padding(20)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
    }

    @ViewBuilder
    private func contributorsSection(image: ImageDetailRecord) -> some View {
        if !image.contributors.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader(title: "Contributors", subtitle: "People attached to this memory.")

                ForEach(image.contributors) { contributor in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(contributor.displayName)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(EmberPalette.title)

                        Text(formattedDate(contributor.createdAt))
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(EmberPalette.muted)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(EmberPalette.softCard)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
            }
            .padding(20)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        }
    }

    @ViewBuilder
    private func attachmentsSection(image: ImageDetailRecord) -> some View {
        if !image.attachments.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader(
                    title: "Added Content",
                    subtitle: "Supporting photos, videos, and audio already linked to this Ember."
                )

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(image.attachments) { attachment in
                            VStack(alignment: .leading, spacing: 8) {
                                RemoteThumbnailView(
                                    url: mediaURL(
                                        for: attachment.mediaType,
                                        filename: attachment.filename,
                                        posterFilename: attachment.posterFilename
                                    ),
                                    mediaType: attachment.mediaType
                                )
                                .frame(width: 170, height: 128)
                                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                                Text(attachment.originalName)
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(EmberPalette.title)
                                    .lineLimit(2)

                                Text(attachment.description?.nilIfBlank ?? "No note attached.")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(EmberPalette.body)
                                    .lineLimit(2)
                            }
                            .frame(width: 170, alignment: .leading)
                        }
                    }
                }
            }
            .padding(20)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        }
    }

    @ViewBuilder
    private func analysisSection(image: ImageDetailRecord) -> some View {
        if let analysis = image.analysis {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader(title: "AI Analysis", subtitle: "Extracted visual and metadata context.")

                if let summary = analysis.summary?.nilIfBlank {
                    Text(summary)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(EmberPalette.body)
                }

                if let visualDescription = analysis.visualDescription?.nilIfBlank {
                    Text(visualDescription)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(EmberPalette.body)
                }

                if let metadataSummary = analysis.metadataSummary?.nilIfBlank {
                    Text(metadataSummary)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(EmberPalette.body)
                }

                if let capturedAt = analysis.capturedAt {
                    DetailRow(label: "Captured", value: formattedDate(capturedAt))
                }
            }
            .padding(20)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        }
    }

    private func wikiSection(image: ImageDetailRecord) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(
                title: image.wiki == nil ? "Wiki" : "Memory Wiki",
                subtitle: "Open the synthesized memory narrative or regenerate it after new additions."
            )

            if let wiki = image.wiki {
                DetailRow(label: "Version", value: "\(wiki.version)")
                DetailRow(label: "Updated", value: formattedDate(wiki.updatedAt))

                NavigationLink(destination: WikiDetailView(imageID: image.id)) {
                    Text("Open Wiki")
                        .font(.system(size: 15, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 48)
                }
                .buttonStyle(.borderedProminent)
                .tint(EmberPalette.primary)
            } else {
                Text("No wiki has been generated for this Ember yet.")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(EmberPalette.body)
            }

            if image.canManage {
                Button(action: generateWiki) {
                    HStack {
                        Spacer()
                        if isGeneratingWiki {
                            ProgressView()
                                .tint(EmberPalette.primary)
                        } else {
                            Text(image.wiki == nil ? "Generate Wiki" : "Regenerate Wiki")
                                .font(.system(size: 15, weight: .bold))
                        }
                        Spacer()
                    }
                    .frame(minHeight: 48)
                }
                .buttonStyle(.bordered)
                .tint(EmberPalette.primary)
                .disabled(isGeneratingWiki)
            }
        }
        .padding(20)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
    }

    private func loadImage() async {
        isLoading = true
        errorMessage = ""

        do {
            image = try await session.client.fetchImage(id: imageID)
        } catch {
            errorMessage = session.handle(error: error)
        }

        isLoading = false
    }

    private func generateWiki() {
        guard !isGeneratingWiki else {
            return
        }

        isGeneratingWiki = true
        errorMessage = ""

        Task {
            do {
                try await session.client.generateWiki(imageID: imageID)
                image = try await session.client.fetchImage(id: imageID)
            } catch {
                errorMessage = session.handle(error: error)
            }

            isGeneratingWiki = false
        }
    }

    private func mediaURL(
        for mediaType: EmberMediaType,
        filename: String,
        posterFilename: String?
    ) -> URL? {
        switch mediaType {
        case .image:
            return session.config.uploadURL(filename: filename)
        case .video:
            return posterFilename.map { session.config.uploadURL(filename: $0) }
                ?? session.config.uploadURL(filename: filename)
        case .audio:
            return nil
        }
    }
}

@MainActor
struct WikiDetailView: View {
    @Environment(AppSession.self) private var session

    let imageID: String

    @State private var wiki: WikiRecord?
    @State private var isLoading = true
    @State private var errorMessage = ""
    @State private var isGenerating = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if isLoading {
                    ProgressCard(message: "Loading wiki...")
                } else if let wiki {
                    RemoteHeroMediaView(
                        url: mediaURL(for: wiki.image),
                        mediaType: wiki.image.mediaType
                    )
                    .frame(height: 280)
                    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))

                    VStack(alignment: .leading, spacing: 12) {
                        Text(wiki.image.emberTitle)
                            .font(.system(size: 32, weight: .heavy))
                            .foregroundStyle(EmberPalette.title)

                        Text(wiki.image.description?.nilIfBlank ?? "Synthesized from the current Ember record.")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundStyle(EmberPalette.body)

                        HStack(spacing: 8) {
                            DetailChip(text: "Version \(wiki.version)")
                            DetailChip(text: formattedDate(wiki.updatedAt))
                        }
                    }
                    .padding(20)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))

                    VStack(alignment: .leading, spacing: 14) {
                        SectionHeader(title: "Narrative", subtitle: "Direct markdown output from Ember.")
                        MarkdownArticleView(content: wiki.content)
                    }
                    .padding(20)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))

                    if wiki.canManage {
                        Button(action: regenerate) {
                            HStack {
                                Spacer()
                                if isGenerating {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text("Regenerate Wiki")
                                        .font(.system(size: 15, weight: .bold))
                                }
                                Spacer()
                            }
                            .frame(minHeight: 50)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(EmberPalette.primary)
                        .disabled(isGenerating)
                    }
                } else if !errorMessage.isEmpty {
                    ErrorBanner(message: errorMessage)
                } else {
                    EmptyStateView(
                        title: "No wiki yet",
                        message: "Generate the wiki from the Ember detail screen to create the first narrative draft."
                    )
                }
            }
            .padding(20)
            .padding(.bottom, 28)
        }
        .background(EmberPalette.surface.ignoresSafeArea())
        .navigationTitle("Wiki")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            guard wiki == nil else {
                return
            }

            await loadWiki()
        }
        .refreshable {
            await loadWiki()
        }
    }

    private func loadWiki() async {
        isLoading = true
        errorMessage = ""

        do {
            wiki = try await session.client.fetchWiki(imageID: imageID)
        } catch let error as APIError {
            if case .server(_, 404) = error {
                wiki = nil
                errorMessage = ""
            } else {
                errorMessage = session.handle(error: error)
            }
        } catch {
            errorMessage = session.handle(error: error)
        }

        isLoading = false
    }

    private func regenerate() {
        guard !isGenerating else {
            return
        }

        isGenerating = true
        errorMessage = ""

        Task {
            do {
                try await session.client.generateWiki(imageID: imageID)
                wiki = try await session.client.fetchWiki(imageID: imageID)
            } catch {
                errorMessage = session.handle(error: error)
            }

            isGenerating = false
        }
    }

    private func mediaURL(for image: WikiImage) -> URL? {
        switch image.mediaType {
        case .image:
            return session.config.uploadURL(filename: image.filename)
        case .video:
            return image.posterFilename.map { session.config.uploadURL(filename: $0) }
                ?? session.config.uploadURL(filename: image.filename)
        case .audio:
            return nil
        }
    }
}

@MainActor
struct CreateView: View {
    @Environment(AppSession.self) private var session

    @State private var selectedItem: PhotosPickerItem?
    @State private var draftAsset: UploadDraft?
    @State private var description = ""
    @State private var isLoadingSelection = false
    @State private var isUploading = false
    @State private var errorMessage = ""
    @State private var uploadResult: UploadResult?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Create natively")
                        .font(.system(size: 12, weight: .bold))
                        .textCase(.uppercase)
                        .kerning(1.2)
                        .foregroundStyle(EmberPalette.primary)

                    Text("Pick a photo or video, add a note, and post it directly to `/api/images` without leaving SwiftUI.")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(EmberPalette.body)
                }

                PhotosPicker(
                    selection: $selectedItem,
                    matching: .any(of: [.images, .videos]),
                    photoLibrary: .shared()
                ) {
                    Label("Choose Photo or Video", systemImage: "photo.on.rectangle")
                        .font(.system(size: 16, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 56)
                }
                .buttonStyle(.borderedProminent)
                .tint(EmberPalette.primary)

                if isLoadingSelection {
                    ProgressCard(message: "Preparing selected media...")
                }

                if let draftAsset {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Ready to upload")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(EmberPalette.title)

                        UploadPreviewView(draft: draftAsset)

                        TextField("Add a caption or note", text: $description, axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(4, reservesSpace: true)

                        Button(action: upload) {
                            HStack {
                                Spacer()
                                if isUploading {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text("Create Ember")
                                        .font(.system(size: 16, weight: .bold))
                                }
                                Spacer()
                            }
                            .frame(minHeight: 54)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(EmberPalette.primary)
                        .disabled(isUploading)
                    }
                    .padding(20)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                }

                if let uploadResult {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Upload complete")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(EmberPalette.title)

                        Text(uploadResult.warning?.nilIfBlank ?? "Your Ember is in the feed and ready for the native detail view.")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(EmberPalette.body)

                        NavigationLink(destination: MemoryDetailView(imageID: uploadResult.id)) {
                            Text("Open New Ember")
                                .font(.system(size: 15, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .frame(minHeight: 48)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(EmberPalette.primary)
                    }
                    .padding(20)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                }

                if !errorMessage.isEmpty {
                    ErrorBanner(message: errorMessage)
                }
            }
            .padding(20)
            .padding(.bottom, 28)
        }
        .background(EmberPalette.surface.ignoresSafeArea())
        .navigationTitle("Create")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: selectedItem?.itemIdentifier) {
            guard let selectedItem else {
                return
            }

            await loadSelection(selectedItem)
        }
    }

    private func loadSelection(_ item: PhotosPickerItem) async {
        isLoadingSelection = true
        errorMessage = ""
        uploadResult = nil

        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                throw APIError.transport(message: "Could not read the selected media.")
            }

            let contentType = item.supportedContentTypes.first ?? .image
            guard let emberMediaType = contentType.emberMediaType else {
                throw APIError.transport(message: "Only images and videos are supported in the native upload flow.")
            }

            let filenameExtension = contentType.preferredFilenameExtension
                ?? (emberMediaType == .image ? "jpg" : "mov")
            let mimeType = contentType.preferredMIMEType
                ?? (emberMediaType == .image ? "image/jpeg" : "video/quicktime")

            draftAsset = UploadDraft(
                asset: UploadAsset(
                    data: data,
                    filename: "ember-\(UUID().uuidString).\(filenameExtension)",
                    mimeType: mimeType
                ),
                mediaType: emberMediaType,
                previewImage: emberMediaType == .image ? UIImage(data: data) : nil
            )
        } catch {
            errorMessage = session.handle(error: error)
            draftAsset = nil
        }

        isLoadingSelection = false
    }

    private func upload() {
        guard let draftAsset, !isUploading else {
            return
        }

        isUploading = true
        errorMessage = ""

        Task {
            do {
                let result = try await session.client.uploadMedia(
                    asset: draftAsset.asset,
                    description: description
                )
                uploadResult = result
                selectedItem = nil
                self.draftAsset = nil
                description = ""
            } catch {
                errorMessage = session.handle(error: error)
            }

            isUploading = false
        }
    }
}

@MainActor
struct ProfileView: View {
    @Environment(AppSession.self) private var session

    @State private var name = ""
    @State private var email = ""
    @State private var phoneNumber = ""
    @State private var isSaving = false
    @State private var errorMessage = ""
    @State private var successMessage = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Profile")
                        .font(.system(size: 34, weight: .heavy))
                        .foregroundStyle(EmberPalette.title)

                    Text("Manage the native session and keep the profile fields in sync with your Ember backend.")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(EmberPalette.body)
                }

                VStack(alignment: .leading, spacing: 14) {
                    LabeledField(title: "Name", text: $name, textContentType: .name)
                    LabeledField(
                        title: "Email",
                        text: $email,
                        keyboardType: .emailAddress,
                        textContentType: .emailAddress,
                        autocapitalization: .never
                    )
                    LabeledField(
                        title: "Phone",
                        text: $phoneNumber,
                        textContentType: .telephoneNumber
                    )

                    if !errorMessage.isEmpty {
                        ErrorBanner(message: errorMessage)
                    } else if !successMessage.isEmpty {
                        SuccessBanner(message: successMessage)
                    }

                    Button(action: saveProfile) {
                        HStack {
                            Spacer()
                            if isSaving {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Save Profile")
                                    .font(.system(size: 16, weight: .bold))
                            }
                            Spacer()
                        }
                        .frame(minHeight: 54)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(EmberPalette.primary)
                    .disabled(isSaving || email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                .padding(20)
                .background(.white)
                .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))

                VStack(alignment: .leading, spacing: 12) {
                    Text("Current account")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(EmberPalette.title)

                    if let user = session.user {
                        DetailRow(label: "Signed in as", value: user.displayName)
                        DetailRow(label: "Email", value: user.email)
                        if let phoneNumber = user.phoneNumber?.nilIfBlank {
                            DetailRow(label: "Phone", value: phoneNumber)
                        }
                    }

                    Button(role: .destructive) {
                        Task {
                            await session.logout()
                        }
                    } label: {
                        Text("Log Out")
                            .font(.system(size: 15, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: 48)
                    }
                    .buttonStyle(.bordered)
                }
                .padding(20)
                .background(.white)
                .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
            }
            .padding(20)
            .padding(.bottom, 28)
        }
        .background(EmberPalette.surface.ignoresSafeArea())
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear(perform: seedForm)
    }

    private func seedForm() {
        guard let user = session.user else {
            return
        }

        name = user.name ?? ""
        email = user.email
        phoneNumber = user.phoneNumber ?? ""
    }

    private func saveProfile() {
        guard !isSaving else {
            return
        }

        isSaving = true
        errorMessage = ""
        successMessage = ""

        Task {
            do {
                try await session.updateProfile(name: name, email: email, phoneNumber: phoneNumber)
                successMessage = "Profile updated."
            } catch {
                errorMessage = session.handle(error: error)
            }

            isSaving = false
        }
    }
}

private struct FeedGridCell: View {
    @Environment(AppSession.self) private var session
    let item: FeedImageRecord

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            RemoteThumbnailView(
                url: session.config.uploadURL(filename: item.previewFilename),
                mediaType: item.mediaType
            )
            .aspectRatio(1, contentMode: .fill)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

            LinearGradient(
                colors: [.clear, .black.opacity(0.55)],
                startPoint: .top,
                endPoint: .bottom
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(item.emberTitle)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)

                Text(formattedDate(item.createdAt))
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.white.opacity(0.88))
            }
            .padding(10)
        }
    }
}

private struct FeedListCell: View {
    @Environment(AppSession.self) private var session
    let item: FeedImageRecord

    var body: some View {
        HStack(spacing: 14) {
            RemoteThumbnailView(
                url: session.config.uploadURL(filename: item.previewFilename),
                mediaType: item.mediaType
            )
            .frame(width: 110, height: 92)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

            VStack(alignment: .leading, spacing: 6) {
                Text(item.emberTitle)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(EmberPalette.title)
                    .lineLimit(2)

                Text(item.description?.nilIfBlank ?? "No caption yet.")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(EmberPalette.body)
                    .lineLimit(2)

                HStack(spacing: 8) {
                    DetailChip(text: item.owner.displayName)
                    if item.wiki != nil {
                        DetailChip(text: "Wiki")
                    }
                }
            }

            Spacer(minLength: 0)
        }
        .padding(14)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

private struct FeedLoadingView: View {
    let layout: FeedLayout

    var body: some View {
        switch layout {
        case .grid:
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                ForEach(0 ..< 12, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(Color.black.opacity(0.08))
                        .aspectRatio(1, contentMode: .fit)
                }
            }
        case .list:
            LazyVStack(spacing: 14) {
                ForEach(0 ..< 5, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .fill(Color.black.opacity(0.08))
                        .frame(height: 120)
                }
            }
        }
    }
}

private struct UploadDraft {
    let asset: UploadAsset
    let mediaType: EmberMediaType
    let previewImage: UIImage?
}

private struct UploadPreviewView: View {
    let draft: UploadDraft

    var body: some View {
        Group {
            if let previewImage = draft.previewImage {
                Image(uiImage: previewImage)
                    .resizable()
                    .scaledToFill()
            } else {
                ZStack {
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .fill(EmberPalette.softCard)

                    VStack(spacing: 12) {
                        Image(systemName: draft.mediaType == .video ? "film.stack" : "waveform")
                            .font(.system(size: 36, weight: .semibold))
                            .foregroundStyle(EmberPalette.primary)

                        Text(draft.mediaType == .video ? "Video selected" : "Media selected")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(EmberPalette.title)
                    }
                }
            }
        }
        .frame(height: 240)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

private struct RemoteThumbnailView: View {
    let url: URL?
    let mediaType: EmberMediaType

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(EmberPalette.softCard)

            if let url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        placeholder
                    case .empty:
                        ProgressView()
                            .tint(EmberPalette.primary)
                    @unknown default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .overlay(alignment: .topTrailing) {
            if mediaType == .video {
                Image(systemName: "play.fill")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(10)
                    .background(.black.opacity(0.55))
                    .clipShape(Circle())
                    .padding(10)
            }
        }
        .clipped()
    }

    @ViewBuilder
    private var placeholder: some View {
        VStack(spacing: 8) {
            Image(systemName: mediaType == .video ? "film" : mediaType == .audio ? "waveform" : "photo")
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(EmberPalette.primary)

            Text(mediaType == .video ? "Video" : mediaType == .audio ? "Audio" : "Image")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(EmberPalette.body)
        }
    }
}

private struct RemoteHeroMediaView: View {
    let url: URL?
    let mediaType: EmberMediaType

    @State private var player: AVPlayer?

    var body: some View {
        Group {
            if mediaType == .video, let url {
                VideoPlayer(player: player)
                    .task(id: url) {
                        player = AVPlayer(url: url)
                    }
                    .onDisappear {
                        player?.pause()
                    }
            } else {
                RemoteThumbnailView(url: url, mediaType: mediaType)
            }
        }
        .background(EmberPalette.softCard)
    }
}

private struct MarkdownArticleView: View {
    let content: String

    var body: some View {
        if let attributed = try? AttributedString(
            markdown: content,
            options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .full)
        ) {
            Text(attributed)
                .font(.system(size: 16))
                .foregroundStyle(EmberPalette.body)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            Text(content)
                .font(.system(size: 16))
                .foregroundStyle(EmberPalette.body)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct LabeledField: View {
    let title: String
    @Binding var text: String
    var keyboardType: UIKeyboardType = .default
    var textContentType: UITextContentType?
    var autocapitalization: TextInputAutocapitalization = .sentences

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(EmberPalette.title)

            TextField("", text: $text)
                .keyboardType(keyboardType)
                .textInputAutocapitalization(autocapitalization)
                .autocorrectionDisabled(autocapitalization == .never)
                .textContentType(textContentType)
                .padding(.horizontal, 14)
                .frame(height: 50)
                .background(EmberPalette.softCard)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }
}

private struct SecureLabeledField: View {
    let title: String
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(EmberPalette.title)

            SecureField("", text: $text)
                .textContentType(.password)
                .padding(.horizontal, 14)
                .frame(height: 50)
                .background(EmberPalette.softCard)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }
}

private struct SectionHeader: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(EmberPalette.title)

            Text(subtitle)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(EmberPalette.body)
        }
    }
}

private struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .top) {
            Text(label)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(EmberPalette.muted)
            Spacer(minLength: 16)
            Text(value)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(EmberPalette.title)
                .multilineTextAlignment(.trailing)
        }
    }
}

private struct DetailChip: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(EmberPalette.title)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(EmberPalette.softCard)
            .clipShape(Capsule())
    }
}

private struct ProgressCard: View {
    let message: String

    var body: some View {
        HStack(spacing: 12) {
            ProgressView()
                .tint(EmberPalette.primary)

            Text(message)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(EmberPalette.body)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

private struct ErrorBanner: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Color.red)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(Color.red.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct SuccessBanner: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Color.green)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(Color.green.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct EmptyStateView: View {
    let title: String
    let message: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(EmberPalette.title)

            Text(message)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(EmberPalette.body)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

enum EmberPalette {
    static let surface = Color(red: 1, green: 0.9686, blue: 0.949)
    static let primary = Color(red: 1, green: 0.4, blue: 0.1294)
    static let title = Color(red: 0.0588, green: 0.0902, blue: 0.1647)
    static let body = Color(red: 0.2784, green: 0.3412, blue: 0.451)
    static let muted = Color(red: 0.5255, green: 0.5529, blue: 0.6157)
    static let softCard = Color(red: 0.976, green: 0.955, blue: 0.935)
}

private func formattedDate(_ value: String) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

    let fallbackFormatter = ISO8601DateFormatter()

    let date = formatter.date(from: value) ?? fallbackFormatter.date(from: value)
    guard let date else {
        return value
    }

    return date.formatted(.dateTime.month(.abbreviated).day().year())
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
