using System.Windows;
using System.Windows.Controls;
using LeadRipperWarmup.Services;
using LeadRipperWarmup.ViewModels;
using Microsoft.Extensions.DependencyInjection;

namespace LeadRipperWarmup.Views;

public partial class ShellWindow : Window
{
    private readonly ShellViewModel _vm;
    private readonly NavigationService _nav;

    public ShellWindow()
    {
        InitializeComponent();
        _nav = App.Services.GetRequiredService<NavigationService>();
        _vm = App.Services.GetRequiredService<ShellViewModel>();
        DataContext = _vm;

        _nav.Bind(ContentFrame);
        Loaded += (_, _) => _vm.GoToDashboard();
    }

    private void NavClick(object sender, RoutedEventArgs e)
    {
        if (sender is not Button b) return;
        switch (b.Tag as string)
        {
            case "Dashboard": _vm.GoToDashboard(); break;
            case "Campaigns": _vm.GoToCampaigns(); break;
            case "Sequence": _vm.GoToSequenceBuilder(); break;
            case "Leads": _vm.GoToLeads(); break;
            case "Templates": _vm.GoToTemplates(); break;
            case "Inboxes": _vm.GoToInboxes(); break;
            case "Warming": _vm.GoToWarming(); break;
            case "Analytics": _vm.GoToAnalytics(); break;
            case "Settings": _vm.GoToSettings(); break;
        }
    }
}
