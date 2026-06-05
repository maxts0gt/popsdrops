#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function parseAdbDevicesOutput(output) {
  return String(output ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("List of devices attached"))
    .map((line) => {
      const [id, state, ...details] = line.split(/\s+/);

      return {
        id,
        state,
        description: details.join(" "),
      };
    })
    .filter((device) => device.id && device.state === "device");
}

export function parseXcodeDeviceOutputs({ devicectlOutput, xctraceOutput }) {
  const deviceRows = String(devicectlOutput ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith("Name ") &&
        !line.startsWith("-") &&
        !line.includes("MacBook"),
    );
  const parsedFromDevicectl = deviceRows
    .map((line) => {
      const state = line.includes(" unavailable ")
        ? "unavailable"
        : line.includes(" available ")
        ? "available"
        : "";
      const [namePart, rest = ""] = state ? line.split(` ${state} `) : [line, ""];
      const model = rest.trim();
      const name = namePart
        .replace(/\s+[0-9A-F-]{36}\s*$/i, "")
        .replace(/\s+\S+\.local$/i, "")
        .trim();

      return {
        name,
        state,
        model,
      };
    })
    .filter((device) => device.name && device.model.includes("iPhone"));

  if (parsedFromDevicectl.length > 0) {
    return parsedFromDevicectl;
  }

  return String(xctraceOutput ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /\biPhone\b/.test(line))
    .map((line) => ({
      name: line.replace(/\s+\([^)]+\)\s+\([^)]+\)$/, "").trim(),
      state: "available",
      model: "iPhone",
    }));
}

function isAndroidEmulator(device) {
  return (
    String(device?.id ?? "").startsWith("emulator-") ||
    /\bdevice:emu/i.test(device?.description ?? "") ||
    /\bmodel:sdk_/i.test(device?.description ?? "")
  );
}

export function buildStoreInstallDeviceReadinessReport({
  androidDevices,
  iosDevices,
}) {
  const summaries = [];
  const issues = [];
  const nextSteps = [];
  const availableIphone = iosDevices.find((device) => device.state === "available");
  const unavailableIphone = iosDevices.find(
    (device) => device.state && device.state !== "available",
  );
  const androidDevice = androidDevices.find((device) => !isAndroidEmulator(device));
  const androidEmulator = androidDevices.find(isAndroidEmulator);

  if (availableIphone) {
    summaries.push(`iOS: ${availableIphone.name} is available to Xcode.`);
  } else if (unavailableIphone) {
    issues.push(`iOS: ${unavailableIphone.name} is unavailable to Xcode.`);
    nextSteps.push(
      "Unlock the iPhone, trust this Mac if prompted, keep it awake, then rerun npm --prefix mobile run release:store-install-devices:check.",
    );
  } else {
    issues.push("iOS: No iPhone is available for TestFlight install smoke.");
    nextSteps.push(
      "Attach an iPhone signed into the TestFlight tester account, trust this Mac, then rerun npm --prefix mobile run release:store-install-devices:check.",
    );
  }

  if (androidDevice) {
    summaries.push(`Android: ${androidDevice.id} is attached through ADB.`);
  } else if (androidEmulator) {
    issues.push(
      `Android: ${androidEmulator.id} is an emulator; Play internal install proof needs a real tester device.`,
    );
    nextSteps.push(
      "Attach a real Android tester device with Play Store access and USB debugging enabled, then rerun npm --prefix mobile run release:store-install-devices:check.",
    );
  } else {
    issues.push(
      "Android: No attached ADB device is available for Play internal install smoke.",
    );
    nextSteps.push(
      "Attach a real Android tester device with Play Store access and USB debugging enabled, then rerun npm --prefix mobile run release:store-install-devices:check.",
    );
  }

  return {
    ok: issues.length === 0,
    summaries,
    issues,
    nextSteps,
  };
}

export function formatStoreInstallDeviceReadinessReport(report) {
  if (report.ok) {
    return [
      "Store install device readiness check passed.",
      ...report.summaries.map((summary) => `- ${summary}`),
    ].join("\n");
  }

  return [
    "Store install device readiness check blocked.",
    ...report.summaries.map((summary) => `- ${summary}`),
    ...report.issues.map((issue) => `- ${issue}`),
    "",
    "Next steps:",
    ...report.nextSteps.map((step) => `- ${step}`),
  ].join("\n");
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
  });

  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

export function readStoreInstallDeviceReadinessStatus() {
  const androidDevices = parseAdbDevicesOutput(
    runCommand("adb", ["devices", "-l"]),
  );
  const iosDevices = parseXcodeDeviceOutputs({
    devicectlOutput: runCommand("xcrun", ["devicectl", "list", "devices"]),
    xctraceOutput: runCommand("xcrun", ["xctrace", "list", "devices"]),
  });

  return buildStoreInstallDeviceReadinessReport({
    androidDevices,
    iosDevices,
  });
}

function run() {
  const report = readStoreInstallDeviceReadinessStatus();
  const output = formatStoreInstallDeviceReadinessReport(report);

  if (!report.ok) {
    console.error(output);
    process.exit(1);
  }

  console.log(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
