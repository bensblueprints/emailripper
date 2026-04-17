using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace LeadRipperWarmup.Converters;

public class InverseBoolConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        => value is bool b ? !b : DependencyProperty.UnsetValue;
    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => value is bool b ? !b : DependencyProperty.UnsetValue;
}

public class ReputationColorConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is int score)
        {
            if (score >= 80) return System.Windows.Application.Current.Resources["SuccessBrush"]!;
            if (score >= 60) return System.Windows.Application.Current.Resources["AccentBrush"]!;
            if (score >= 40) return System.Windows.Application.Current.Resources["WarnBrush"]!;
            return System.Windows.Application.Current.Resources["DangerBrush"]!;
        }
        return DependencyProperty.UnsetValue;
    }
    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) => DependencyProperty.UnsetValue;
}
