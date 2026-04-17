// swift-tools-version:5.9
// Use either this Swift Package for `swift run` development, or open the Xcode project for UI work.
import PackageDescription

let package = Package(
    name: "EmailRipper",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "EmailRipper", targets: ["EmailRipper"])
    ],
    targets: [
        .executableTarget(
            name: "EmailRipper",
            path: "EmailRipper"
        )
    ]
)
