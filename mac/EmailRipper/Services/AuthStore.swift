import Foundation

final class AuthStore: ObservableObject {
    static let shared = AuthStore()

    @Published private(set) var token: String?
    @Published private(set) var email: String?
    @Published private(set) var fullName: String?

    private let fileURL: URL

    init() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("EmailRipper", isDirectory: true)
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        fileURL = base.appendingPathComponent("auth.json")
        load()
    }

    private struct Persisted: Codable { var token: String; var email: String; var fullName: String? }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let p = try? JSONDecoder().decode(Persisted.self, from: data) else { return }
        token = p.token; email = p.email; fullName = p.fullName
    }

    func set(token: String, email: String, fullName: String?) {
        self.token = token; self.email = email; self.fullName = fullName
        if let data = try? JSONEncoder().encode(Persisted(token: token, email: email, fullName: fullName)) {
            try? data.write(to: fileURL, options: .atomic)
        }
    }

    func clear() {
        token = nil; email = nil; fullName = nil
        try? FileManager.default.removeItem(at: fileURL)
    }
}
