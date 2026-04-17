import Foundation

struct User: Codable, Identifiable { let id: Int; let email: String; let fullName: String?; let company: String?; let plan: String }

struct LoginResponse: Codable { let user: User; let token: String }

struct Inbox: Codable, Identifiable, Hashable {
    let id: Int
    let provider: String
    let email: String
    let displayName: String?
    var warmupEnabled: Bool
    var warmupDailyMin: Int
    var warmupDailyMax: Int
    var warmupRampStep: Int
    var warmupReplyRate: Double
    var warmupCurrentCap: Int
    var dailySendLimit: Int
    var reputationScore: Int
    let status: String
    let lastError: String?
}

struct WarmupStats: Codable, Identifiable, Hashable {
    let id: Int
    let email: String
    let provider: String
    var warmupEnabled: Bool
    var warmupCurrentCap: Int
    var warmupDailyMin: Int
    var warmupDailyMax: Int
    var reputationScore: Int
    let sent14d: Int
    let replied14d: Int
    let spam14d: Int
    let rescued14d: Int
    let sentToday: Int
}

struct Campaign: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let description: String?
    let status: String
    let fromInboxId: Int?
    let fromEmail: String?
    let leadCount: Int
    let sentCount: Int
    let openedCount: Int
    let repliedCount: Int
}

struct SequenceStep: Codable, Identifiable, Hashable {
    var id: Int { stepOrder }
    var stepOrder: Int
    var delayDays: Int
    var condition: String
    var subject: String
    var bodyHtml: String
    var bodyText: String?
}

struct Template: Codable, Identifiable, Hashable {
    let id: Int
    var name: String
    var subject: String
    var bodyHtml: String
    var bodyText: String?
}

struct Lead: Codable, Identifiable, Hashable {
    let id: Int
    let email: String
    let firstName: String?
    let lastName: String?
    let company: String?
    let jobTitle: String?
    let phone: String?
    let tags: [String]
}

struct AnalyticsTotals: Codable, Hashable {
    let sent: Int; let opened: Int; let clicked: Int; let replied: Int; let bounced: Int
    let totalLeads: Int; let activeCampaigns: Int
}

struct InboxesResponse: Codable { let inboxes: [Inbox] }
struct WarmupStatsResponse: Codable { let inboxes: [WarmupStats] }
struct CampaignsResponse: Codable { let campaigns: [Campaign] }
struct CampaignDetail: Codable { let campaign: Campaign; let steps: [SequenceStep] }
struct LeadsResponse: Codable { let leads: [Lead] }
struct TemplatesResponse: Codable { let templates: [Template] }
struct AnalyticsOverview: Codable { let totals: AnalyticsTotals }
struct OAuthStart: Codable { let url: String }
