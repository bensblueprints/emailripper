import SwiftUI

// MARK: - Campaigns

struct CampaignsView: View {
    @EnvironmentObject var api: APIClient
    @State private var campaigns: [Campaign] = []
    @State private var newName = ""
    @State private var newDescription = ""
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Campaigns").font(.system(size: 28, weight: .semibold)).foregroundColor(.white)
                Text("Plan, build, and launch multi-step cold email sequences.").foregroundColor(.secondary)

                HStack {
                    TextField("Campaign name", text: $newName).textFieldStyle(.roundedBorder)
                    TextField("Description (optional)", text: $newDescription).textFieldStyle(.roundedBorder)
                    Button("Create") { Task { await create() } }.buttonStyle(.primary)
                }
                .card()

                ForEach(campaigns) { c in
                    CampaignCard(c: c) {
                        Task { _ = try? await api.post("/api/campaigns/\(c.id)/start", body: EmptyBody(), as: Empty.self); await load() }
                    } pause: {
                        Task { _ = try? await api.post("/api/campaigns/\(c.id)/pause", body: EmptyBody(), as: Empty.self); await load() }
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
            let r: CampaignsResponse = try await api.get("/api/campaigns", as: CampaignsResponse.self)
            await MainActor.run { campaigns = r.campaigns }
        } catch { await MainActor.run { self.error = error.localizedDescription } }
    }

    private func create() async {
        guard !newName.isEmpty else { return }
        struct Body: Encodable { let name: String; let description: String? }
        _ = try? await api.post("/api/campaigns", body: Body(name: newName, description: newDescription.isEmpty ? nil : newDescription), as: Empty.self)
        await MainActor.run { newName = ""; newDescription = "" }
        await load()
    }
}

struct CampaignCard: View {
    let c: Campaign
    var start: () -> Void
    var pause: () -> Void
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(c.name).font(.system(size: 16, weight: .semibold)).foregroundColor(.white)
                    Text(c.status.uppercased())
                        .font(.system(size: 11, weight: .semibold))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(LinearGradient.brand).foregroundColor(.white).cornerRadius(6)
                }
                if let d = c.description { Text(d).foregroundColor(.secondary).font(.callout) }
                Text("\(c.leadCount) leads · \(c.sentCount) sent · \(c.openedCount) opened · \(c.repliedCount) replied")
                    .font(.caption).foregroundColor(.secondary)
            }
            Spacer()
            Button("Start", action: start)
            Button("Pause", action: pause)
        }
        .card()
    }
}

struct EmptyBody: Encodable {}
struct Empty: Codable {}

// MARK: - Sequence builder

struct SequenceBuilderView: View {
    @EnvironmentObject var api: APIClient
    @State private var campaigns: [Campaign] = []
    @State private var selected: Campaign?
    @State private var steps: [SequenceStep] = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Sequence builder").font(.system(size: 28, weight: .semibold)).foregroundColor(.white)
                Text("Define the email steps, delays, and conditional branches for a campaign.").foregroundColor(.secondary)

                HStack {
                    Picker("Campaign", selection: $selected) {
                        Text("Select…").tag(Optional<Campaign>.none)
                        ForEach(campaigns) { c in Text(c.name).tag(Optional(c)) }
                    }
                    .pickerStyle(.menu)
                    Button("Add step") { steps.append(SequenceStep(stepOrder: steps.count + 1, delayDays: steps.isEmpty ? 0 : 3, condition: steps.isEmpty ? "always" : "no_reply", subject: "", bodyHtml: "", bodyText: nil)) }
                    Spacer()
                    Button("Save sequence") { Task { await save() } }.buttonStyle(.primary)
                }
                .card()

                ForEach($steps) { $step in
                    StepCard(step: $step)
                }
            }
            .padding(32)
        }
        .task { await loadCampaigns() }
        .onChange(of: selected) { _ in Task { await loadSteps() } }
    }

    func loadCampaigns() async {
        let r: CampaignsResponse? = try? await api.get("/api/campaigns", as: CampaignsResponse.self)
        await MainActor.run { campaigns = r?.campaigns ?? [] }
    }
    func loadSteps() async {
        guard let s = selected else { await MainActor.run { steps = [] }; return }
        let d: CampaignDetail? = try? await api.get("/api/campaigns/\(s.id)", as: CampaignDetail.self)
        await MainActor.run { steps = d?.steps ?? [] }
    }
    func save() async {
        guard let s = selected else { return }
        struct Body: Encodable { let campaignId: Int; let steps: [SequenceStep] }
        _ = try? await api.post("/api/sequences/replace", body: Body(campaignId: s.id, steps: steps.enumerated().map { idx, st in SequenceStep(stepOrder: idx + 1, delayDays: st.delayDays, condition: st.condition, subject: st.subject, bodyHtml: st.bodyHtml, bodyText: st.bodyText) }), as: Empty.self)
    }
}

struct StepCard: View {
    @Binding var step: SequenceStep
    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                Text("STEP").font(.caption).foregroundColor(.secondary)
                Text("\(step.stepOrder)").font(.system(size: 28, weight: .bold)).foregroundColor(.brandPurple)
                Text("Wait (days)").font(.caption).foregroundColor(.secondary)
                TextField("", value: $step.delayDays, format: .number).textFieldStyle(.roundedBorder).frame(width: 100)
                Text("Condition").font(.caption).foregroundColor(.secondary)
                Picker("", selection: $step.condition) {
                    Text("always").tag("always")
                    Text("no_reply").tag("no_reply")
                    Text("no_open").tag("no_open")
                }.frame(width: 140)
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("Subject").font(.caption).foregroundColor(.secondary)
                TextField("", text: $step.subject).textFieldStyle(.roundedBorder)
                Text("Body (HTML — variables like {{first_name}} are rendered)").font(.caption).foregroundColor(.secondary)
                TextEditor(text: $step.bodyHtml).frame(minHeight: 160).font(.system(.body, design: .monospaced))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.appBorder))
            }
        }
        .card()
    }
}

// MARK: - Leads

struct LeadsView: View {
    @EnvironmentObject var api: APIClient
    @State private var leads: [Lead] = []
    @State private var q = ""
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Leads").font(.system(size: 28, weight: .semibold)).foregroundColor(.white)
            HStack {
                TextField("Search by email, name, company…", text: $q).textFieldStyle(.roundedBorder)
                Button("Search") { Task { await load() } }.buttonStyle(.primary)
            }
            Table(leads) {
                TableColumn("Email", value: \.email)
                TableColumn("First") { Text($0.firstName ?? "") }
                TableColumn("Last") { Text($0.lastName ?? "") }
                TableColumn("Company") { Text($0.company ?? "") }
                TableColumn("Title") { Text($0.jobTitle ?? "") }
            }
        }
        .padding(32)
        .task { await load() }
    }

    private func load() async {
        let path = "/api/leads" + (q.isEmpty ? "" : "?q=\(q.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? q)")
        let r: LeadsResponse? = try? await api.get(path, as: LeadsResponse.self)
        await MainActor.run { leads = r?.leads ?? [] }
    }
}

// MARK: - Templates / Analytics / Settings

struct TemplatesView: View {
    @EnvironmentObject var api: APIClient
    @State private var templates: [Template] = []
    @State private var selected: Template?

    var body: some View {
        HSplitView {
            VStack(alignment: .leading) {
                HStack {
                    Text("Templates").font(.title2).bold().foregroundColor(.white)
                    Spacer()
                    Button("+ New") { selected = Template(id: 0, name: "Untitled", subject: "", bodyHtml: "", bodyText: nil) }
                }
                List(templates, id: \.id, selection: $selected) { t in
                    VStack(alignment: .leading) {
                        Text(t.name).foregroundColor(.white)
                        Text(t.subject).font(.caption).foregroundColor(.secondary).lineLimit(1)
                    }.tag(Optional(t))
                }
            }
            .frame(minWidth: 260).padding()

            VStack(alignment: .leading, spacing: 10) {
                if var t = selected {
                    Text("Name").font(.caption).foregroundColor(.secondary)
                    TextField("", text: Binding(get: { t.name }, set: { t.name = $0; selected = t })).textFieldStyle(.roundedBorder)
                    Text("Subject").font(.caption).foregroundColor(.secondary)
                    TextField("", text: Binding(get: { t.subject }, set: { t.subject = $0; selected = t })).textFieldStyle(.roundedBorder)
                    Text("Body HTML").font(.caption).foregroundColor(.secondary)
                    TextEditor(text: Binding(get: { t.bodyHtml }, set: { t.bodyHtml = $0; selected = t }))
                        .frame(minHeight: 240).font(.system(.body, design: .monospaced))
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.appBorder))
                    Button("Save") { Task { await save(t) } }.buttonStyle(.primary)
                } else {
                    Text("Select or create a template").foregroundColor(.secondary)
                }
            }
            .padding()
        }
        .task { await load() }
    }

    private func load() async {
        let r: TemplatesResponse? = try? await api.get("/api/templates", as: TemplatesResponse.self)
        await MainActor.run { templates = r?.templates ?? [] }
    }
    private func save(_ t: Template) async {
        struct Body: Encodable { let name: String; let subject: String; let bodyHtml: String; let bodyText: String? }
        let b = Body(name: t.name, subject: t.subject, bodyHtml: t.bodyHtml, bodyText: t.bodyText)
        _ = try? await api.post("/api/templates", body: b, as: Empty.self)
        await load()
    }
}

struct AnalyticsView: View {
    @EnvironmentObject var api: APIClient
    @State private var totals: AnalyticsTotals?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Analytics").font(.system(size: 28, weight: .semibold)).foregroundColor(.white)
            Text("Program-wide performance.").foregroundColor(.secondary)
            HStack(spacing: 10) {
                MetricCard(label: "SENT", value: "\(totals?.sent ?? 0)", sub: "", subColor: .clear)
                MetricCard(label: "OPENED", value: "\(totals?.opened ?? 0)", sub: "", subColor: .clear)
                MetricCard(label: "CLICKED", value: "\(totals?.clicked ?? 0)", sub: "", subColor: .clear)
                MetricCard(label: "REPLIED", value: "\(totals?.replied ?? 0)", sub: "", subColor: .clear)
                MetricCard(label: "BOUNCED", value: "\(totals?.bounced ?? 0)", sub: "", subColor: .clear)
            }
            Spacer()
        }
        .padding(32)
        .task {
            let o: AnalyticsOverview? = try? await api.get("/api/analytics/overview", as: AnalyticsOverview.self)
            await MainActor.run { totals = o?.totals }
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject var auth: AuthStore
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Settings").font(.system(size: 28, weight: .semibold)).foregroundColor(.white)
            VStack(alignment: .leading, spacing: 8) {
                Text("Account").font(.system(size: 18, weight: .semibold)).foregroundColor(.white)
                Text("Email").font(.caption).foregroundColor(.secondary)
                Text(auth.email ?? "—").foregroundColor(.white)
                Text("Full name").font(.caption).foregroundColor(.secondary).padding(.top, 8)
                Text(auth.fullName ?? "—").foregroundColor(.white)
            }
            .card()
            Spacer()
        }
        .padding(32)
    }
}
