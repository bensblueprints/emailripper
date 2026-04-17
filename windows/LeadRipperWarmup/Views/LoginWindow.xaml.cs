using System.Windows;
using System.Windows.Controls;
using LeadRipperWarmup.ViewModels;
using Microsoft.Extensions.DependencyInjection;

namespace LeadRipperWarmup.Views;

public partial class LoginWindow : Window
{
    private readonly LoginViewModel _vm;
    public LoginWindow()
    {
        InitializeComponent();
        _vm = App.Services.GetRequiredService<LoginViewModel>();
        DataContext = _vm;
        _vm.LoginSucceeded += () =>
        {
            var shell = new ShellWindow();
            shell.Show();
            Close();
        };
    }

    private void PwBox_OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        if (sender is PasswordBox pb) _vm.Password = pb.Password;
    }
}
