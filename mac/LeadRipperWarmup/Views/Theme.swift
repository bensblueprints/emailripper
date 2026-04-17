import SwiftUI

extension Color {
    static let appBackground = Color(red: 11/255, green: 11/255, blue: 15/255)
    static let appSidebar    = Color(red: 10/255, green: 10/255, blue: 16/255)
    static let appCard       = Color(red: 22/255, green: 22/255, blue: 29/255)
    static let appBorder     = Color.white.opacity(0.2)
    static let brandPurple   = Color(red: 124/255, green: 58/255, blue: 237/255)
    static let brandBlue     = Color(red: 37/255, green: 99/255, blue: 235/255)
    static let appSuccess    = Color(red: 16/255, green: 185/255, blue: 129/255)
    static let appWarn       = Color(red: 245/255, green: 158/255, blue: 11/255)
    static let appDanger     = Color(red: 239/255, green: 68/255, blue: 68/255)
}

extension LinearGradient {
    static let brand = LinearGradient(colors: [.brandPurple, .brandBlue], startPoint: .topLeading, endPoint: .bottomTrailing)
}

struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(20)
            .background(Color.appCard)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.appBorder, lineWidth: 1))
            .cornerRadius(12)
    }
}

extension View { func card() -> some View { modifier(CardStyle()) } }

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.horizontal, 16).padding(.vertical, 10)
            .background(LinearGradient.brand)
            .foregroundColor(.white)
            .font(.system(size: 13, weight: .semibold))
            .cornerRadius(10)
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

extension ButtonStyle where Self == PrimaryButtonStyle {
    static var primary: PrimaryButtonStyle { .init() }
}

func reputationColor(_ score: Int) -> Color {
    if score >= 80 { return .appSuccess }
    if score >= 60 { return .brandPurple }
    if score >= 40 { return .appWarn }
    return .appDanger
}
