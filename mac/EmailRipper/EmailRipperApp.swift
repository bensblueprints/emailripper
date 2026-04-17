import SwiftUI

@main
struct EmailRipperApp: App {
    @StateObject private var auth = AuthStore.shared
    @StateObject private var api = APIClient.shared

    var body: some Scene {
        WindowGroup {
            ShellView()
                .environmentObject(auth)
                .environmentObject(api)
                .frame(minWidth: 1100, minHeight: 720)
                .preferredColorScheme(.dark)
        }
        .windowStyle(.hiddenTitleBar)
        .commands {
            CommandGroup(replacing: .newItem) {}
        }
    }
}
