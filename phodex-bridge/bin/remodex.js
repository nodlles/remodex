#!/usr/bin/env node
// FILE: remodex.js
// Purpose: CLI surface for foreground bridge runs, pairing reset, thread resume, and macOS service control.
// Layer: CLI binary
// Exports: none
// Depends on: ../src

const {
  getMacOSBridgeServiceStatus,
  printMacOSBridgePairingQr,
  printMacOSBridgeServiceStatus,
  readBridgeConfig,
  resetMacOSBridgePairing,
  runMacOSBridgeService,
  startBridge,
  startMacOSBridgeService,
  stopMacOSBridgeService,
  resetBridgePairing,
  openLastActiveThread,
  watchThreadRollout,
} = require("../src");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { version } = require("../package.json");

const defaultDeps = {
  getMacOSBridgeServiceStatus,
  printMacOSBridgePairingQr,
  printMacOSBridgeServiceStatus,
  readBridgeConfig,
  resetMacOSBridgePairing,
  runMacOSBridgeService,
  startBridge,
  startMacOSBridgeService,
  stopMacOSBridgeService,
  resetBridgePairing,
  openLastActiveThread,
  watchThreadRollout,
  collectDoctorStatus,
};

if (require.main === module) {
  void main();
}

// ─── ENTRY POINT ─────────────────────────────────────────────

async function main({
  argv = process.argv,
  platform = process.platform,
  consoleImpl = console,
  exitImpl = process.exit,
  deps = defaultDeps,
} = {}) {
  const { command, jsonOutput, watchThreadId } = parseCliArgs(argv.slice(2));

  if (isVersionCommand(command)) {
    emitVersion({ jsonOutput, consoleImpl });
    return;
  }

  if (command === "up") {
    if (platform === "darwin") {
      consoleImpl.log("[remodex] Starting bridge and pairing QR...");
      const result = await deps.startMacOSBridgeService({
        waitForPairing: true,
      });
      deps.printMacOSBridgePairingQr({
        pairingSession: result.pairingSession,
      });
      return;
    }

    deps.startBridge();
    return;
  }

  if (command === "run") {
    deps.startBridge();
    return;
  }

  if (command === "run-service") {
    deps.runMacOSBridgeService();
    return;
  }

  if (command === "start") {
    assertMacOSCommand(command, {
      platform,
      consoleImpl,
      exitImpl,
    });
    deps.readBridgeConfig();
    const result = await deps.startMacOSBridgeService({
      waitForPairing: false,
    });
    emitResult({
      payload: {
        ok: true,
        currentVersion: version,
        plistPath: result?.plistPath,
        pairingSession: result?.pairingSession,
      },
      message: "[remodex] macOS bridge service is running.",
      jsonOutput,
      consoleImpl,
    });
    return;
  }

  if (command === "restart") {
    assertMacOSCommand(command, {
      platform,
      consoleImpl,
      exitImpl,
    });
    deps.readBridgeConfig();
    const result = await deps.startMacOSBridgeService({
      waitForPairing: false,
    });
    emitResult({
      payload: {
        ok: true,
        currentVersion: version,
        plistPath: result?.plistPath,
        pairingSession: result?.pairingSession,
      },
      message: "[remodex] macOS bridge service restarted.",
      jsonOutput,
      consoleImpl,
    });
    return;
  }

  if (command === "stop") {
    assertMacOSCommand(command, {
      platform,
      consoleImpl,
      exitImpl,
    });
    deps.stopMacOSBridgeService();
    emitResult({
      payload: {
        ok: true,
        currentVersion: version,
      },
      message: "[remodex] macOS bridge service stopped.",
      jsonOutput,
      consoleImpl,
    });
    return;
  }

  if (command === "status") {
    assertMacOSCommand(command, {
      platform,
      consoleImpl,
      exitImpl,
    });
    if (jsonOutput) {
      emitJson({
        ...deps.getMacOSBridgeServiceStatus(),
        currentVersion: version,
      });
      return;
    }
    deps.printMacOSBridgeServiceStatus();
    return;
  }

  if (command === "doctor") {
    const report = deps.collectDoctorStatus({ platform });
    if (jsonOutput) {
      emitJson(report);
      return;
    }
    printDoctorStatus(report, { consoleImpl });
    return;
  }

  if (command === "reset-pairing") {
    try {
      if (platform === "darwin") {
        deps.resetMacOSBridgePairing();
        emitResult({
          payload: {
            ok: true,
            currentVersion: version,
            platform: "darwin",
          },
          message: "[remodex] Stopped the macOS bridge service and cleared the saved pairing state. Run `remodex up` to pair again.",
          jsonOutput,
          consoleImpl,
        });
      } else {
        deps.resetBridgePairing();
        emitResult({
          payload: {
            ok: true,
            currentVersion: version,
            platform,
          },
          message: "[remodex] Cleared the saved pairing state. Run `remodex up` to pair again.",
          jsonOutput,
          consoleImpl,
        });
      }
    } catch (error) {
      consoleImpl.error(`[remodex] ${(error && error.message) || "Failed to clear the saved pairing state."}`);
      exitImpl(1);
    }
    return;
  }

  if (command === "resume") {
    try {
      const state = deps.openLastActiveThread();
      emitResult({
        payload: {
          ok: true,
          currentVersion: version,
          threadId: state.threadId,
          source: state.source || "unknown",
        },
        message: `[remodex] Opened last active thread: ${state.threadId} (${state.source || "unknown"})`,
        jsonOutput,
        consoleImpl,
      });
    } catch (error) {
      consoleImpl.error(`[remodex] ${(error && error.message) || "Failed to reopen the last thread."}`);
      exitImpl(1);
    }
    return;
  }

  if (command === "watch") {
    try {
      deps.watchThreadRollout(watchThreadId);
    } catch (error) {
      consoleImpl.error(`[remodex] ${(error && error.message) || "Failed to watch the thread rollout."}`);
      exitImpl(1);
    }
    return;
  }

  consoleImpl.error(`Unknown command: ${command}`);
  consoleImpl.error(
    "Usage: remodex up | remodex run | remodex start | remodex restart | remodex stop | remodex status | "
    + "remodex doctor | remodex reset-pairing | remodex resume | remodex watch [threadId] | remodex --version | "
    + "append --json to start/restart/stop/status/doctor/reset-pairing/resume for machine-readable output"
  );
  exitImpl(1);
}

function parseCliArgs(rawArgs) {
  const positionals = [];
  let jsonOutput = false;

  for (const arg of rawArgs) {
    if (arg === "--json") {
      jsonOutput = true;
      continue;
    }

    positionals.push(arg);
  }

  return {
    command: positionals[0] || "up",
    jsonOutput,
    watchThreadId: positionals[1] || "",
  };
}

function emitVersion({
  jsonOutput = false,
  consoleImpl = console,
} = {}) {
  if (jsonOutput) {
    emitJson({
      currentVersion: version,
    });
    return;
  }

  consoleImpl.log(version);
}

function emitResult({
  payload,
  message,
  jsonOutput = false,
  consoleImpl = console,
} = {}) {
  if (jsonOutput) {
    emitJson(payload);
    return;
  }

  consoleImpl.log(message);
}

function emitJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}


function collectDoctorStatus({
  platform = process.platform,
  env = process.env,
  execFileSyncImpl = execFileSync,
  repoRoot = path.resolve(__dirname, "..", ".."),
  existsSyncImpl = fs.existsSync,
} = {}) {
  const checks = [
    commandVersionCheck("node", ["--version"], { required: true, execFileSyncImpl }),
    commandVersionCheck("npm", ["--version"], { required: true, execFileSyncImpl }),
    commandVersionCheck("codex", ["--version"], { required: true, execFileSyncImpl }),
  ];

  if (platform === "darwin") {
    const xcodebuildCheck = commandVersionCheck("xcodebuild", ["-version"], { required: false, execFileSyncImpl });
    checks.push(xcodebuildCheck);

    const xcodeProjectPath = path.join(repoRoot, "CodexMobile", "CodexMobile.xcodeproj");
    const xcodeProjectExists = existsSyncImpl(xcodeProjectPath);
    checks.push({
      name: "CodexMobile.xcodeproj",
      ok: xcodeProjectExists,
      required: false,
      detail: xcodeProjectExists ? relativeDoctorPath(repoRoot, xcodeProjectPath) : "missing at CodexMobile/CodexMobile.xcodeproj",
      suggestion: xcodeProjectExists ? undefined : "Run doctor from a Remodex source checkout or verify the iOS project was cloned.",
    });

    if (xcodeProjectExists) {
      checks.push(xcodeProjectListCheck(xcodeProjectPath, { execFileSyncImpl }));
    }
  }

  checks.push({
    name: "REMODEX_RELAY",
    ok: Boolean((env.REMODEX_RELAY || "").trim()),
    required: false,
    detail: (env.REMODEX_RELAY || "").trim() || "not set; source builds should set this or use ./run-local-remodex.sh",
  });

  const failedRequiredChecks = checks.filter((check) => check.required && !check.ok).length;

  return {
    ok: failedRequiredChecks === 0,
    currentVersion: version,
    platform,
    checks,
  };
}

function commandVersionCheck(command, args, {
  required = false,
  execFileSyncImpl = execFileSync,
} = {}) {
  try {
    const output = String(execFileSyncImpl(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }) || "").trim();
    return {
      name: command,
      ok: true,
      required,
      detail: firstOutputLine(output) || "available",
    };
  } catch (error) {
    return {
      name: command,
      ok: false,
      required,
      detail: doctorErrorMessage(error),
    };
  }
}

function xcodeProjectListCheck(projectPath, {
  execFileSyncImpl = execFileSync,
} = {}) {
  try {
    execFileSyncImpl("xcodebuild", ["-list", "-project", projectPath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {
      name: "xcodebuild project list",
      ok: true,
      required: false,
      detail: "CodexMobile project can be loaded",
    };
  } catch (error) {
    const detail = doctorErrorMessage(error);
    return {
      name: "xcodebuild project list",
      ok: false,
      required: false,
      detail,
      suggestion: xcodeDoctorSuggestion(detail),
    };
  }
}

function xcodeDoctorSuggestion(message) {
  const normalized = String(message || "").toLowerCase();
  if (normalized.includes("coresimulator") || normalized.includes("idesimulatorfoundation")) {
    return "Open Xcode and finish installing required components, then rerun `xcodebuild -runFirstLaunch`. If it still fails, reinstall Xcode or switch xcode-select to the full Xcode app.";
  }
  if (normalized.includes("license")) {
    return "Accept the Xcode license with `sudo xcodebuild -license accept`.";
  }
  if (normalized.includes("runfirstlaunch") || normalized.includes("first launch")) {
    return "Run `xcodebuild -runFirstLaunch` or open Xcode once to complete setup.";
  }
  if (normalized.includes("xcode-select") || normalized.includes("developer directory")) {
    return "Point command line tools at Xcode with `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.";
  }
  return "Open Xcode once, ensure required components are installed, and rerun `remodex doctor`.";
}

function relativeDoctorPath(root, target) {
  const relativePath = path.relative(root, target);
  return relativePath && !relativePath.startsWith("..") ? relativePath : target;
}

function firstOutputLine(output) {
  return output.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
}

function doctorErrorMessage(error) {
  const stderr = error && error.stderr ? String(error.stderr).trim() : "";
  if (stderr) {
    return firstOutputLine(stderr);
  }
  return (error && error.message) || "not available";
}

function printDoctorStatus(report, { consoleImpl = console } = {}) {
  const hasWarnings = report.checks.some((check) => !check.ok && !check.required);
  const summary = !report.ok ? "found issues" : (hasWarnings ? "found warnings" : "passed");
  consoleImpl.log(`[remodex] Doctor ${summary} (version ${report.currentVersion})`);
  for (const check of report.checks) {
    const status = check.ok ? "ok" : (check.required ? "missing" : "warn");
    consoleImpl.log(`- ${check.name}: ${status} — ${check.detail}`);
    if (check.suggestion) {
      consoleImpl.log(`  suggestion: ${check.suggestion}`);
    }
  }
}

function assertMacOSCommand(name, {
  platform = process.platform,
  consoleImpl = console,
  exitImpl = process.exit,
} = {}) {
  if (platform === "darwin") {
    return;
  }

  consoleImpl.error(`[remodex] \`${name}\` is only available on macOS. Use \`remodex up\` or \`remodex run\` for the foreground bridge on this OS.`);
  exitImpl(1);
}

function isVersionCommand(value) {
  return value === "-v" || value === "--v" || value === "-V" || value === "--version" || value === "version";
}

module.exports = {
  collectDoctorStatus,
  isVersionCommand,
  main,
};
