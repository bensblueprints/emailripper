using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using EmailRipper.Services;
using EmailRipper.Views;

namespace EmailRipper.ViewModels;

public partial class ShellViewModel : ObservableObjectBase
{
    private readonly NavigationService _nav;
    private readonly AuthStore _auth;

    [ObservableProperty] private string _activePage = "Dashboard";

    public string UserInitial => string.IsNullOrWhiteSpace(_auth.Email) ? "?" : _auth.Email![0].ToString().ToUpper();
    public string UserEmail => _auth.Email ?? "";

    public ShellViewModel(NavigationService nav, AuthStore auth)
    {
        _nav = nav; _auth = auth;
    }

    public void GoToDashboard() { ActivePage = "Dashboard"; _nav.NavigateTo<DashboardView, DashboardViewModel>(); }
    public void GoToCampaigns() { ActivePage = "Campaigns"; _nav.NavigateTo<CampaignsView, CampaignsViewModel>(); }
    public void GoToSequenceBuilder() { ActivePage = "Sequence"; _nav.NavigateTo<SequenceBuilderView, SequenceBuilderViewModel>(); }
    public void GoToLeads() { ActivePage = "Leads"; _nav.NavigateTo<LeadsView, LeadsViewModel>(); }
    public void GoToInboxes() { ActivePage = "Inboxes"; _nav.NavigateTo<InboxesView, InboxesViewModel>(); }
    public void GoToWarming() { ActivePage = "Warming"; _nav.NavigateTo<WarmingView, WarmingViewModel>(); }
    public void GoToTemplates() { ActivePage = "Templates"; _nav.NavigateTo<TemplatesView, TemplatesViewModel>(); }
    public void GoToAnalytics() { ActivePage = "Analytics"; _nav.NavigateTo<AnalyticsView, AnalyticsViewModel>(); }
    public void GoToSettings() { ActivePage = "Settings"; _nav.NavigateTo<SettingsView, SettingsViewModel>(); }

    [RelayCommand]
    public void Logout()
    {
        _auth.Clear();
        var app = (App)System.Windows.Application.Current;
        var login = new LoginWindow();
        login.Show();
        foreach (System.Windows.Window w in app.Windows)
            if (w is ShellWindow sw) sw.Close();
    }
}
