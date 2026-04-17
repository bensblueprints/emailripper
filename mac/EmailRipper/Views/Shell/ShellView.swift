import SwiftUI

enum NavTarget: String, Hashable, CaseIterable {
    case dashboard, campaigns, sequence, leads, templates, inboxes, warming, analytics, settings

    var title: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .campaigns: return "Campaigns"
        case .sequence: return "Sequence builder"
        case .leads: return "Leads"
        case .templates: return "Templates"
        case .inboxes: return "Inboxes"
        case .warming: return "Warming"
        case .analytics: return "Analytics"
        case .settings: return "Settings"
        }
    }

    var icon: String {
        switch self {
        case .dashboard: return "chart.bar.fill"
        case .campaigns: return "envelope.badge.fill"
        case .sequence: return "arrow.triangle.branch"
        case .leads: return "person.3.fill"
        case .templates: return "doc.text.fill"
        case .inboxes: return "tray.2.fill"
        case .warming: return "flame.fill"
        case .analytics: return "chart.line.uptrend.xyaxis"
        case .settings: return "gearshape.fill"
        }
    }
}

struct ShellView: View {
    @EnvironmentObject var auth: AuthStore
    @State private var selection: NavTarget = .dashboard

    var body: some View {
        NavigationSplitView {
            SidebarView(selection: $selection)
                .navigationSplitViewColumnWidth(min: 220, ideal: 240, max: 280)
        } detail: {
            Group {
                switch selection {
                case .dashboard: DashboardView()
                case .campaigns: CampaignsView()
                case .sequence: SequenceBuilderView()
                case .leads: LeadsView()
                case .templates: TemplatesView()
                case .inboxes: InboxesView()
                case .warming: WarmingView()
                case .analytics: AnalyticsView()
                case .settings: SettingsView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.appBackground)
        }
    }
}

struct SidebarView: View {
    @Binding var selection: NavTarget
    @EnvironmentObject var auth: AuthStore

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 10)
                    .fill(LinearGradient.brand)
                    .frame(width: 36, height: 36)
                    .overlay(Text("LR").font(.system(size: 14, weight: .bold)).foregroundColor(.white))
                VStack(alignment: .leading, spacing: 0) {
                    Text("LeadRipper").font(.caption).foregroundColor(.secondary)
                    Text("Warmup").font(.system(size: 16, weight: .semibold)).foregroundColor(.white)
                }
                Spacer()
            }
            .padding(.horizontal, 20).padding(.top, 28).padding(.bottom, 20)

            ScrollView {
                VStack(spacing: 2) {
                    ForEach(NavTarget.allCases, id: \.self) { target in
                        navButton(target)
                    }
                }
                .padding(.horizontal, 12)
            }

            Spacer()

            VStack {
                HStack {
                    Circle().fill(LinearGradient.brand).frame(width: 32, height: 32)
                        .overlay(Text(String((auth.email ?? "?").prefix(1)).uppercased()).font(.system(size: 13, weight: .bold)).foregroundColor(.white))
                    VStack(alignment: .leading, spacing: 0) {
                        Text(auth.email ?? "").font(.caption).foregroundColor(.white).lineLimit(1)
                        Text("Signed in").font(.caption2).foregroundColor(.secondary)
                    }
                    Spacer()
                    Button(action: { auth.clear() }) {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                    }.buttonStyle(.plain).help("Log out")
                }
                .padding(12)
                .background(Color.appCard)
                .cornerRadius(10)
            }
            .padding(20)
        }
        .background(Color.appSidebar)
    }

    private func navButton(_ target: NavTarget) -> some View {
        Button {
            selection = target
        } label: {
            HStack(spacing: 12) {
                Image(systemName: target.icon).frame(width: 20)
                Text(target.title).font(.system(size: 13))
                Spacer()
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(selection == target ? Color.white.opacity(0.1) : .clear)
            .cornerRadius(8)
            .foregroundColor(selection == target ? .white : Color.white.opacity(0.75))
        }
        .buttonStyle(.plain)
    }
}
