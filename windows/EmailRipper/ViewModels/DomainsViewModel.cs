using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using EmailRipper.Models;
using EmailRipper.Services;

namespace EmailRipper.ViewModels;

public partial class DomainsViewModel : ObservableObjectBase
{
    private readonly ApiClient _api;

    public ObservableCollection<SendingDomain> Domains { get; } = new();

    [ObservableProperty] private bool _busy;
    [ObservableProperty] private string? _error;
    [ObservableProperty] private string _newDomain = "";
    [ObservableProperty] private string _newSelector = "";

    public DomainsViewModel(ApiClient api) { _api = api; _ = LoadAsync(); }

    [RelayCommand]
    public async Task LoadAsync()
    {
        Busy = true; Error = null;
        try
        {
            var r = await _api.GetAsync<DomainsResponse>("/api/domains");
            Domains.Clear();
            foreach (var d in r?.Domains ?? new()) Domains.Add(d);
        }
        catch (Exception e) { Error = e.Message; }
        finally { Busy = false; }
    }

    [RelayCommand]
    public async Task SyncFromInboxesAsync()
    {
        try
        {
            await _api.PostAsync<DomainsResponse>("/api/domains/sync", new { });
            await LoadAsync();
        }
        catch (Exception e) { Error = e.Message; }
    }

    [RelayCommand]
    public async Task AddAsync()
    {
        if (string.IsNullOrWhiteSpace(NewDomain)) return;
        try
        {
            await _api.PostAsync<DomainResponse>("/api/domains", new {
                domain = NewDomain.Trim().ToLowerInvariant(),
                dkimSelector = string.IsNullOrWhiteSpace(NewSelector) ? null : NewSelector.Trim(),
            });
            NewDomain = ""; NewSelector = "";
            await LoadAsync();
        }
        catch (Exception e) { Error = e.Message; }
    }

    [RelayCommand]
    public async Task CheckAsync(SendingDomain d)
    {
        try
        {
            var r = await _api.PostAsync<DomainResponse>($"/api/domains/{d.Id}/check", new { });
            if (r?.Domain is null) return;
            int idx = Domains.IndexOf(d);
            if (idx >= 0) Domains[idx] = r.Domain;
        }
        catch (Exception e) { Error = e.Message; }
    }

    [RelayCommand]
    public async Task ToggleWarmupAsync(SendingDomain d)
    {
        try
        {
            var r = await _api.PatchAsync<DomainResponse>($"/api/domains/{d.Id}", new { warmupEnabled = !d.WarmupEnabled });
            if (r?.Domain is null) return;
            int idx = Domains.IndexOf(d);
            if (idx >= 0) Domains[idx] = r.Domain;
        }
        catch (Exception e) { Error = e.Message; }
    }

    [RelayCommand]
    public async Task DeleteAsync(SendingDomain d)
    {
        await _api.DeleteAsync($"/api/domains/{d.Id}");
        Domains.Remove(d);
    }
}
