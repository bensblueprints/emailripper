using System.Windows;
using EmailRipper.Services;
using Microsoft.Extensions.DependencyInjection;

namespace EmailRipper.Views.Dialogs;

public partial class AddImapDialog : Window
{
    public AddImapDialog() { InitializeComponent(); }

    private void OnCancel(object sender, RoutedEventArgs e) { DialogResult = false; Close(); }

    private async void OnSave(object sender, RoutedEventArgs e)
    {
        ErrorText.Visibility = Visibility.Collapsed;
        try
        {
            int.TryParse(ImapPortBox.Text, out var imapPort); if (imapPort <= 0) imapPort = 993;
            int.TryParse(SmtpPortBox.Text, out var smtpPort); if (smtpPort <= 0) smtpPort = 465;
            var body = new {
                email = EmailBox.Text.Trim(),
                displayName = string.IsNullOrWhiteSpace(DisplayBox.Text) ? null : DisplayBox.Text.Trim(),
                imapHost = ImapHostBox.Text.Trim(),
                imapPort,
                imapUser = string.IsNullOrWhiteSpace(ImapUserBox.Text) ? EmailBox.Text.Trim() : ImapUserBox.Text.Trim(),
                imapPass = ImapPassBox.Password,
                smtpHost = SmtpHostBox.Text.Trim(),
                smtpPort,
                smtpUser = string.IsNullOrWhiteSpace(SmtpUserBox.Text) ? EmailBox.Text.Trim() : SmtpUserBox.Text.Trim(),
                smtpPass = SmtpPassBox.Password,
                smtpSecure = SmtpSecureBox.IsChecked == true,
            };
            var api = App.Services.GetRequiredService<ApiClient>();
            await api.PostAsync<object>("/api/inboxes/imap", body);
            DialogResult = true; Close();
        }
        catch (System.Exception ex)
        {
            ErrorText.Text = ex.Message;
            ErrorText.Visibility = Visibility.Visible;
        }
    }
}
