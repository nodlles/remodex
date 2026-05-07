# Local Source Build

This guide is for building and running the `nodlles/remodex` fork from source for personal self-hosted use.

The fork defaults to an open-source build mode. That means locally compiled apps do not require the original maintainer's RevenueCat entitlement after the free-send trial, and they do not silently depend on an official hosted relay.

## 1. Clone the Fork

```sh
git clone https://github.com/nodlles/remodex.git
cd remodex
```

If you already have the upstream checkout and a `nodlles` remote, make sure your local `main` is aligned with the fork:

```sh
git fetch nodlles
git switch main
git reset --hard nodlles/main
```

## 2. Prerequisites

Install or verify:

- macOS for the iOS build and the background bridge service.
- Node.js 18 or newer.
- npm.
- Codex CLI in your shell `PATH`.
- Xcode 16 or newer.
- An Apple developer account or personal team for signing to a physical device.

Codex CLI install example:

```sh
npm install -g @openai/codex
```

## 3. Run the Local Doctor

From the bridge package:

```sh
cd phodex-bridge
npm install
node ./bin/remodex.js doctor
```

For machine-readable output:

```sh
node ./bin/remodex.js doctor --json
```

The doctor checks Node.js, npm, Codex CLI, Xcode availability on macOS, whether the iOS Xcode project can be loaded, and whether `REMODEX_RELAY` is configured.

A warning for `REMODEX_RELAY` is expected before you start the local launcher or export your own relay URL.

## 4. Configure the iOS Build

Create a local override file:

```sh
cd ../CodexMobile
cp BuildSupport/PrivateOverrides.xcconfig.example BuildSupport/PrivateOverrides.xcconfig
```

For a personal source build, keep:

```xcconfig
REMODEX_OPEN_SOURCE_BUILD = YES
```

This keeps app access enabled without requiring RevenueCat.

You can leave the relay empty for QR-driven/local launcher flows:

```xcconfig
PHODEX_DEFAULT_RELAY_URL =
```

If you intentionally want the app to default to one relay URL, set it here:

```xcconfig
PHODEX_DEFAULT_RELAY_URL = ws://your-host:9000/relay
```

Do not commit `PrivateOverrides.xcconfig`; it is intentionally ignored.

## 5. Open and Sign the iOS App

```sh
open CodexMobile.xcodeproj
```

In Xcode:

1. Select the `CodexMobile` target.
2. Change the Bundle Identifier to one you control, for example `com.nodlles.Remodex`.
3. Select your Team under Signing & Capabilities.
4. Let Xcode manage signing, or provide your own provisioning profile.
5. Build and run on a physical iPhone or iPad.

If you also build the menu bar companion, repeat signing checks for the `RemodexMenuBar` target.

## 6. Start Remodex Locally

The easiest local source run is the repo launcher from the repository root:

```sh
./run-local-remodex.sh
```

This starts a local relay, points the bridge at that relay, and prints the pairing QR.

If the iPhone cannot reach the default host, pass an address the phone can reach:

```sh
./run-local-remodex.sh --hostname 192.168.1.10
```

You can also run the pieces manually.

Terminal 1:

```sh
cd relay
npm install
npm start
```

Terminal 2:

```sh
cd phodex-bridge
npm install
REMODEX_RELAY="ws://localhost:9000/relay" npm start
```

For a real iPhone on the LAN, replace `localhost` with a host or IP reachable from the phone.

## 7. Pair the iPhone

1. Install and open the locally signed Remodex app.
2. Use the in-app scanner to scan the QR printed by `remodex up` or `./run-local-remodex.sh`.
3. Do not use the system Camera app for pairing; it may treat the QR payload as plain text.
4. After the first successful scan, the app stores the trusted Mac in Keychain and can reconnect through the same relay path later.

## 8. Troubleshooting

### RevenueCat or Subscription Screen Appears

Check that the app build contains:

```xcconfig
REMODEX_OPEN_SOURCE_BUILD = YES
```

Then clean and rebuild the app. In open-source build mode, RevenueCat setup is skipped and the five free-send limit is not consumed.

### Xcode or CoreSimulator Errors

Run:

```sh
cd phodex-bridge
node ./bin/remodex.js doctor
```

If doctor reports a CoreSimulator or `IDESimulatorFoundation` issue, try:

```sh
xcodebuild -runFirstLaunch
```

If needed, open Xcode manually and let it finish installing components.

Also verify the selected developer directory:

```sh
xcode-select -p
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

If Xcode reports a license issue:

```sh
sudo xcodebuild -license accept
```

### Codex CLI Not Found

Install Codex CLI and ensure it is in the same shell `PATH` used by Remodex:

```sh
npm install -g @openai/codex
codex --version
```

### `REMODEX_RELAY` Is Not Set

This is only a warning until you start a local launcher or export a relay URL.

Use one of:

```sh
./run-local-remodex.sh
```

or:

```sh
REMODEX_RELAY="ws://localhost:9000/relay" npm start
```

### iPhone Cannot Connect

Check:

- The relay URL in the QR is reachable from the iPhone.
- `localhost` is not used for a physical iPhone unless the relay also runs on the phone, which it does not.
- The Mac and iPhone are on the same LAN, VPN, or private network path.
- Port `9000` is not blocked when using the default local relay.
- The app has local network permission on iOS.

For LAN testing, prefer an explicit reachable host:

```sh
./run-local-remodex.sh --hostname 192.168.1.10
```

## 9. Source Build vs Official App Store Build

Source/fork build:

- Defaults `REMODEX_OPEN_SOURCE_BUILD` to `YES`.
- Does not require the maintainer's RevenueCat entitlement.
- Does not assume an official hosted relay.
- Expects you to run your own local/self-hosted bridge and relay path.

Official/App Store-style build:

- Can set `REMODEX_OPEN_SOURCE_BUILD = NO` in private build config.
- Uses RevenueCat entitlement checks.
- May include official hosted relay or managed push configuration.
- Should keep private endpoints and credentials out of the public repo.

## 10. Recommended Next Checks

After the app builds and installs:

```sh
cd phodex-bridge
node ./bin/remodex.js doctor
npm test
```

Then run the local launcher, pair the phone, create a test thread, and verify that a simple Codex request reaches the Mac bridge.
