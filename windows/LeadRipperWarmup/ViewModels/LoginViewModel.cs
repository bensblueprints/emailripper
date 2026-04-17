using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using LeadRipperWarmup.Models;
using LeadRipperWarmup.Services;

namespace LeadRipperWarmup.ViewModels;

public partial class LoginViewModel : ObservableObjectBase
{
    private readonly ApiClient _api;
    private readonly AuthStore _auth;

    [ObservableProperty] private string _email = "";
    [ObservableProperty] private string _password = "";
    [ObservableProperty] private string? _errorMessage;
    [ObservableProperty] private bool _busy;
    [ObservableProperty] private bool _registerMode;
    [ObservableProperty] private string? _fullName;
    [ObservableProperty] private string? _company;

    public event Action? LoginSucceeded;

    public LoginViewModel(ApiClient api, AuthStore auth) { _api = api; _auth = auth; }

    [RelayCommand]
    private async Task SubmitAsync()
    {
        Busy = true; ErrorMessage = null;
        try
        {
            var path = RegisterMode ? "/api/auth/register" : "/api/auth/login";
            var body = RegisterMode
                ? (object)new { email = Email, password = Password, fullName = FullName, company = Company }
                : new { email = Email, password = Password };
            var resp = await _api.PostAsync<LoginResponse>(path, body);
            if (resp is null) throw new Exception("empty response");
            _auth.Set(resp.Token, resp.User.Email, resp.User.FullName);
            LoginSucceeded?.Invoke();
        }
        catch (Exception e) { ErrorMessage = e.Message; }
        finally { Busy = false; }
    }

    [RelayCommand]
    private void ToggleMode() => RegisterMode = !RegisterMode;
}
