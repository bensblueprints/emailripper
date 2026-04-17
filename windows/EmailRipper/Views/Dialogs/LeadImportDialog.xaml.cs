using System.Data;
using System.IO;
using System.Windows;
using EmailRipper.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Win32;

namespace EmailRipper.Views.Dialogs;

public partial class LeadImportDialog : Window
{
    private List<string[]> _rows = new();
    private string[] _headers = Array.Empty<string>();

    public LeadImportDialog() { InitializeComponent(); }

    private void OnCancel(object sender, RoutedEventArgs e) { DialogResult = false; Close(); }

    private void OnChooseFile(object sender, RoutedEventArgs e)
    {
        var dlg = new OpenFileDialog { Filter = "CSV files (*.csv)|*.csv|All files (*.*)|*.*" };
        if (dlg.ShowDialog(this) != true) return;
        try
        {
            var text = File.ReadAllText(dlg.FileName);
            var all = ParseCsv(text);
            if (all.Count < 2) { StatusText.Text = "CSV needs a header row and at least one data row."; return; }
            _headers = all[0];
            _rows = all.Skip(1).ToList();
            FileLabel.Text = $"{Path.GetFileName(dlg.FileName)} · {_rows.Count} rows";

            // Build preview DataTable
            var dt = new DataTable();
            foreach (var h in _headers) dt.Columns.Add(h);
            foreach (var r in _rows.Take(100))
            {
                var row = dt.NewRow();
                for (int i = 0; i < _headers.Length && i < r.Length; i++) row[i] = r[i];
                dt.Rows.Add(row);
            }
            PreviewGrid.ItemsSource = dt.DefaultView;
            PreviewGrid.Visibility = Visibility.Visible;

            // Fill column mappers
            var items = new List<string> { "(none)" };
            items.AddRange(_headers);
            foreach (var cb in new[] { EmailCol, FirstCol, LastCol, CompanyCol, TitleCol })
            {
                cb.ItemsSource = items;
                cb.SelectedIndex = 0;
            }
            // Best-guess auto-mapping
            EmailCol.SelectedItem   = _headers.FirstOrDefault(h => h.Contains("email", StringComparison.OrdinalIgnoreCase))   ?? "(none)";
            FirstCol.SelectedItem   = _headers.FirstOrDefault(h => h.Contains("first", StringComparison.OrdinalIgnoreCase))   ?? "(none)";
            LastCol.SelectedItem    = _headers.FirstOrDefault(h => h.Contains("last",  StringComparison.OrdinalIgnoreCase))   ?? "(none)";
            CompanyCol.SelectedItem = _headers.FirstOrDefault(h => h.Contains("company",StringComparison.OrdinalIgnoreCase) || h.Contains("organization", StringComparison.OrdinalIgnoreCase)) ?? "(none)";
            TitleCol.SelectedItem   = _headers.FirstOrDefault(h => h.Contains("title", StringComparison.OrdinalIgnoreCase) || h.Contains("position", StringComparison.OrdinalIgnoreCase)) ?? "(none)";

            MapGrid.Visibility = Visibility.Visible;
            ImportBtn.IsEnabled = true;
        }
        catch (Exception ex) { StatusText.Text = "Failed to read CSV: " + ex.Message; }
    }

    private async void OnImport(object sender, RoutedEventArgs e)
    {
        ImportBtn.IsEnabled = false;
        StatusText.Text = "Uploading…";
        try
        {
            int IdxOf(System.Windows.Controls.ComboBox cb)
            {
                if (cb.SelectedItem is null || cb.SelectedItem as string == "(none)") return -1;
                return Array.IndexOf(_headers, (string)cb.SelectedItem);
            }
            int iEmail = IdxOf(EmailCol);
            if (iEmail < 0) { StatusText.Text = "Email column is required."; ImportBtn.IsEnabled = true; return; }
            int iFirst = IdxOf(FirstCol);
            int iLast = IdxOf(LastCol);
            int iCompany = IdxOf(CompanyCol);
            int iTitle = IdxOf(TitleCol);

            var leads = new List<object>();
            foreach (var r in _rows)
            {
                if (iEmail >= r.Length) continue;
                var email = r[iEmail]?.Trim();
                if (string.IsNullOrEmpty(email) || !email.Contains('@')) continue;
                leads.Add(new
                {
                    email,
                    firstName = iFirst >= 0 && iFirst < r.Length ? r[iFirst] : null,
                    lastName  = iLast  >= 0 && iLast  < r.Length ? r[iLast]  : null,
                    company   = iCompany >= 0 && iCompany < r.Length ? r[iCompany] : null,
                    jobTitle  = iTitle >= 0 && iTitle < r.Length ? r[iTitle] : null,
                });
            }

            var api = App.Services.GetRequiredService<ApiClient>();
            // Chunk to 500 per request
            int total = 0;
            for (int i = 0; i < leads.Count; i += 500)
            {
                var chunk = leads.GetRange(i, Math.Min(500, leads.Count - i));
                var resp = await api.PostAsync<BulkResp>("/api/leads/bulk", new { leads = chunk });
                total += resp?.Inserted ?? 0;
                StatusText.Text = $"Uploaded {Math.Min(i + 500, leads.Count)} / {leads.Count}…";
            }
            StatusText.Text = $"Imported {total} leads.";
            DialogResult = true; Close();
        }
        catch (Exception ex)
        {
            StatusText.Text = "Import failed: " + ex.Message;
            ImportBtn.IsEnabled = true;
        }
    }

    private record BulkResp(int Inserted);

    // Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes, CRLF inside quotes
    private static List<string[]> ParseCsv(string text)
    {
        var rows = new List<string[]>();
        var field = new System.Text.StringBuilder();
        var row = new List<string>();
        bool inQuotes = false;
        for (int i = 0; i < text.Length; i++)
        {
            char c = text[i];
            if (inQuotes)
            {
                if (c == '"')
                {
                    if (i + 1 < text.Length && text[i + 1] == '"') { field.Append('"'); i++; }
                    else inQuotes = false;
                }
                else field.Append(c);
            }
            else
            {
                if (c == '"') inQuotes = true;
                else if (c == ',') { row.Add(field.ToString()); field.Clear(); }
                else if (c == '\r') { /* skip */ }
                else if (c == '\n') { row.Add(field.ToString()); field.Clear(); rows.Add(row.ToArray()); row.Clear(); }
                else field.Append(c);
            }
        }
        if (field.Length > 0 || row.Count > 0) { row.Add(field.ToString()); rows.Add(row.ToArray()); }
        return rows;
    }
}
