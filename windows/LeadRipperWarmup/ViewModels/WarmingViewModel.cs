using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using LeadRipperWarmup.Models;
using LeadRipperWarmup.Services;

namespace LeadRipperWarmup.ViewModels;

public partial class WarmingViewModel : ObservableObjectBase
{
    private readonly ApiClient _api;

    public ObservableCollection<WarmupStats> Inboxes { get; } = new();

    [ObservableProperty] private bool _busy;
    [ObservableProperty] private string? _error;

    public WarmingViewModel(ApiClient api)
    {
        _api = api;
        _ = LoadAsync();
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        Busy = true; Error = null;
        try
        {
            var r = await _api.GetAsync<WarmupStatsResponse>("/api/warmup/stats");
            Inboxes.Clear();
            foreach (var x in r?.Inboxes ?? new()) Inboxes.Add(x);
        }
        catch (Exception e) { Error = e.Message; }
        finally { Busy = false; }
    }

    [RelayCommand]
    public async Task ToggleWarmupAsync(WarmupStats inbox)
    {
        var newVal = !inbox.WarmupEnabled;
        await _api.PatchAsync<object>($"/api/inboxes/{inbox.Id}/warmup", new { warmupEnabled = newVal });
        inbox.WarmupEnabled = newVal;
        await LoadAsync();
    }

    [RelayCommand]
    public async Task SaveConfigAsync(WarmupStats inbox)
    {
        await _api.PatchAsync<object>($"/api/inboxes/{inbox.Id}/warmup", new
        {
            warmupDailyMin = inbox.WarmupDailyMin,
            warmupDailyMax = inbox.WarmupDailyMax,
            warmupRampStep = inbox.WarmupRampStep,
            warmupReplyRate = inbox.WarmupReplyRate,
            dailySendLimit = inbox.DailySendLimit
        });
    }
}
