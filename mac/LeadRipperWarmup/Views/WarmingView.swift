import SwiftUI

struct WarmingView: View {
    @EnvironmentObject var api: APIClient
    @State private var inboxes: [WarmupStats] = []
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Inbox warming").font(.system(size: 28, weight: .semibold)).foregroundColor(.white)
                    Text("Each enabled inbox joins the peer warming pool. The scheduler sends short, human-looking messages between inboxes and rescues any that land in spam. Caps ramp up automatically as reputation improves.")
                        .foregroundColor(.secondary)
                }

                if inboxes.isEmpty {
                    Text("No inboxes yet. Connect one from the Inboxes screen to start warming.")
                        .foregroundColor(.secondary).padding(.vertical, 20)
                }

                ForEach($inboxes) { $inbox in
                    WarmingRow(inbox: $inbox) {
                        Task { await toggle(inbox: inbox) }
                    } onSave: {
                        Task { await save(inbox: inbox) }
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
            let r: WarmupStatsResponse = try await api.get("/api/warmup/stats", as: WarmupStatsResponse.self)
            await MainActor.run { inboxes = r.inboxes }
        } catch { await MainActor.run { self.error = error.localizedDescription } }
    }

    private func toggle(inbox: WarmupStats) async {
        struct Body: Encodable { let warmupEnabled: Bool }
        struct Resp: Codable { let ok: Bool? }
        _ = try? await api.patch("/api/inboxes/\(inbox.id)/warmup", body: Body(warmupEnabled: !inbox.warmupEnabled), as: Resp.self)
        await load()
    }

    private func save(inbox: WarmupStats) async {
        struct Body: Encodable {
            let warmupDailyMin: Int; let warmupDailyMax: Int; let warmupRampStep: Int
            let warmupReplyRate: Double
        }
        struct Resp: Codable { let ok: Bool? }
        let b = Body(warmupDailyMin: inbox.warmupDailyMin, warmupDailyMax: inbox.warmupDailyMax,
                     warmupRampStep: 3, warmupReplyRate: 0.4)
        _ = try? await api.patch("/api/inboxes/\(inbox.id)/warmup", body: b, as: Resp.self)
    }
}

struct WarmingRow: View {
    @Binding var inbox: WarmupStats
    var onToggle: () -> Void
    var onSave: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Circle().fill(reputationColor(inbox.reputationScore)).frame(width: 10, height: 10)
                Text(inbox.email).font(.system(size: 16, weight: .semibold)).foregroundColor(.white)
                Text(inbox.provider.uppercased())
                    .font(.system(size: 11)).foregroundColor(.secondary)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.white.opacity(0.08)).cornerRadius(4)
                Spacer()
                Toggle(inbox.warmupEnabled ? "Enabled" : "Disabled", isOn: Binding(
                    get: { inbox.warmupEnabled },
                    set: { _ in onToggle() }
                )).toggleStyle(.switch)
            }

            HStack(spacing: 20) {
                statColumn("REPUTATION", "\(inbox.reputationScore)", color: reputationColor(inbox.reputationScore))
                statColumn("TODAY / CAP", "\(inbox.sentToday)/\(inbox.warmupCurrentCap)")
                statColumn("SENT 14D", "\(inbox.sent14d)")
                statColumn("REPLIED 14D", "\(inbox.replied14d)", color: .appSuccess)
                statColumn("SPAM / RESCUED", "\(inbox.spam14d) / \(inbox.rescued14d)", color: .appWarn)
            }

            HStack(alignment: .bottom, spacing: 10) {
                configField("Daily min", value: $inbox.warmupDailyMin)
                configField("Daily max", value: $inbox.warmupDailyMax)
                Spacer()
                Button("Save", action: onSave).buttonStyle(.primary)
            }
        }
        .card()
    }

    private func statColumn(_ label: String, _ value: String, color: Color = .white) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.system(size: 11)).foregroundColor(.secondary)
            Text(value).font(.system(size: 22, weight: .semibold)).foregroundColor(color)
        }
    }

    private func configField(_ label: String, value: Binding<Int>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.system(size: 11)).foregroundColor(.secondary)
            TextField("", value: value, format: .number)
                .textFieldStyle(.roundedBorder)
                .frame(width: 80)
        }
    }
}
