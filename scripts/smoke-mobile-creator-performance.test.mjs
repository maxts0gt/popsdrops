import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_MOBILE_CREATOR_PERFORMANCE_CAMPAIGN_ID,
  EXPO_GO_CLEAR_ATTEMPTS,
  ANDROID_NOT_RESPONDING_TEXT,
  EXPO_DEV_CLIENT_PACKAGE,
  EXPO_GO_PACKAGE,
  INPUT_FOCUS_ATTEMPTS,
  INPUT_FOCUS_SETTLE_MS,
  MOBILE_BOOT_TIMEOUT_MS,
  MOBILE_NETWORK_PROBE_INTERVAL_MS,
  MOBILE_NETWORK_READY_TIMEOUT_MS,
  MOBILE_SMOKE_CONFLICTING_APP_PACKAGES,
  MOBILE_SMOKE_NETWORK_HOST,
  MOBILE_SMOKE_APP_PACKAGES,
  SUBMIT_SCROLL_ATTEMPTS,
  buildAdbExecOptions,
  buildDeviceShellQuotedStartCommand,
  buildAndroidDigitKeyEvents,
  buildAndroidWifiDisableCommand,
  buildExpoAndroidBundleWarmupUrl,
  buildExpoBundleWarmupUrl,
  buildExpoDevMenuFallbackCloseTapCommand,
  buildExpoDevMenuFallbackContinueTapCommand,
  buildExpoGoOverlayPermissionCommand,
  buildExpoGoForceStopCommand,
  buildExpoStartArgs,
  buildMissingTypedValueSuffix,
  buildMobileCreatorPerformanceSmokeTargets,
  buildMobilePerformanceSmokeReportTaskInsert,
  buildMobileSmokeConflictingAppUninstallCommands,
  buildMobileSmokeForceStopCommands,
  buildMobileSmokeNetworkProbeCommands,
  buildMobileSmokeOverlayPermissionCommands,
  escapeAdbInputText,
  findInputBelowLabel,
  getMetroCachePath,
  getMobileSmokeTempDir,
  isAndroidEmulatorSerial,
  isUiAutomatorHierarchyDump,
  parseBounds,
  shouldClearExpoGoForSmoke,
  shouldDisableAndroidWifiForSmoke,
  validateMobileCreatorPerformanceDbState,
  validateMobileCreatorPerformanceResidue,
} from "./smoke-mobile-creator-performance.mjs";

describe("mobile creator performance smoke contract", () => {
  it("targets Expo Go, the creator auth callback, and the submit tab", () => {
    expect(buildMobileCreatorPerformanceSmokeTargets({})).toEqual({
      adbSerial: "emulator-5554",
      campaignId: DEFAULT_MOBILE_CREATOR_PERFORMANCE_CAMPAIGN_ID,
      expoUrl: "exp://10.0.2.2:8082",
      authCallbackUrl: "exp://10.0.2.2:8082/--/auth/callback",
      campaignRoomUrl: `exp://10.0.2.2:8082/--/campaign-room/${DEFAULT_MOBILE_CREATOR_PERFORMANCE_CAMPAIGN_ID}?tab=submit`,
      screenshotPath: "output/android/mobile-creator-performance-smoke.png",
    });
  });

  it("uses a disposable campaign id that Postgres accepts as a UUID", () => {
    expect(DEFAULT_MOBILE_CREATOR_PERFORMANCE_CAMPAIGN_ID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("seeds a needs-revision task as an already submitted correction request", () => {
    const task = buildMobilePerformanceSmokeReportTaskInsert({
      reportTaskId: "11111111-1111-4111-8111-111111111111",
      campaignId: "22222222-2222-4222-8222-222222222222",
      memberId: "33333333-3333-4333-8333-333333333333",
    });

    expect(task).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      campaign_id: "22222222-2222-4222-8222-222222222222",
      campaign_member_id: "33333333-3333-4333-8333-333333333333",
      status: "needs_revision",
      review_note: "Please upload the full analytics screen from native insights.",
    });
    expect(Date.parse(task.submitted_at)).not.toBeNaN();
  });

  it("allows enough time for a cold Expo Go launch after clearing app data", () => {
    expect(MOBILE_BOOT_TIMEOUT_MS).toBeGreaterThanOrEqual(180000);
    expect(INPUT_FOCUS_SETTLE_MS).toBeGreaterThanOrEqual(1000);
    expect(INPUT_FOCUS_ATTEMPTS).toBeGreaterThanOrEqual(3);
    expect(SUBMIT_SCROLL_ATTEMPTS).toBeGreaterThanOrEqual(10);
  });

  it("clears Expo Go app data by default so cached update manifests cannot poison release smoke", () => {
    expect(EXPO_GO_CLEAR_ATTEMPTS).toBeGreaterThanOrEqual(2);
    expect(shouldClearExpoGoForSmoke({})).toBe(true);
    expect(shouldClearExpoGoForSmoke({ SMOKE_MOBILE_CLEAR_EXPO_GO: "0" })).toBe(
      false,
    );
    expect(EXPO_GO_PACKAGE).toBe("host.exp.exponent");
    expect(EXPO_DEV_CLIENT_PACKAGE).toBe("com.tengrivertex.popsdrops");
    expect(MOBILE_SMOKE_APP_PACKAGES).toEqual([
      "host.exp.exponent",
      "com.tengrivertex.popsdrops",
    ]);
    expect(MOBILE_SMOKE_CONFLICTING_APP_PACKAGES).toContain(
      "com.getbabyapp.mobile",
    );
    expect(buildExpoGoForceStopCommand()).toBe("am force-stop host.exp.exponent");
    expect(buildExpoGoOverlayPermissionCommand()).toBe(
      "appops set host.exp.exponent SYSTEM_ALERT_WINDOW allow",
    );
    expect(buildExpoGoOverlayPermissionCommand("ignore")).toBe(
      "appops set host.exp.exponent SYSTEM_ALERT_WINDOW ignore",
    );
    expect(buildMobileSmokeForceStopCommands()).toEqual([
      "am force-stop host.exp.exponent",
      "am force-stop com.tengrivertex.popsdrops",
    ]);
    expect(buildMobileSmokeOverlayPermissionCommands("ignore")).toEqual([
      "appops set host.exp.exponent SYSTEM_ALERT_WINDOW ignore",
      "appops set com.tengrivertex.popsdrops SYSTEM_ALERT_WINDOW ignore",
    ]);
    expect(buildMobileSmokeConflictingAppUninstallCommands()).toEqual([
      "pm uninstall --user 0 com.getbabyapp.mobile",
      "pm uninstall com.getbabyapp.mobile",
    ]);
    expect(
      readFileSync(
        new URL("./smoke-mobile-creator-performance.mjs", import.meta.url),
        "utf8",
      ),
    ).toContain("Unknown package|Failed|not installed");
  });

  it("preflights Android network before opening auth-dependent mobile screens", () => {
    expect(MOBILE_NETWORK_READY_TIMEOUT_MS).toBeGreaterThanOrEqual(60000);
    expect(MOBILE_NETWORK_PROBE_INTERVAL_MS).toBeGreaterThanOrEqual(1000);
    expect(MOBILE_SMOKE_NETWORK_HOST).toBe("apgymcbtimoyywavqfja.supabase.co");
    expect(buildMobileSmokeNetworkProbeCommands()).toEqual([
      "ip route",
      "ping -c 1 apgymcbtimoyywavqfja.supabase.co",
    ]);

    const source = readFileSync(
      new URL("./smoke-mobile-creator-performance.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("ensureAndroidNetwork");
    expect(source).toContain("network did not become ready");
    expect(source).toContain("route table is still empty");
    expect(source).toMatch(
      /await stabilizeAndroidEmulatorNetworkForSmoke\(targets\.adbSerial\)[\s\S]+await ensureAndroidNetwork\(targets\.adbSerial\)/,
    );
    expect(source).toMatch(
      /await ensureAndroidDevice\(targets\.adbSerial\)[\s\S]+await ensureAndroidNetwork\(targets\.adbSerial\)/,
    );
  });

  it("does not disable emulator Wi-Fi unless the smoke explicitly opts in", () => {
    expect(isAndroidEmulatorSerial("emulator-5554")).toBe(true);
    expect(isAndroidEmulatorSerial("R5CT12345")).toBe(false);
    expect(buildAndroidWifiDisableCommand()).toBe("svc wifi disable");
    expect(shouldDisableAndroidWifiForSmoke({})).toBe(false);
    expect(
      shouldDisableAndroidWifiForSmoke({
        SMOKE_MOBILE_DISABLE_ANDROID_WIFI: "1",
      }),
    ).toBe(true);

    const source = readFileSync(
      new URL("./smoke-mobile-creator-performance.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("stabilizeAndroidEmulatorNetworkForSmoke");
    expect(source).toContain("shouldDisableAndroidWifiForSmoke");
  });

  it("quotes Android deep links so refresh tokens and tab params survive shell launch", () => {
    const command = buildDeviceShellQuotedStartCommand(
      "exp://10.0.2.2:8082/--/auth/callback?access_token=a&refresh_token=b&expires_in=3600",
    );

    expect(command).toContain("-n host.exp.exponent/.LauncherActivity");
    expect(command).not.toContain("-p host.exp.exponent");
    expect(command).not.toContain("-W");
    expect(command).toContain("-d 'exp://10.0.2.2:8082/--/auth/callback");
    expect(command).toContain("refresh_token=b&expires_in=3600'");
  });

  it("captures Android screenshots as binary buffers", () => {
    expect(buildAdbExecOptions({ timeoutMs: 1234, binary: true })).toMatchObject({
      timeout: 1234,
      encoding: "buffer",
    });
    expect(buildAdbExecOptions({ timeoutMs: 1234 })).toMatchObject({
      timeout: 1234,
      encoding: "utf8",
    });
  });

  it("keeps URL punctuation intact when typing through adb", () => {
    expect(escapeAdbInputText("https://example.com/native-proof")).toBe(
      "https://example.com/native-proof",
    );
    expect(escapeAdbInputText("proof link")).toBe("proof%slink");
    expect(escapeAdbInputText("100% confirmed")).toBe("100\\%%sconfirmed");
  });

  it("can recover when Android text injection leaves a URL prefix in the field", () => {
    expect(
      buildMissingTypedValueSuffix({
        actual: "https://example.com/nat",
        expected: "https://example.com/native-proof",
      }),
    ).toBe("ive-proof");
    expect(
      buildMissingTypedValueSuffix({
        actual: "https://example.com/native-proof",
        expected: "https://example.com/native-proof",
      }),
    ).toBe("");
    expect(
      buildMissingTypedValueSuffix({
        actual: "proof",
        expected: "https://example.com/native-proof",
      }),
    ).toBeNull();
  });

  it("uses Android digit key events for number-pad metrics", () => {
    expect(buildAndroidDigitKeyEvents("4321")).toEqual([
      "KEYCODE_4",
      "KEYCODE_3",
      "KEYCODE_2",
      "KEYCODE_1",
    ]);
    expect(() => buildAndroidDigitKeyEvents("42x")).toThrow(/digits/i);
  });

  it("ignores clipped Android nodes with invalid bounds", () => {
    expect(parseBounds("[102,2397][978,2361]")).toBeNull();
    expect(parseBounds("[102,1649][382,1756]")).toMatchObject({
      x: 242,
      y: 1703,
    });
  });

  it("targets the input that belongs to a visible metric label", () => {
    const nodes = [
      {
        className: "android.widget.TextView",
        text: "Views",
        contentDescription: "",
        bounds: { x1: 102, y1: 1297, x2: 382, y2: 1340, x: 242, y: 1319 },
      },
      {
        className: "android.widget.EditText",
        text: "0",
        contentDescription: "",
        bounds: { x1: 102, y1: 1349, x2: 382, y2: 1457, x: 242, y: 1403 },
      },
      {
        className: "android.widget.TextView",
        text: "Proof link",
        contentDescription: "",
        bounds: { x1: 102, y1: 1868, x2: 978, y2: 1914, x: 540, y: 1891 },
      },
      {
        className: "android.widget.EditText",
        text: "Optional analytics or export link",
        contentDescription: "",
        bounds: { x1: 102, y1: 1932, x2: 978, y2: 2061, x: 540, y: 1997 },
      },
    ];

    expect(findInputBelowLabel(nodes, "Views")?.bounds).toMatchObject({
      x: 242,
      y: 1403,
    });
    expect(findInputBelowLabel(nodes, "Proof link")?.bounds).toMatchObject({
      x: 540,
      y: 1997,
    });
  });

  it("starts Expo online after owning Metro cache cleanup in the smoke script", () => {
    const args = buildExpoStartArgs(8082);

    expect(args).toEqual([
      "--prefix",
      "mobile",
      "run",
      "start",
      "--",
      "--port",
      "8082",
      "--go",
    ]);
    expect(args).not.toContain("--offline");
    expect(args).not.toContain("--clear");
    expect(getMetroCachePath("/tmp/popsdrops-smoke")).toBe(
      "/tmp/popsdrops-smoke/metro-cache",
    );
  });

  it("warms the Android bundle before opening Expo Go so cold Metro does not race native boot", () => {
    expect(buildExpoAndroidBundleWarmupUrl("exp://10.0.2.2:8083")).toBe(
      "http://127.0.0.1:8083/index.ts.bundle?platform=android&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=0&transform.routerRoot=app&unstable_transformProfile=hermes-stable",
    );
    expect(buildExpoBundleWarmupUrl("exp://127.0.0.1:8085", "ios")).toBe(
      "http://127.0.0.1:8085/index.ts.bundle?platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=0&transform.routerRoot=app&unstable_transformProfile=hermes-stable",
    );
    expect(getMobileSmokeTempDir("ios")).toBe(
      "output/ios/tmp",
    );

    const source = readFileSync(
      new URL("./smoke-mobile-creator-performance.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toMatch(/await warmExpoBundle\(targets, options\)[\s\S]+return \{ started: false/);
    expect(source).toMatch(/await warmExpoBundle\(targets, options\)[\s\S]+started: true/);
    expect(source).toContain('platform = "android"');
    expect(source).toContain('REACT_NATIVE_PACKAGER_HOSTNAME: packagerHostname');
  });

  it("rejects a mobile submit smoke without normalized metric values", () => {
    expect(() =>
      validateMobileCreatorPerformanceDbState({
        performanceRows: [
          {
            id: "performance-1",
            views: 4321,
            verification_status: "submitted",
            screenshot_url: "https://example.com/native-proof",
          },
        ],
        metricRows: [],
        taskRows: [{ status: "submitted" }],
      }),
    ).toThrow(/normalized views/i);
  });

  it("rejects unconfirmed normalized metric values from mobile submit", () => {
    expect(() =>
      validateMobileCreatorPerformanceDbState({
        performanceRows: [
          {
            id: "performance-1",
            views: 4321,
            verification_status: "submitted",
            screenshot_url: "https://example.com/native-proof",
          },
        ],
        metricRows: [
          {
            performance_id: "performance-1",
            metric_key: "views",
            metric_value: 4321,
            source_type: "creator_manual",
            confirmed_by_creator: false,
          },
        ],
        taskRows: [{ status: "submitted" }],
      }),
    ).toThrow(/creator-confirmed normalized views/i);
  });

  it("accepts the intended mobile performance proof database state", () => {
    expect(
      validateMobileCreatorPerformanceDbState({
        performanceRows: [
          {
            id: "performance-1",
            views: 4321,
            verification_status: "submitted",
            screenshot_url: "https://example.com/native-proof",
          },
        ],
        metricRows: [
          {
            performance_id: "performance-1",
            metric_key: "views",
            metric_value: 4321,
            source_type: "creator_manual",
            confirmed_by_creator: true,
          },
        ],
        taskRows: [{ status: "submitted", review_note: null }],
      }),
    ).toEqual({ ok: true });
  });

  it("rejects mobile correction resubmissions that leave stale brand review notes", () => {
    expect(() =>
      validateMobileCreatorPerformanceDbState({
        performanceRows: [
          {
            id: "performance-1",
            views: 4321,
            verification_status: "submitted",
            screenshot_url: "https://example.com/native-proof",
          },
        ],
        metricRows: [
          {
            performance_id: "performance-1",
            metric_key: "views",
            metric_value: 4321,
            source_type: "creator_manual",
            confirmed_by_creator: true,
          },
        ],
        taskRows: [
          {
            status: "submitted",
            review_note: "Please upload the full analytics screen.",
          },
        ],
      }),
    ).toThrow(/stale correction note/i);
  });

  it("proves mobile smoke starts from a correction request and waits for the note before resubmitting", () => {
    const source = readFileSync(
      new URL("./smoke-mobile-creator-performance.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("MOBILE_REPORT_CORRECTION_NOTE");
    expect(source).toContain('status: "needs_revision"');
    expect(source).toContain("review_note: MOBILE_REPORT_CORRECTION_NOTE");
    expect(source).toContain('await scrollUntilText(adbSerial, "Proof correction requested"');
    expect(source).toContain("await scrollUntilText(adbSerial, MOBILE_REPORT_CORRECTION_NOTE");
    expect(source).toContain('select("id, status, review_note")');
  });

  it("exports shared smoke data helpers for platform-specific native proof checks", () => {
    const source = readFileSync(
      new URL("./smoke-mobile-creator-performance.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain(
      "export async function setupMobileCreatorPerformanceSmokeData",
    );
    expect(source).toContain("export async function waitForPerformanceDbState");
  });

  it("fails cleanup verification if any smoke data remains", () => {
    expect(() =>
      validateMobileCreatorPerformanceResidue({
        campaignCount: 0,
        memberCount: 1,
        submissionCount: 0,
        reportTaskCount: 0,
        performanceCount: 0,
        metricCount: 0,
      }),
    ).toThrow(/memberCount/i);
  });

  it("adds an explicit emulator smoke command outside the web release smoke", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );

    expect(packageJson.scripts["smoke:mobile-creator-performance"]).toBe(
      "node scripts/smoke-mobile-creator-performance.mjs",
    );
    expect(packageJson.scripts["smoke:release"]).not.toContain(
      "smoke:mobile-creator-performance",
    );
  });

  it("dismisses the Expo developer menu before continuing the product flow", () => {
    expect(buildExpoDevMenuFallbackContinueTapCommand()).toBe(
      "input tap 540 2210",
    );
    expect(buildExpoDevMenuFallbackCloseTapCommand()).toBe(
      "input tap 1015 800",
    );

    const source = readFileSync(
      new URL("./smoke-mobile-creator-performance.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("dismissExpoDevMenuIfPresent");
    expect(source).toContain('"SDK version"');
    expect(source).toContain('"Continue"');
    expect(source).toMatch(
      /catch \(error\)[\s\S]+buildExpoDevMenuFallbackContinueTapCommand\(\)/,
    );
    expect(source).toMatch(
      /if \(!continueNode\)[\s\S]+buildExpoDevMenuFallbackCloseTapCommand\(\)[\s\S]+return true/,
    );
  });

  it("recovers from Android first-run not-responding dialogs before reading app UI", () => {
    expect(ANDROID_NOT_RESPONDING_TEXT).toBe("isn't responding");

    const source = readFileSync(
      new URL("./smoke-mobile-creator-performance.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("dismissAndroidNotRespondingDialogIfPresent");
    expect(source).toContain("dismissBlockingAndroidUiIfPresent");
    expect(source).toContain('"Wait"');
    expect(source).toMatch(/async function scrollUntilText[\s\S]+dismissBlockingAndroidUiIfPresent/);
    expect(source).toMatch(/async function focusAndClearNode[\s\S]+dismissBlockingAndroidUiIfPresent/);
  });

  it("hides Expo Go debug overlays before screenshot proof is captured", () => {
    const source = readFileSync(
      new URL("./smoke-mobile-creator-performance.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("hideExpoGoDebugOverlaysForScreenshot");
    expect(source).toMatch(
      /hideExpoGoDebugOverlaysForScreenshot\(targets\.adbSerial\)[\s\S]+captureAndroidScreenshot/,
    );
    expect(source).toContain('setMobileSmokeOverlayPermission(adbSerial, "ignore")');
  });

  it("falls back to a device-file UI dump when Android kills the /dev/tty dump", () => {
    const source = readFileSync(
      new URL("./smoke-mobile-creator-performance.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("dumpUiFromDeviceFile");
    expect(source).toContain("uiautomator dump /data/local/tmp/popsdrops-window.xml");
    expect(source).toContain("UiAutomator /dev/tty dump failed");
  });

  it("keeps waiting through transient UiAutomator null-root dumps during native boot", () => {
    expect(isUiAutomatorHierarchyDump("<hierarchy rotation=\"0\"></hierarchy>")).toBe(
      true,
    );
    expect(
      isUiAutomatorHierarchyDump(
        "ERROR: null root node returned by UiTestAutomationBridge.",
      ),
    ).toBe(false);

    const source = readFileSync(
      new URL("./smoke-mobile-creator-performance.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("UiAutomator /dev/tty dump returned no hierarchy");
    expect(source).toContain("lastDumpError");
    expect(source).toContain("UiAutomator dump failed while waiting");
    expect(source).toMatch(/catch \(error\)[\s\S]+lastDumpError[\s\S]+continue/);
  });

  it("installs cached Expo Go when a cold emulator boot does not have it", () => {
    const source = readFileSync(
      new URL("./smoke-mobile-creator-performance.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("ensureExpoGoInstalled");
    expect(source).toContain(".expo/android-apk-cache/Expo-Go-54.0.8.apk");
    expect(source).toContain('adb -s ${adbSerial} install -r');
  });
});
