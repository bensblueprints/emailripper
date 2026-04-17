import Foundation

struct APIError: Error, LocalizedError {
    let status: Int
    let message: String
    var errorDescription: String? { "API \(status): \(message)" }
}

final class APIClient: ObservableObject {
    static let shared = APIClient()

    /// Override via `EMAILRIPPER_BASE_URL` env var during development.
    var baseURL: URL = URL(string: ProcessInfo.processInfo.environment["EMAILRIPPER_BASE_URL"] ?? "http://localhost:4100")!

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        return e
    }()

    private func request(_ path: String, method: String = "GET", body: Encodable? = nil) throws -> URLRequest {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = method
        req.timeoutInterval = 60
        if let token = AuthStore.shared.token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try encoder.encode(AnyEncodable(body))
        }
        return req
    }

    func get<T: Decodable>(_ path: String, as: T.Type) async throws -> T {
        let (data, resp) = try await URLSession.shared.data(for: try request(path))
        try ensureOK(data: data, response: resp)
        return try decoder.decode(T.self, from: data)
    }

    func post<T: Decodable>(_ path: String, body: Encodable, as: T.Type) async throws -> T {
        let (data, resp) = try await URLSession.shared.data(for: try request(path, method: "POST", body: body))
        try ensureOK(data: data, response: resp)
        return try decoder.decode(T.self, from: data)
    }

    func patch<T: Decodable>(_ path: String, body: Encodable, as: T.Type) async throws -> T {
        let (data, resp) = try await URLSession.shared.data(for: try request(path, method: "PATCH", body: body))
        try ensureOK(data: data, response: resp)
        return try decoder.decode(T.self, from: data)
    }

    func delete(_ path: String) async throws {
        let (data, resp) = try await URLSession.shared.data(for: try request(path, method: "DELETE"))
        try ensureOK(data: data, response: resp)
    }

    private func ensureOK(data: Data, response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        if !(200..<300).contains(http.statusCode) {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw APIError(status: http.statusCode, message: body)
        }
    }
}

// Type-erasing encodable for heterogeneous bodies.
struct AnyEncodable: Encodable {
    private let _encode: (Encoder) throws -> Void
    init(_ wrapped: Encodable) { _encode = wrapped.encode }
    func encode(to encoder: Encoder) throws { try _encode(encoder) }
}
