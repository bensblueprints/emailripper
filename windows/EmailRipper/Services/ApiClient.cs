using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace EmailRipper.Services;

public class ApiClient
{
    private readonly HttpClient _http;
    private readonly AuthStore _auth;
    private readonly JsonSerializerOptions _json = new() { PropertyNameCaseInsensitive = true };

    public ApiClient(IConfiguration config, AuthStore auth)
    {
        _auth = auth;
        var baseUrl = config["Api:BaseUrl"] ?? "http://localhost:4100";
        _http = new HttpClient { BaseAddress = new Uri(baseUrl), Timeout = TimeSpan.FromSeconds(60) };
    }

    private HttpRequestMessage Build(HttpMethod m, string path, object? body = null)
    {
        var req = new HttpRequestMessage(m, path);
        if (!string.IsNullOrEmpty(_auth.Token))
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _auth.Token);
        if (body is not null) req.Content = JsonContent.Create(body);
        return req;
    }

    public async Task<T?> GetAsync<T>(string path, CancellationToken ct = default)
    {
        using var resp = await _http.SendAsync(Build(HttpMethod.Get, path), ct);
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<T>(_json, ct);
    }

    public async Task<T?> PostAsync<T>(string path, object? body, CancellationToken ct = default)
    {
        using var resp = await _http.SendAsync(Build(HttpMethod.Post, path, body), ct);
        if (!resp.IsSuccessStatusCode)
        {
            var text = await resp.Content.ReadAsStringAsync(ct);
            throw new ApiException((int)resp.StatusCode, text);
        }
        return await resp.Content.ReadFromJsonAsync<T>(_json, ct);
    }

    public async Task<T?> PatchAsync<T>(string path, object? body, CancellationToken ct = default)
    {
        using var resp = await _http.SendAsync(Build(HttpMethod.Patch, path, body), ct);
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<T>(_json, ct);
    }

    public async Task<T?> PutAsync<T>(string path, object? body, CancellationToken ct = default)
    {
        using var resp = await _http.SendAsync(Build(HttpMethod.Put, path, body), ct);
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<T>(_json, ct);
    }

    public async Task DeleteAsync(string path, CancellationToken ct = default)
    {
        using var resp = await _http.SendAsync(Build(HttpMethod.Delete, path), ct);
        resp.EnsureSuccessStatusCode();
    }
}

public class ApiException : Exception
{
    public int Status { get; }
    public ApiException(int status, string body) : base($"API {status}: {body}") { Status = status; }
}
