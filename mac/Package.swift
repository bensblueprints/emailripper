// swift-tools-version:5.9
// Use either this Swift Package for `swift run` development, or open the Xcode project for UI work.
import PackageDescription

let package = Package(
    name: "LeadRipperWarmup",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "LeadRipperWarmup", targets: ["LeadRipperWarmup"])
    ],
    targets: [
        .executableTarget(
            name: "LeadRipperWarmup",
            path: "LeadRipperWarmup"
        )
    ]
)
