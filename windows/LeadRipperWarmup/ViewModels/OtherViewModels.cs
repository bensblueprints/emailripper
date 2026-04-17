using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using LeadRipperWarmup.Models;
using LeadRipperWarmup.Services;

namespace LeadRipperWarmup.ViewModels;

public partial class CampaignsViewModel : ObservableObjectBase
{
    private readonly ApiClient _api;
    public ObservableCollection<Campaign> Campaigns { get; } = new();
    [ObservableProperty] private string? _error;
    [ObservableProperty] private bool _busy;
    [ObservableProperty] private Campaign? _selected;
    [ObservableProperty] private string _newName = "";
    [ObservableProperty] private string? _newDescription;

    public CampaignsViewModel(ApiClient api) { _api = api; _ = LoadAsync(); }

    [RelayCommand]
    public async Task LoadAsync()
    {
        Busy = true; Error = null;
        try
        {
            var r = await _api.GetAsync<CampaignsResponse>("/api/campaigns");
            Campaigns.Clear();
            foreach (var c in r?.Campaigns ?? new()) Campaigns.Add(c);
        }
        catch (Exception e) { Error = e.Message; }
        finally { Busy = false; }
    }

    [RelayCommand]
    public async Task CreateAsync()
    {
        if (string.IsNullOrWhiteSpace(NewName)) return;
        await _api.PostAsync<object>("/api/campaigns", new { name = NewName, description = NewDescription });
        NewName = ""; NewDescription = null;
        await LoadAsync();
    }

    [RelayCommand]
    public async Task StartAsync(Campaign c)
    {
        await _api.PostAsync<object>($"/api/campaigns/{c.Id}/start", new { });
        await LoadAsync();
    }

    [RelayCommand]
    public async Task PauseAsync(Campaign c)
    {
        await _api.PostAsync<object>($"/api/campaigns/{c.Id}/pause", new { });
        await LoadAsync();
    }
}

public partial class SequenceBuilderViewModel : ObservableObjectBase
{
    private readonly ApiClient _api;
    public ObservableCollection<Campaign> Campaigns { get; } = new();
    public ObservableCollection<SequenceStep> Steps { get; } = new();
    [ObservableProperty] private Campaign? _selectedCampaign;
    [ObservableProperty] private string? _error;

    public SequenceBuilderViewModel(ApiClient api) { _api = api; _ = LoadCampaignsAsync(); }

    async Task LoadCampaignsAsync()
    {
        var r = await _api.GetAsync<CampaignsResponse>("/api/campaigns");
        Campaigns.Clear();
        foreach (var c in r?.Campaigns ?? new()) Campaigns.Add(c);
    }

    partial void OnSelectedCampaignChanged(Campaign? value)
    {
        Steps.Clear();
        if (value is null) return;
        _ = LoadStepsAsync(value.Id);
    }

    async Task LoadStepsAsync(long campaignId)
    {
        var d = await _api.GetAsync<CampaignDetail>($"/api/campaigns/{campaignId}");
        Steps.Clear();
        foreach (var s in d?.Steps ?? new()) Steps.Add(s);
    }

    [RelayCommand]
    public void AddStep()
    {
        Steps.Add(new SequenceStep
        {
            StepOrder = Steps.Count + 1,
            DelayDays = Steps.Count == 0 ? 0 : 3,
            Condition = Steps.Count == 0 ? "always" : "no_reply",
            Subject = "", BodyHtml = "",
        });
    }

    [RelayCommand]
    public async Task SaveAsync()
    {
        if (SelectedCampaign is null) return;
        await _api.PostAsync<object>("/api/sequences/replace", new
        {
            campaignId = SelectedCampaign.Id,
            steps = Steps.Select((s, i) => new {
                stepOrder = i + 1, delayDays = s.DelayDays,
                condition = s.Condition, subject = s.Subject,
                bodyHtml = s.BodyHtml, bodyText = s.BodyText
            })
        });
    }
}

public partial class LeadsViewModel : ObservableObjectBase
{
    private readonly ApiClient _api;
    public ObservableCollection<Lead> Leads { get; } = new();
    [ObservableProperty] private string _searchQuery = "";
    [ObservableProperty] private string? _error;
    [ObservableProperty] private bool _busy;

    public LeadsViewModel(ApiClient api) { _api = api; _ = LoadAsync(); }

    [RelayCommand]
    public async Task LoadAsync()
    {
        Busy = true; Error = null;
        try
        {
            var q = string.IsNullOrWhiteSpace(SearchQuery) ? "" : $"?q={Uri.EscapeDataString(SearchQuery)}";
            var r = await _api.GetAsync<LeadsResponse>($"/api/leads{q}");
            Leads.Clear();
            foreach (var l in r?.Leads ?? new()) Leads.Add(l);
        }
        catch (Exception e) { Error = e.Message; }
        finally { Busy = false; }
    }

    [RelayCommand]
    public async Task DeleteAsync(Lead l) { await _api.DeleteAsync($"/api/leads/{l.Id}"); Leads.Remove(l); }
}

public partial class TemplatesViewModel : ObservableObjectBase
{
    private readonly ApiClient _api;
    public ObservableCollection<EmailTemplate> Templates { get; } = new();
    [ObservableProperty] private EmailTemplate? _selected;
    [ObservableProperty] private string? _error;

    public TemplatesViewModel(ApiClient api) { _api = api; _ = LoadAsync(); }

    async Task LoadAsync()
    {
        var r = await _api.GetAsync<TemplatesResponse>("/api/templates");
        Templates.Clear();
        foreach (var t in r?.Templates ?? new()) Templates.Add(t);
    }

    [RelayCommand]
    public void New() { Selected = new EmailTemplate { Name = "Untitled" }; Templates.Add(Selected); }

    [RelayCommand]
    public async Task SaveAsync()
    {
        if (Selected is null) return;
        if (Selected.Id == 0)
            await _api.PostAsync<object>("/api/templates", new { name = Selected.Name, subject = Selected.Subject, bodyHtml = Selected.BodyHtml, bodyText = Selected.BodyText });
        else
            await _api.PutAsync<object>($"/api/templates/{Selected.Id}", new { name = Selected.Name, subject = Selected.Subject, bodyHtml = Selected.BodyHtml, bodyText = Selected.BodyText });
        await LoadAsync();
    }
}

public partial class AnalyticsViewModel : ObservableObjectBase
{
    private readonly ApiClient _api;
    [ObservableProperty] private AnalyticsTotals? _totals;
    public AnalyticsViewModel(ApiClient api) { _api = api; _ = LoadAsync(); }
    async Task LoadAsync()
    {
        var r = await _api.GetAsync<AnalyticsOverview>("/api/analytics/overview");
        Totals = r?.Totals;
    }
}

public partial class SettingsViewModel : ObservableObjectBase
{
    private readonly AuthStore _auth;
    [ObservableProperty] private string? _email;
    [ObservableProperty] private string? _fullName;

    public SettingsViewModel(AuthStore auth)
    {
        _auth = auth;
        Email = auth.Email;
        FullName = auth.FullName;
    }
}
