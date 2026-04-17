using System.Collections.ObjectModel;
using System.Diagnostics;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using LeadRipperWarmup.Models;
using LeadRipperWarmup.Services;

namespace LeadRipperWarmup.ViewModels;

public partial class InboxesViewModel : ObservableObjectBase
{
    private readonly ApiClient _api;

    public ObservableCollection<Inbox> Inboxes { get; } = new();

    [ObservableProperty] private bool _busy;
    [ObservableProperty] private string? _error;

    public InboxesViewModel(ApiClient api) { _api = api; _ = LoadAsync(); }

    [RelayCommand]
    public async Task LoadAsync()
    {
        Busy = true; Error = null;
        try
        {
            var r = await _api.GetAsync<InboxesResponse>("/api/inboxes");
            Inboxes.Clear();
            foreach (var x in r?.Inboxes ?? new()) Inboxes.Add(x);
        }
        catch (Exception e) { Error = e.Message; }
        finally { Busy = false; }
    }

    [RelayCommand]
    public async Task ConnectGmailAsync()
    {
        var r = await _api.GetAsync<OAuthStartResponse>("/api/oauth/google/start");
        if (r is null) return;
        Process.Start(new ProcessStartInfo { FileName = r.Url, UseShellExecute = true });
    }

    [RelayCommand]
    public async Task ConnectMicrosoftAsync()
    {
        var r = await _api.GetAsync<OAuthStartResponse>("/api/oauth/microsoft/start");
        if (r is null) return;
        Process.Start(new ProcessStartInfo { FileName = r.Url, UseShellExecute = true });
    }

    [RelayCommand]
    public async Task DeleteAsync(Inbox inbox)
    {
        await _api.DeleteAsync($"/api/inboxes/{inbox.Id}");
        Inboxes.Remove(inbox);
    }
}
