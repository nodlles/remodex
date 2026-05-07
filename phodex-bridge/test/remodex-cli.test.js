// FILE: remodex-cli.test.js
// Purpose: Verifies the public CLI exposes version, service control, doctor checks, and machine-readable status output.
// Layer: Integration-lite test
// Exports: node:test suite
// Depends on: node:test, node:assert/strict, child_process, path, ../package.json, ../bin/remodex

const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("child_process");
const path = require("path");
const { version } = require("../package.json");
const { collectDoctorStatus, main } = require("../bin/remodex");

test("remodex --version prints the package version", () => {
  const cliPath = path.join(__dirname, "..", "bin", "remodex.js");
  const output = execFileSync(process.execPath, [cliPath, "--version"], {
    encoding: "utf8",
  }).trim();

  assert.equal(output, version);
});

test("remodex restart reuses the macOS service start flow", async () => {
  const calls = [];
  const messages = [];

  await main({
    argv: ["node", "remodex", "restart"],
    platform: "darwin",
    consoleImpl: {
      log(message) {
        messages.push(message);
      },
      error(message) {
        messages.push(message);
      },
    },
    exitImpl(code) {
      throw new Error(`unexpected exit ${code}`);
    },
    deps: {
      readBridgeConfig() {
        calls.push("read-config");
      },
      async startMacOSBridgeService(options) {
        calls.push(["start-service", options]);
        return {
          plistPath: "/tmp/remodex.plist",
          pairingSession: { relay: "ws://127.0.0.1:9000/relay" },
        };
      },
    },
  });

  assert.deepEqual(calls, [
    "read-config",
    ["start-service", { waitForPairing: false }],
  ]);
  assert.deepEqual(messages, [
    "[remodex] macOS bridge service restarted.",
  ]);
});

test("remodex up shows a startup indicator while waiting for the pairing QR", async () => {
  const calls = [];
  const messages = [];

  await main({
    argv: ["node", "remodex", "up"],
    platform: "darwin",
    consoleImpl: {
      log(message) {
        messages.push(message);
      },
      error(message) {
        messages.push(message);
      },
    },
    exitImpl(code) {
      throw new Error(`unexpected exit ${code}`);
    },
    deps: {
      async startMacOSBridgeService(options) {
        calls.push(["start-service", options]);
        return {
          pairingSession: { pairingPayload: { sessionId: "session-up" } },
        };
      },
      printMacOSBridgePairingQr(options) {
        calls.push(["print-qr", options]);
      },
    },
  });

  assert.deepEqual(messages, [
    "[remodex] Starting bridge and pairing QR...",
  ]);
  assert.deepEqual(calls, [
    ["start-service", { waitForPairing: true }],
    ["print-qr", { pairingSession: { pairingPayload: { sessionId: "session-up" } } }],
  ]);
});

test("remodex doctor prints local environment checks", async () => {
  const messages = [];

  await main({
    argv: ["node", "remodex", "doctor"],
    platform: "darwin",
    consoleImpl: {
      log(message) {
        messages.push(message);
      },
      error(message) {
        throw new Error(`unexpected error: ${message}`);
      },
    },
    exitImpl(code) {
      throw new Error(`unexpected exit ${code}`);
    },
    deps: {
      collectDoctorStatus() {
        return {
          ok: true,
          currentVersion: version,
          platform: "darwin",
          checks: [
            { name: "node", ok: true, required: true, detail: "v25.0.0" },
            { name: "REMODEX_RELAY", ok: false, required: false, detail: "not set" },
          ],
        };
      },
    },
  });

  assert.deepEqual(messages, [
    `[remodex] Doctor found warnings (version ${version})`,
    "- node: ok — v25.0.0",
    "- REMODEX_RELAY: warn — not set",
  ]);
});

test("collectDoctorStatus reports required command failures", () => {
  const report = collectDoctorStatus({
    platform: "linux",
    env: {},
    execFileSyncImpl(command) {
      if (command === "node") {
        return "v25.0.0\n";
      }
      if (command === "npm") {
        return "11.0.0\n";
      }
      throw new Error(`missing ${command}`);
    },
  });

  assert.equal(report.ok, false);
  assert.equal(report.checks.find((check) => check.name === "node")?.ok, true);
  assert.equal(report.checks.find((check) => check.name === "codex")?.ok, false);
  assert.equal(report.checks.find((check) => check.name === "codex")?.required, true);
  assert.equal(report.checks.find((check) => check.name === "REMODEX_RELAY")?.required, false);
});

test("collectDoctorStatus checks Xcode project loading on macOS", () => {
  const calls = [];
  const report = collectDoctorStatus({
    platform: "darwin",
    env: { REMODEX_RELAY: "ws://127.0.0.1:9000/relay" },
    repoRoot: "/repo/remodex",
    existsSyncImpl(filePath) {
      return filePath === "/repo/remodex/CodexMobile/CodexMobile.xcodeproj";
    },
    execFileSyncImpl(command, args) {
      calls.push([command, args]);
      if (command === "node") return "v25.0.0\n";
      if (command === "npm") return "11.0.0\n";
      if (command === "codex") return "codex-cli 0.128.0\n";
      if (command === "xcodebuild" && args[0] === "-version") return "Xcode 26.4.1\n";
      if (command === "xcodebuild" && args[0] === "-list") return "Information about project CodexMobile:\n";
      throw new Error(`unexpected command ${command}`);
    },
  });

  assert.equal(report.ok, true);
  assert.equal(report.checks.find((check) => check.name === "CodexMobile.xcodeproj")?.ok, true);
  assert.equal(report.checks.find((check) => check.name === "xcodebuild project list")?.ok, true);
  assert.deepEqual(calls.find(([command, args]) => command === "xcodebuild" && args[0] === "-list"), [
    "xcodebuild",
    ["-list", "-project", "/repo/remodex/CodexMobile/CodexMobile.xcodeproj"],
  ]);
});

test("collectDoctorStatus explains CoreSimulator Xcode project failures", () => {
  const error = new Error("xcodebuild failed");
  error.stderr = "A required plugin failed to load. Library not loaded: /Library/Developer/PrivateFrameworks/CoreSimulator.framework/Versions/A/CoreSimulator\n";

  const report = collectDoctorStatus({
    platform: "darwin",
    env: {},
    repoRoot: "/repo/remodex",
    existsSyncImpl() {
      return true;
    },
    execFileSyncImpl(command, args) {
      if (command === "node") return "v25.0.0\n";
      if (command === "npm") return "11.0.0\n";
      if (command === "codex") return "codex-cli 0.128.0\n";
      if (command === "xcodebuild" && args[0] === "-version") return "Xcode 26.4.1\n";
      if (command === "xcodebuild" && args[0] === "-list") throw error;
      throw new Error(`unexpected command ${command}`);
    },
  });

  const projectListCheck = report.checks.find((check) => check.name === "xcodebuild project list");
  assert.equal(report.ok, true);
  assert.equal(projectListCheck?.ok, false);
  assert.match(projectListCheck?.detail || "", /CoreSimulator/);
  assert.match(projectListCheck?.suggestion || "", /xcodebuild -runFirstLaunch/);
});

test("remodex status --json exposes daemon metadata for companion apps", async () => {
  const writes = [];
  const originalWrite = process.stdout.write;

  process.stdout.write = (chunk, encoding, callback) => {
    writes.push(String(chunk));
    if (typeof callback === "function") {
      callback();
    }
    return true;
  };

  try {
    await main({
      argv: ["node", "remodex", "status", "--json"],
      platform: "darwin",
      consoleImpl: {
        log() {},
        error(message) {
          throw new Error(`unexpected error: ${message}`);
        },
      },
      exitImpl(code) {
        throw new Error(`unexpected exit ${code}`);
      },
      deps: {
        getMacOSBridgeServiceStatus() {
          return {
            daemonConfig: {
              relayUrl: "ws://127.0.0.1:9000/relay",
            },
            bridgeStatus: {
              connectionStatus: "connected",
              pid: 77,
            },
            pairingSession: {
              pairingPayload: {
                relay: "ws://127.0.0.1:9000/relay",
                sessionId: "session-json",
              },
            },
          };
        },
        printMacOSBridgeServiceStatus() {
          throw new Error("status printer should not run for --json");
        },
      },
    });
  } finally {
    process.stdout.write = originalWrite;
  }

  const payload = JSON.parse(writes.join("").trim());
  assert.equal(payload.currentVersion, version);
  assert.equal(payload.daemonConfig?.relayUrl, "ws://127.0.0.1:9000/relay");
  assert.equal(payload.bridgeStatus?.connectionStatus, "connected");
  assert.equal(payload.pairingSession?.pairingPayload?.sessionId, "session-json");
});
