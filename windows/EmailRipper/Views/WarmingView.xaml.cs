using System.Windows;
using System.Windows.Controls;
using EmailRipper.Models;
using EmailRipper.ViewModels;

namespace EmailRipper.Views;

public partial class WarmingView : UserControl
{
    public WarmingView() { InitializeComponent(); }

    private void ToggleClicked(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is WarmupStats inbox && DataContext is WarmingViewModel vm)
            _ = vm.ToggleWarmupAsync(inbox);
    }

    private void SaveClicked(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.Tag is WarmupStats inbox && DataContext is WarmingViewModel vm)
            _ = vm.SaveConfigAsync(inbox);
    }
}
