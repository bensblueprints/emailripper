using System.Windows;
using EmailRipper.Services;
using EmailRipper.ViewModels;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EmailRipper;

public partial class App : Application
{
    public static IServiceProvider Services { get; private set; } = null!;

    private void OnAppStartup(object sender, StartupEventArgs e)
    {
        Configure();
        // Decide start window based on saved session
        var auth = Services.GetRequiredService<AuthStore>();
        Window start = string.IsNullOrEmpty(auth.Token)
            ? new Views.LoginWindow()
            : new Views.ShellWindow();
        start.Show();
    }

    private void Configure()
    {
        var config = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: true)
            .Build();

        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(config);
        services.AddSingleton<ApiClient>();
        services.AddSingleton<AuthStore>();
        services.AddSingleton<NavigationService>();

        services.AddTransient<LoginViewModel>();
        services.AddTransient<DashboardViewModel>();
        services.AddTransient<CampaignsViewModel>();
        services.AddTransient<SequenceBuilderViewModel>();
        services.AddTransient<LeadsViewModel>();
        services.AddTransient<InboxesViewModel>();
        services.AddTransient<WarmingViewModel>();
        services.AddTransient<TemplatesViewModel>();
        services.AddTransient<AnalyticsViewModel>();
        services.AddTransient<SettingsViewModel>();
        services.AddTransient<ShellViewModel>();

        Services = services.BuildServiceProvider();
    }
}
