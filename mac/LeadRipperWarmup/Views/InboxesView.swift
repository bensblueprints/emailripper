import SwiftUI

struct InboxesView: View {
    @EnvironmentObject var api: APIClient
    @State private var inboxes: [Inbox] = []
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Inboxes").font(.system(size: 28, weight: .semibold)).foregroundColor(.white)
                    Text("Connect mailboxes to send from and include in the warming pool.")
                        .foregroundColor(.secondary)
                }

                HStack {
                    Button("Connect Gmail") { Task { await connect("/api/oauth/google/start") } }.buttonStyle(.primary)
                    Button("Connect Microsoft 365") { Task { await connect("/api/oauth/microsoft/start") } }.buttonStyle(.primary)
                    Button("Add IMAP / SMTP") { /* sheet */ }
                    Button("Add SMTP relay") { /* sheet */ }
                }

                ForEach(inboxes) { i in
                    InboxRow(inbox: i) {
                        Task {
                            try? await api.delete("/api/inboxes/\(i.id)")
                            await load()
                        }
                    }
                }

                if let error { Text(error).foregroundColor(.appDanger) }
            }
            .padding(32)
        }
        .task { await load() }
    }

    private func load() async {
        do {
            let r: InboxesResponse = try await api.get("/api/inboxes", as: InboxesResponse.self)
            await MainActor.run { inboxes = r.inboxes }
        } catch { await MainActor.run { self.error = error.localizedDescription } }
    }

    private func connect(_ path: String) async {
        do {
            let r: OAuthStart = try await api.get(path, as: OAuthStart.self)
            if let url = URL(string: r.url) {
                NSWorkspace.shared.open(url)
            }
        } catch {
            await MainActor.run { self.error = error.localizedDescription }
        }
    }
}

struct InboxRow: View {
    let inbox: Inbox
    let onDelete: () -> Void
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(inbox.email).font(.system(size: 15, weight: .semibold)).foregroundColor(.white)
                    Text(inbox.provider.uppercased())
                        .font(.caption).foregroundColor(.secondary)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Color.white.opacity(0.08)).cornerRadius(4)
                }
                Text("status \(inbox.status) · reputation \(inbox.reputationScore) · warmup \(inbox.warmupEnabled ? "on" : "off")")
                    .font(.caption).foregroundColor(.secondary)
            }
            Spacer()
            Button("Remove", action: onDelete)
        }
        .card()
    }
}
