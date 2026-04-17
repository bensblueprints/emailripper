using System.Text.Json.Serialization;

namespace EmailRipper.Models;

public record User(long Id, string Email, string? FullName, string? Company, string Plan);

public record LoginResponse(User User, string Token);

public class Inbox
{
    public long Id { get; set; }
    public string Provider { get; set; } = "";
    public string Email { get; set; } = "";
    [JsonPropertyName("display_name")] public string? DisplayName { get; set; }
    [JsonPropertyName("warmup_enabled")] public bool WarmupEnabled { get; set; }
    [JsonPropertyName("warmup_daily_min")] public int WarmupDailyMin { get; set; }
    [JsonPropertyName("warmup_daily_max")] public int WarmupDailyMax { get; set; }
    [JsonPropertyName("warmup_ramp_step")] public int WarmupRampStep { get; set; }
    [JsonPropertyName("warmup_reply_rate")] public double WarmupReplyRate { get; set; }
    [JsonPropertyName("warmup_current_cap")] public int WarmupCurrentCap { get; set; }
    [JsonPropertyName("daily_send_limit")] public int DailySendLimit { get; set; }
    [JsonPropertyName("reputation_score")] public int ReputationScore { get; set; }
    public string Status { get; set; } = "active";
    [JsonPropertyName("last_error")] public string? LastError { get; set; }
}

public class WarmupStats : Inbox
{
    [JsonPropertyName("sent_14d")] public int Sent14d { get; set; }
    [JsonPropertyName("replied_14d")] public int Replied14d { get; set; }
    [JsonPropertyName("spam_14d")] public int Spam14d { get; set; }
    [JsonPropertyName("rescued_14d")] public int Rescued14d { get; set; }
    [JsonPropertyName("sent_today")] public int SentToday { get; set; }
}

public class Campaign
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string Status { get; set; } = "draft";
    [JsonPropertyName("from_inbox_id")] public long? FromInboxId { get; set; }
    [JsonPropertyName("from_email")] public string? FromEmail { get; set; }
    [JsonPropertyName("lead_count")] public int LeadCount { get; set; }
    [JsonPropertyName("sent_count")] public int SentCount { get; set; }
    [JsonPropertyName("opened_count")] public int OpenedCount { get; set; }
    [JsonPropertyName("replied_count")] public int RepliedCount { get; set; }
}

public class SequenceStep
{
    [JsonPropertyName("step_order")] public int StepOrder { get; set; }
    [JsonPropertyName("delay_days")] public int DelayDays { get; set; }
    public string Condition { get; set; } = "always";
    public string Subject { get; set; } = "";
    [JsonPropertyName("body_html")] public string BodyHtml { get; set; } = "";
    [JsonPropertyName("body_text")] public string? BodyText { get; set; }
}

public class EmailTemplate
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
    public string Subject { get; set; } = "";
    [JsonPropertyName("body_html")] public string BodyHtml { get; set; } = "";
    [JsonPropertyName("body_text")] public string? BodyText { get; set; }
}

public class Lead
{
    public long Id { get; set; }
    public string Email { get; set; } = "";
    [JsonPropertyName("first_name")] public string? FirstName { get; set; }
    [JsonPropertyName("last_name")] public string? LastName { get; set; }
    public string? Company { get; set; }
    [JsonPropertyName("job_title")] public string? JobTitle { get; set; }
    public string? Phone { get; set; }
    public string[] Tags { get; set; } = Array.Empty<string>();
}

public class AnalyticsTotals
{
    public int Sent { get; set; }
    public int Opened { get; set; }
    public int Clicked { get; set; }
    public int Replied { get; set; }
    public int Bounced { get; set; }
    [JsonPropertyName("total_leads")] public int TotalLeads { get; set; }
    [JsonPropertyName("active_campaigns")] public int ActiveCampaigns { get; set; }
}

public class SendingDomain
{
    public long Id { get; set; }
    public string Domain { get; set; } = "";
    [JsonPropertyName("warmup_enabled")] public bool WarmupEnabled { get; set; }
    [JsonPropertyName("daily_cap")] public int DailyCap { get; set; }
    [JsonPropertyName("ramp_step")] public int RampStep { get; set; }
    [JsonPropertyName("current_cap")] public int CurrentCap { get; set; }
    [JsonPropertyName("max_cap")] public int MaxCap { get; set; }
    [JsonPropertyName("dkim_selector")] public string? DkimSelector { get; set; }
    [JsonPropertyName("spf_status")] public string? SpfStatus { get; set; }
    [JsonPropertyName("spf_record")] public string? SpfRecord { get; set; }
    [JsonPropertyName("dkim_status")] public string? DkimStatus { get; set; }
    [JsonPropertyName("dkim_record")] public string? DkimRecord { get; set; }
    [JsonPropertyName("dmarc_status")] public string? DmarcStatus { get; set; }
    [JsonPropertyName("dmarc_record")] public string? DmarcRecord { get; set; }
    [JsonPropertyName("reputation_score")] public int ReputationScore { get; set; }
    [JsonPropertyName("last_checked_at")] public DateTime? LastCheckedAt { get; set; }
    [JsonPropertyName("inbox_count")] public int InboxCount { get; set; }
}

public record DomainsResponse(List<SendingDomain> Domains);
public record DomainResponse(SendingDomain Domain);

public record InboxesResponse(List<Inbox> Inboxes);
public record WarmupStatsResponse(List<WarmupStats> Inboxes);
public record CampaignsResponse(List<Campaign> Campaigns);
public record LeadsResponse(List<Lead> Leads);
public record TemplatesResponse(List<EmailTemplate> Templates);
public record CampaignDetail(Campaign Campaign, List<SequenceStep> Steps);
public record AnalyticsOverview(AnalyticsTotals Totals);
public record OAuthStartResponse(string Url);
