import { describe, expect, it } from "vitest";

import {
  buildStoreInstallDeviceReadinessReport,
  parseAdbDevicesOutput,
  parseXcodeDeviceOutputs,
} from "./store-install-device-readiness-check.mjs";

describe("store install device readiness check", () => {
  it("detects attached real Android devices and available iPhones", () => {
    const androidDevices = parseAdbDevicesOutput(`List of devices attached
R5CT12345AB          device product:dm3qxxx model:SM_S918B device:dm3q transport_id:1
`);
    const iosDevices = parseXcodeDeviceOutputs({
      devicectlOutput: `Name                 Hostname                             Identifier                             State       Model
------------------   ----------------------------------   ------------------------------------   ---------   --------------------------
Max iPhone           Max-iPhone.local                     15D6FDF0-FFAA-5879-84C3-723B7EAD6BFF   available   iPhone 13 Pro (iPhone14,2)
`,
      xctraceOutput: `== Devices ==
Swift Mac (FF6780D0-C1F5-5AA0-B970-FD6E9D727649)
Max iPhone (26.4.2) (00008110-000240321E29801E)
`,
    });

    expect(androidDevices).toEqual([
      {
        id: "R5CT12345AB",
        state: "device",
        description:
          "product:dm3qxxx model:SM_S918B device:dm3q transport_id:1",
      },
    ]);
    expect(iosDevices).toEqual([
      {
        name: "Max iPhone",
        state: "available",
        model: "iPhone 13 Pro (iPhone14,2)",
      },
    ]);
    expect(
      buildStoreInstallDeviceReadinessReport({
        androidDevices,
        iosDevices,
      }),
    ).toEqual({
      ok: true,
      summaries: [
        "iOS: Max iPhone is available to Xcode.",
        "Android: R5CT12345AB is attached through ADB.",
      ],
      issues: [],
      nextSteps: [],
    });
  });

  it("blocks Android emulators because Play internal proof needs a real tester device", () => {
    const androidDevices = parseAdbDevicesOutput(`List of devices attached
emulator-5554          device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:1
`);
    const iosDevices = parseXcodeDeviceOutputs({
      devicectlOutput: `Name                 Hostname                             Identifier                             State       Model
------------------   ----------------------------------   ------------------------------------   ---------   --------------------------
Max iPhone           Max-iPhone.local                     15D6FDF0-FFAA-5879-84C3-723B7EAD6BFF   available   iPhone 13 Pro (iPhone14,2)
`,
      xctraceOutput: "",
    });

    expect(
      buildStoreInstallDeviceReadinessReport({
        androidDevices,
        iosDevices,
      }),
    ).toEqual({
      ok: false,
      summaries: ["iOS: Max iPhone is available to Xcode."],
      issues: [
        "Android: emulator-5554 is an emulator; Play internal install proof needs a real tester device.",
      ],
      nextSteps: [
        "Attach a real Android tester device with Play Store access and USB debugging enabled, then rerun npm --prefix mobile run release:store-install-devices:check.",
      ],
    });
  });

  it("blocks unavailable iPhones and missing Android targets with concrete next steps", () => {
    const androidDevices = parseAdbDevicesOutput("List of devices attached\n\n");
    const iosDevices = parseXcodeDeviceOutputs({
      devicectlOutput: `Name                 Hostname                             Identifier                             State         Model
------------------   ----------------------------------   ------------------------------------   -----------   --------------------------
Max iPhone           Max-iPhone.local                     15D6FDF0-FFAA-5879-84C3-723B7EAD6BFF   unavailable   iPhone 13 Pro (iPhone14,2)
`,
      xctraceOutput: `== Devices ==
Swift Mac (FF6780D0-C1F5-5AA0-B970-FD6E9D727649)

== Devices Offline ==
Max iPhone (26.4.2) (00008110-000240321E29801E)
`,
    });

    expect(
      buildStoreInstallDeviceReadinessReport({
        androidDevices,
        iosDevices,
      }),
    ).toEqual({
      ok: false,
      summaries: [],
      issues: [
        "iOS: Max iPhone is unavailable to Xcode.",
        "Android: No attached ADB device is available for Play internal install smoke.",
      ],
      nextSteps: [
        "Unlock the iPhone, trust this Mac if prompted, keep it awake, then rerun npm --prefix mobile run release:store-install-devices:check.",
        "Attach a real Android tester device with Play Store access and USB debugging enabled, then rerun npm --prefix mobile run release:store-install-devices:check.",
      ],
    });
  });
});
