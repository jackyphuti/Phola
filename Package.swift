// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "Phola",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        // An xtool project must contain exactly one library product representing the main app.
        .library(
            name: "Phola",
            targets: ["Phola"]
        ),
    ],
    targets: [
        .target(
            name: "Phola",
            path: "Sources/Phola"
        ),
    ]
)
