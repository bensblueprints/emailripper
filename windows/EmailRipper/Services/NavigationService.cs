using System.Windows.Controls;
using EmailRipper.ViewModels;
using Microsoft.Extensions.DependencyInjection;

namespace EmailRipper.Services;

public class NavigationService
{
    private readonly IServiceProvider _sp;
    private Frame? _frame;

    public NavigationService(IServiceProvider sp) { _sp = sp; }

    public void Bind(Frame frame) => _frame = frame;

    public void NavigateTo<TView>() where TView : UserControl
    {
        if (_frame is null) return;
        var view = ActivatorUtilities.CreateInstance<TView>(_sp);
        _frame.Navigate(view);
    }

    public void NavigateTo<TView, TVm>() where TView : UserControl where TVm : ObservableObjectBase
    {
        if (_frame is null) return;
        var view = Activator.CreateInstance<TView>();
        view.DataContext = _sp.GetRequiredService<TVm>();
        _frame.Navigate(view);
    }
}
