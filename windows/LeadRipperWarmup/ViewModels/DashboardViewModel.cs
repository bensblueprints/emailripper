using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using LeadRipperWarmup.Models;
using LeadRipperWarmup.Services;

namespace LeadRipperWarmup.ViewModels;

public partial class DashboardViewModel : ObservableObjectBase
{
    private readonly ApiClient _api;

    [ObservableProperty] private AnalyticsTotals? _totals;
    [ObservableProperty] private bool _busy;
    [ObservableProperty] private string? _error;

    public ObservableCollection<Campaign> RecentCampaigns { get; } = new();
    public ObservableCollection<WarmupStats> WarmupInboxes { get; } = new();

    public DashboardViewModel(ApiClient api)
    {
        _api = api;
        _ = LoadAsync();
    }

    public double OpenRate => Totals is null || Totals.Sent == 0 ? 0 : Math.Round(100.0 * Totals.Opened / Totals.Sent, 1);
    public double ReplyRate => Totals is null || Totals.Sent == 0 ? 0 : Math.Round(100.0 * Totals.Replied / Totals.Sent, 1);
    public double BounceRate => Totals is null || Totals.Sent == 0 ? 0 : Math.Round(100.0 * Totals.Bounced / Totals.Sent, 1);

    partial void OnTotalsChanged(AnalyticsTotals? value)
    {
        OnPropertyChanged(nameof(OpenRate));
        OnPropertyChanged(nameof(ReplyRate));
        OnPropertyChanged(nameof(BounceRate));
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        Busy = true; Error = null;
        try
        {
            var o = await _api.GetAsync<AnalyticsOverview>("/api/analytics/overview");
            Totals = o?.Totals;
            var c = await _api.GetAsync<CampaignsResponse>("/api/campaigns");
            RecentCampaigns.Clear();
            foreach (var x in c?.Campaigns.Take(5) ?? Enumerable.Empty<Campaign>()) RecentCampaigns.Add(x);
            var w = await _api.GetAsync<WarmupStatsResponse>("/api/warmup/stats");
            WarmupInboxes.Clear();
            foreach (var x in w?.Inboxes.Take(6) ?? Enumerable.Empty<WarmupStats>()) WarmupInboxes.Add(x);
        }
        catch (Exception e) { Error = e.Message; }
        finally { Busy = false; }
    }
}
