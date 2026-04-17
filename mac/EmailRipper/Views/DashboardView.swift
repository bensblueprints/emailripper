import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var api: APIClient
    @State private var totals: AnalyticsTotals?
    @State private var campaigns: [Campaign] = []
    @State private var warmup: [WarmupStats] = []
    @State private var error: String?
    @State private var busy = false

    var openRate: Double { (totals?.sent ?? 0) == 0 ? 0 : 100 * Double(totals!.opened) / Double(totals!.sent) }
    var replyRate: Double { (totals?.sent ?? 0) == 0 ? 0 : 100 * Double(totals!.replied) / Double(totals!.sent) }
    var bounceRate: Double { (totals?.sent ?? 0) == 0 ? 0 : 100 * Double(totals!.bounced) / Double(totals!.sent) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    VStack(alignment: .leading) {
                        Text("Dashboard").font(.system(size: 28, weight: .semibold)).foregroundColor(.white)
                        Text("Performance of your cold email program, at a glance.").foregroundColor(.secondary)
                    }
                    Spacer()
                    Button("Refresh") { Task { await load() } }.buttonStyle(.primary)
                }

                HStack(spacing: 12) {
                    MetricCard(label: "EMAILS SENT", value: "\(totals?.sent ?? 0)", sub: "lifetime", subColor: .secondary)
                    MetricCard(label: "OPEN RATE", value: String(format: "%.1f%%", openRate), sub: "\(totals?.opened ?? 0) opens", subColor: .appSuccess)
                    MetricCard(label: "REPLY RATE", value: String(format: "%.1f%%", replyRate), sub: "\(totals?.replied ?? 0) replies", subColor: .brandPurple)
                    MetricCard(label: "BOUNCE RATE", value: String(format: "%.1f%%", bounceRate), sub: "\(totals?.bounced ?? 0) bounces", subColor: .appDanger)
                }

                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Recent campaigns").font(.system(size: 18, weight: .semibold)).foregroundColor(.white)
                        if campaigns.isEmpty {
                            Text("No campaigns yet.").foregroundColor(.secondary)
                        } else {
                            ForEach(campaigns.prefix(5)) { c in
                                CampaignRow(c: c)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .card()

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Warming pool").font(.system(size: 18, weight: .semibold)).foregroundColor(.white)
                        if warmup.isEmpty {
                            Text("No inboxes in the warming pool yet.").foregroundColor(.secondary)
                        } else {
                            ForEach(warmup.prefix(6)) { w in
                                WarmupMiniRow(w: w)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .card()
                }

                if let error { Text(error).foregroundColor(.appDanger) }
            }
            .padding(32)
        }
        .task { await load() }
    }

    private func load() async {
        do {
            let o: AnalyticsOverview = try await api.get("/api/analytics/overview", as: AnalyticsOverview.self)
            let c: CampaignsResponse = try await api.get("/api/campaigns", as: CampaignsResponse.self)
            let w: WarmupStatsResponse = try await api.get("/api/warmup/stats", as: WarmupStatsResponse.self)
            await MainActor.run {
                totals = o.totals
                campaigns = c.campaigns
                warmup = w.inboxes
            }
        } catch {
            await MainActor.run { self.error = error.localizedDescription }
        }
    }
}

struct MetricCard: View {
    let label: String; let value: String; let sub: String; let subColor: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).font(.system(size: 11)).foregroundColor(.secondary)
            Text(value).font(.system(size: 32, weight: .semibold)).foregroundColor(.white)
            Text(sub).font(.system(size: 12)).foregroundColor(subColor)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }
}

struct CampaignRow: View {
    let c: Campaign
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(c.name).foregroundColor(.white).fontWeight(.semibold)
                Text("\(c.leadCount) leads · \(c.sentCount) sent · \(c.repliedCount) replies")
                    .font(.caption).foregroundColor(.secondary)
            }
            Spacer()
            Text(c.status.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(LinearGradient.brand).foregroundColor(.white).cornerRadius(6)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(Color.white.opacity(0.08)).cornerRadius(8)
    }
}

struct WarmupMiniRow: View {
    let w: WarmupStats
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(w.email).foregroundColor(.white).fontWeight(.semibold)
                Text("\(w.sentToday)/\(w.warmupCurrentCap) today · rep \(w.reputationScore)")
                    .font(.caption).foregroundColor(.secondary)
            }
            Spacer()
            Circle().fill(reputationColor(w.reputationScore)).frame(width: 10, height: 10)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(Color.white.opacity(0.08)).cornerRadius(8)
    }
}
