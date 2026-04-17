# Email Ripper — Windows desktop app

C# / WPF / .NET 8. Single-project solution.

## Build

```powershell
cd windows
dotnet restore
dotnet build -c Release
dotnet run --project EmailRipper
```

Or open `EmailRipper.sln` in Visual Studio 2022.

## Configure the backend

By default the app talks to `http://localhost:4100`. Change it in `EmailRipper\appsettings.json` before shipping installers, or via a future in-app settings screen.

## Project layout

```
EmailRipper/
├── App.xaml / App.xaml.cs     DI, app startup (chooses Login or Shell based on saved token)
├── Themes/Brand.xaml          Dark palette, card/metric/button styles
├── Converters/                InverseBool, ReputationColor
├── Models/Dtos.cs             DTOs matching the backend API
├── Services/
│   ├── ApiClient.cs           HTTPClient wrapper with Bearer token
│   ├── AuthStore.cs           Persisted session in %LocalAppData%\EmailRipper
│   └── NavigationService.cs   Frame-based navigation for the shell
├── ViewModels/                MVVM with CommunityToolkit.Mvvm (source-generated props)
└── Views/                     XAML screens: Shell, Login, Dashboard, Campaigns,
                               SequenceBuilder, Leads, Templates, Inboxes, Warming,
                               Analytics, Settings
```

## Packaging

For MSIX: add a Windows Application Packaging Project referencing `EmailRipper` and set the signing cert. For a portable single-file exe:

```powershell
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
```
