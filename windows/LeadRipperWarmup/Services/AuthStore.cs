using System.IO;
using System.Text.Json;

namespace LeadRipperWarmup.Services;

public class AuthStore
{
    private readonly string _path;
    public string? Token { get; private set; }
    public string? Email { get; private set; }
    public string? FullName { get; private set; }

    public AuthStore()
    {
        var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LeadRipperWarmup");
        Directory.CreateDirectory(dir);
        _path = Path.Combine(dir, "auth.json");
        Load();
    }

    private void Load()
    {
        if (!File.Exists(_path)) return;
        try
        {
            var json = File.ReadAllText(_path);
            var data = JsonSerializer.Deserialize<AuthData>(json);
            if (data is null) return;
            Token = data.Token;
            Email = data.Email;
            FullName = data.FullName;
        }
        catch { }
    }

    public void Set(string token, string email, string? fullName)
    {
        Token = token; Email = email; FullName = fullName;
        File.WriteAllText(_path, JsonSerializer.Serialize(new AuthData { Token = token, Email = email, FullName = fullName }));
    }

    public void Clear()
    {
        Token = null; Email = null; FullName = null;
        if (File.Exists(_path)) File.Delete(_path);
    }

    private class AuthData
    {
        public string? Token { get; set; }
        public string? Email { get; set; }
        public string? FullName { get; set; }
    }
}
