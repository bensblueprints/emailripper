using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Windows;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using EmailRipper.Models;
using EmailRipper.Services;
using EmailRipper.Views.Dialogs;

namespace EmailRipper.ViewModels;

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
        try
        {
            var r = await _api.GetAsync<OAuthStartResponse>("/api/oauth/google/start");
            if (r?.Url is null) return;
            Process.Start(new ProcessStartInfo { FileName = r.Url, UseShellExecute = true });
        }
        catch (Exception e) { Error = "Gmail OAuth is not configured on the backend. Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI.\n\n" + e.Message; }
    }

    [RelayCommand]
    public async Task ConnectMicrosoftAsync()
    {
        try
        {
            var r = await _api.GetAsync<OAuthStartResponse>("/api/oauth/microsoft/start");
            if (r?.Url is null) return;
            Process.Start(new ProcessStartInfo { FileName = r.Url, UseShellExecute = true });
        }
        catch (Exception e) { Error = "Microsoft OAuth is not configured on the backend. Set MS_CLIENT_ID / MS_CLIENT_SECRET / MS_REDIRECT_URI.\n\n" + e.Message; }
    }

    [RelayCommand]
    public async Task AddImapAsync()
    {
        var dlg = new AddImapDialog { Owner = Application.Current.MainWindow };
        if (dlg.ShowDialog() == true) await LoadAsync();
    }

    [RelayCommand]
    public async Task AddSmtpRelayAsync()
    {
        var dlg = new AddSmtpRelayDialog { Owner = Application.Current.MainWindow };
        if (dlg.ShowDialog() == true) await LoadAsync();
    }

    [RelayCommand]
    public async Task DeleteAsync(Inbox inbox)
    {
        await _api.DeleteAsync($"/api/inboxes/{inbox.Id}");
        Inboxes.Remove(inbox);
    }
}
