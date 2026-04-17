import SwiftUI

@main
struct LeadRipperWarmupApp: App {
    @StateObject private var auth = AuthStore.shared
    @StateObject private var api = APIClient.shared

    var body: some Scene {
        WindowGroup {
            Group {
                if auth.token == nil {
                    LoginView()
                } else {
                    ShellView()
                }
            }
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
