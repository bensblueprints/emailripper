using System.Windows;
using EmailRipper.Services;
using Microsoft.Extensions.DependencyInjection;

namespace EmailRipper.Views.Dialogs;

public partial class AddSmtpRelayDialog : Window
{
    public AddSmtpRelayDialog() { InitializeComponent(); }

    private void OnCancel(object sender, RoutedEventArgs e) { DialogResult = false; Close(); }

    private async void OnSave(object sender, RoutedEventArgs e)
    {
        ErrorText.Visibility = Visibility.Collapsed;
        try
        {
            int.TryParse(SmtpPortBox.Text, out var smtpPort); if (smtpPort <= 0) smtpPort = 587;
            var body = new {
                email = EmailBox.Text.Trim(),
                displayName = string.IsNullOrWhiteSpace(DisplayBox.Text) ? null : DisplayBox.Text.Trim(),
                smtpHost = SmtpHostBox.Text.Trim(),
                smtpPort,
                smtpUser = SmtpUserBox.Text.Trim(),
                smtpPass = SmtpPassBox.Password,
                smtpSecure = SmtpSecureBox.IsChecked == true,
            };
            var api = App.Services.GetRequiredService<ApiClient>();
            await api.PostAsync<object>("/api/inboxes/smtp-relay", body);
            DialogResult = true; Close();
        }
        catch (System.Exception ex)
        {
            ErrorText.Text = ex.Message;
            ErrorText.Visibility = Visibility.Visible;
        }
    }
}
