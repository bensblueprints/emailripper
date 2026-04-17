# Email Ripper — Mac desktop app

SwiftUI, macOS 13+. Pure Swift Package — open in Xcode or build from the CLI.

## Build & run

```bash
cd mac
swift run
```

Or in Xcode:

1. File → Open → select the `mac/` folder
2. Scheme: `EmailRipper`
3. Run

## Configure the backend

The app reads `EMAILRIPPER_BASE_URL` from the environment at launch; defaults to `http://localhost:4100`. To point at a different backend during development:

```bash
EMAILRIPPER_BASE_URL=https://warmup.leadripper.com swift run
```

Or set it in the scheme's environment variables in Xcode.

## Source layout

```
EmailRipper/
├── EmailRipperApp.swift     App entry, Login vs Shell split
├── Services/
│   ├── AuthStore.swift           Persistent session in Application Support
│   └── APIClient.swift           async URLSession client with Bearer auth
├── Models/Dtos.swift             Mirrors the backend JSON
├── Views/
│   ├── Theme.swift               Dark palette, brand gradient, card / button styles
│   ├── LoginView.swift
│   ├── Shell/ShellView.swift     NavigationSplitView sidebar
│   ├── DashboardView.swift
│   ├── WarmingView.swift
│   ├── InboxesView.swift
│   └── OtherViews.swift          Campaigns, Sequence builder, Leads, Templates, Analytics, Settings
└── Info.plist
```

## Packaging

For a signed .app bundle, create an Xcode app target (this repo uses Swift Package structure for cross-platform repo-browsing on Windows), drag the `EmailRipper/` Swift files in, and enable the App Sandbox capability with "Outgoing Connections (Client)" checked.
