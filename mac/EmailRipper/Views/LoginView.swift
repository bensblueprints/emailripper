import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthStore
    @EnvironmentObject var api: APIClient

    @State private var email = ""
    @State private var password = ""
    @State private var fullName = ""
    @State private var company = ""
    @State private var registerMode = false
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 20) {
                RoundedRectangle(cornerRadius: 14).fill(LinearGradient.brand)
                    .frame(width: 56, height: 56)
                    .overlay(Text("LR").font(.system(size: 20, weight: .bold)).foregroundColor(.white))

                VStack(alignment: .leading, spacing: 4) {
                    Text("Email Ripper").font(.system(size: 28, weight: .semibold)).foregroundColor(.white)
                    Text("Sign in to access your campaigns, inboxes, and warming pool.")
                        .foregroundColor(.secondary)
                }

                VStack(spacing: 10) {
                    TextField("Email address", text: $email)
                        .textFieldStyle(.roundedBorder)
                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                    if registerMode {
                        TextField("Full name", text: $fullName).textFieldStyle(.roundedBorder)
                        TextField("Company", text: $company).textFieldStyle(.roundedBorder)
                    }
                }
                .padding(.top, 8)

                if let error {
                    Text(error).foregroundColor(.appDanger).font(.callout)
                }

                Button(action: submit) {
                    HStack {
                        Spacer()
                        Text(registerMode ? "Create account" : "Sign in")
                        Spacer()
                    }
                }
                .buttonStyle(.primary)
                .disabled(busy)

                Button(registerMode ? "Have an account? Sign in" : "Create account") {
                    registerMode.toggle()
                }
                .buttonStyle(.plain)
                .foregroundColor(.brandPurple)
                .frame(maxWidth: .infinity)
            }
            .frame(width: 380)
            .padding(32)
            .background(Color.appCard)
            .cornerRadius(16)
        }
    }

    private func submit() {
        busy = true; error = nil
        Task {
            defer { busy = false }
            do {
                let path = registerMode ? "/api/auth/register" : "/api/auth/login"
                struct Body: Encodable { let email: String; let password: String; let fullName: String?; let company: String? }
                let body = Body(email: email, password: password,
                                fullName: registerMode ? fullName : nil,
                                company: registerMode ? company : nil)
                let resp: LoginResponse = try await api.post(path, body: body, as: LoginResponse.self)
                await MainActor.run {
                    auth.set(token: resp.token, email: resp.user.email, fullName: resp.user.fullName)
                }
            } catch {
                await MainActor.run { self.error = error.localizedDescription }
            }
        }
    }
}
