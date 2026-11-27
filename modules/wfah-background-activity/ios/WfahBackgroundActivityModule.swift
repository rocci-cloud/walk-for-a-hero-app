import CoreLocation
import CoreMotion
import ExpoModulesCore
import UIKit

/**
 * Keeps an iOS background-activity session open while a walk is recording.
 *
 * WHY (2026-11-22): on iOS 17+ an app with only "While Using" location
 * permission — which is all this app asks for — has its background location
 * suspended every few minutes unless it holds a CLBackgroundActivitySession.
 * Glenn Baker's walks showed it exactly: ~1 min of 2 m-accurate fixes, then
 * 4-5 min of nothing, over and over (Apple Watch 3.07 mi, app 1.21 mi).
 *
 * The session must be created while the app is in the foreground (Start Walk
 * and Resume are both foreground taps), and recreated when the app is
 * relaunched mid-walk. It also keeps the blue location indicator up, so the
 * walker can always see that recording is on.
 *
 * DIAGNOSTICS (2026-11-24, app 1.0.2): 1.0.1 shipped the session above and a
 * walker on 1.0.1 (Steve Olds) still lost GPS a minute after locking his
 * screen, 7 times a walk. The JS code path is correct on paper, so the cause
 * is on the phone. This module now also:
 *   - reports a device/permission snapshot (`snapshot`), and
 *   - records native lifecycle events into UserDefaults (`drainEvents`):
 *     process start, entering background/foreground, memory warnings,
 *     termination, and the protected-data (file protection) lock/unlock.
 * Native observers keep working when the JS thread is idle, and UserDefaults
 * survives the process being killed, so a walk's report shows whether iOS
 * terminated the app, suspended it, or locked its files.
 *
 * 1.0.3 (2026-11-27) — THE FIX. Steve's 1.0.2 report (session 6b099c65)
 * showed iOS suspending the app ~50 s after every lock, with the session held
 * and expo-location insisting updates were "already running": the classic
 * CLLocationManager task consumer was not being treated as a background
 * location client at all. CLBackgroundActivitySession is designed to pair
 * with Apple's iOS 17+ `CLLocationUpdate.liveUpdates` API, so on iOS 17+ this
 * module now RECORDS THE WALK ITSELF:
 *   - `startLive` holds the background session (and, on iOS 18+, a
 *     When-In-Use CLServiceSession) and iterates
 *     `CLLocationUpdate.liveUpdates(.fitness)` in a long-lived Task;
 *   - every fix is appended to a small file (writable while the phone is
 *     locked) and JS is pinged to drain it, so a fix is never lost to a
 *     suspended JS thread or a dead process;
 *   - a flag in UserDefaults says a walk is live, and the module re-arms the
 *     session and the updates as soon as the process starts (Apple's
 *     relaunch pattern), so if iOS kills and relaunches the app mid-walk the
 *     recording resumes without the walker touching the phone;
 *   - iOS 18+ update flags (insufficientlyInUse, locationUnavailable,
 *     stationary, ...) are logged into the diagnostics stream.
 * It also exposes CMPedometer (steps + distance per minute for any window in
 * the last 7 days, recorded by the motion coprocessor whether or not this app
 * is running), which log-walk-miles uses to fill GPS gaps.
 */
public class WfahBackgroundActivityModule: Module {
  // Held as AnyObject so the class compiles for the iOS 16.4 deployment target.
  private var session: AnyObject?
  private var serviceSession: AnyObject?
  private var liveTask: Task<Void, Never>?
  private var observers: [NSObjectProtocol] = []
  private let pedometer = CMPedometer()
  private var lastPingMs: Int64 = 0

  private static let eventsKey = "wfah.diag.events"
  private static let liveKey = "wfah.live.active"
  private static let maxEvents = 400
  private static let fixQueue = DispatchQueue(label: "org.walkforahero.fixes")

  /// Appends "epochMs|kind|detail" to a capped ring in UserDefaults.
  static func record(_ kind: String, _ detail: String = "") {
    let ms = Int64(Date().timeIntervalSince1970 * 1000)
    let defaults = UserDefaults.standard
    var events = defaults.stringArray(forKey: eventsKey) ?? []
    events.append("\(ms)|\(kind)|\(detail)")
    if events.count > maxEvents {
      events.removeFirst(events.count - maxEvents)
    }
    defaults.set(events, forKey: eventsKey)
  }

  private static func appStateName() -> String {
    switch UIApplication.shared.applicationState {
    case .active: return "active"
    case .inactive: return "inactive"
    case .background: return "background"
    @unknown default: return "unknown"
    }
  }

  // MARK: fix buffer (survives a suspended JS thread and a killed process)

  private static var fixFileURL: URL {
    let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    return dir.appendingPathComponent("wfah-live-fixes.txt")
  }

  static func appendFix(_ loc: CLLocation) {
    guard loc.horizontalAccuracy >= 0 else { return }
    let line = String(
      format: "%.7f,%.7f,%.1f,%.0f,%.2f\n",
      loc.coordinate.latitude,
      loc.coordinate.longitude,
      loc.horizontalAccuracy,
      loc.timestamp.timeIntervalSince1970 * 1000,
      loc.speed
    )
    fixQueue.sync {
      let url = fixFileURL
      let fm = FileManager.default
      if !fm.fileExists(atPath: url.path) {
        try? fm.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        fm.createFile(
          atPath: url.path,
          contents: nil,
          attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        )
      }
      if let handle = try? FileHandle(forWritingTo: url), let data = line.data(using: .utf8) {
        handle.seekToEndOfFile()
        handle.write(data)
        try? handle.close()
      }
    }
  }

  static func drainFixFile() -> [[Double]] {
    return fixQueue.sync {
      let url = fixFileURL
      guard let text = try? String(contentsOf: url, encoding: .utf8) else { return [] }
      try? FileManager.default.removeItem(at: url)
      var out: [[Double]] = []
      for line in text.split(separator: "\n") {
        let parts = line.split(separator: ",").compactMap { Double($0) }
        if parts.count >= 4 { out.append(parts) }
      }
      return out
    }
  }

  // MARK: live updates

  private func pingJS() {
    let now = Int64(Date().timeIntervalSince1970 * 1000)
    if now - lastPingMs < 1500 { return }
    lastPingMs = now
    sendEvent("onFixes", ["at": Double(now)])
  }

  /// Must run on main. Returns false where liveUpdates does not exist (iOS < 17).
  private func armLive(_ reason: String) -> Bool {
    guard #available(iOS 17.0, *) else {
      WfahBackgroundActivityModule.record("live_start", "unsupported_ios reason=\(reason)")
      return false
    }
    let created = session == nil
    if created {
      session = CLBackgroundActivitySession()
    }
    if #available(iOS 18.0, *), serviceSession == nil {
      serviceSession = CLServiceSession(authorization: .whenInUse)
    }
    UserDefaults.standard.set(true, forKey: WfahBackgroundActivityModule.liveKey)
    let running = liveTask != nil
    if !running {
      liveTask = makeLiveTask()
    }
    WfahBackgroundActivityModule.record(
      "live_start",
      "reason=\(reason) session_created=\(created) already_running=\(running) state=\(WfahBackgroundActivityModule.appStateName())"
    )
    return true
  }

  @available(iOS 17.0, *)
  private func makeLiveTask() -> Task<Void, Never> {
    return Task { [weak self] in
      var count = 0
      var lastFlags = ""
      do {
        for try await update in CLLocationUpdate.liveUpdates(.fitness) {
          if Task.isCancelled { break }
          if let loc = update.location {
            WfahBackgroundActivityModule.appendFix(loc)
            count += 1
            self?.pingJS()
          }
          var flags: [String] = []
          if #available(iOS 18.0, *) {
            if update.stationary { flags.append("stationary") }
            if update.insufficientlyInUse { flags.append("insufficientlyInUse") }
            if update.locationUnavailable { flags.append("locationUnavailable") }
            if update.authorizationDenied { flags.append("authorizationDenied") }
            if update.accuracyLimited { flags.append("accuracyLimited") }
          } else if update.isStationary {
            flags.append("stationary")
          }
          let joined = flags.joined(separator: ",")
          if joined != lastFlags {
            WfahBackgroundActivityModule.record("live_flags", joined.isEmpty ? "none" : joined)
            lastFlags = joined
          }
        }
        WfahBackgroundActivityModule.record("live_end", "fixes=\(count)")
      } catch {
        WfahBackgroundActivityModule.record("live_error", "\(error)")
      }
    }
  }

  private func disarmLive() {
    liveTask?.cancel()
    liveTask = nil
    if #available(iOS 18.0, *) {
      (serviceSession as? CLServiceSession)?.invalidate()
    }
    serviceSession = nil
    if #available(iOS 17.0, *) {
      (session as? CLBackgroundActivitySession)?.invalidate()
    }
    let held = session != nil
    session = nil
    UserDefaults.standard.set(false, forKey: WfahBackgroundActivityModule.liveKey)
    WfahBackgroundActivityModule.record("live_stop", "held=\(held)")
  }

  private func observe(_ name: Notification.Name, _ kind: String) {
    let token = NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { _ in
      WfahBackgroundActivityModule.record(kind, "")
    }
    observers.append(token)
  }

  private static func pedometerAuthName() -> String {
    if !CMPedometer.isStepCountingAvailable() { return "unavailable" }
    switch CMPedometer.authorizationStatus() {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "notDetermined"
    @unknown default: return "unknown"
    }
  }

  public func definition() -> ModuleDefinition {
    Name("WfahBackgroundActivity")

    Events("onFixes")

    OnCreate {
      DispatchQueue.main.async {
        WfahBackgroundActivityModule.record(
          "native_start",
          "state=\(WfahBackgroundActivityModule.appStateName()) pid=\(ProcessInfo.processInfo.processIdentifier)"
        )
        self.observe(UIApplication.didEnterBackgroundNotification, "n_background")
        self.observe(UIApplication.willEnterForegroundNotification, "n_foreground")
        self.observe(UIApplication.didReceiveMemoryWarningNotification, "n_memory_warning")
        self.observe(UIApplication.willTerminateNotification, "n_terminate")
        self.observe(UIApplication.protectedDataWillBecomeUnavailableNotification, "n_files_locked")
        self.observe(UIApplication.protectedDataDidBecomeAvailableNotification, "n_files_unlocked")
        self.observe(Notification.Name.NSProcessInfoPowerStateDidChange, "n_power_state")
        // Relaunched mid-walk (iOS killed the process): re-arm at once, before
        // JS is even up, exactly as Apple's live-updates sample does.
        if UserDefaults.standard.bool(forKey: WfahBackgroundActivityModule.liveKey) {
          _ = self.armLive("relaunch")
        }
      }
    }

    /// Hold the background session only (1.0.1/1.0.2 path, kept for iOS < 17 fallback callers).
    AsyncFunction("start") { () -> Bool in
      if #available(iOS 17.0, *) {
        let created = self.session == nil
        if created {
          self.session = CLBackgroundActivitySession()
        }
        WfahBackgroundActivityModule.record(
          "bg_session_start",
          "created=\(created) state=\(WfahBackgroundActivityModule.appStateName())"
        )
        return true
      }
      WfahBackgroundActivityModule.record("bg_session_start", "unsupported_ios")
      return false
    }.runOnQueue(.main)

    AsyncFunction("stop") {
      self.disarmLive()
    }.runOnQueue(.main)

    /// 1.0.3: record the walk natively with liveUpdates. Call from the foreground.
    AsyncFunction("startLive") { (reason: String) -> Bool in
      return self.armLive(reason)
    }.runOnQueue(.main)

    AsyncFunction("stopLive") {
      self.disarmLive()
    }.runOnQueue(.main)

    /// Fixes recorded since the last drain: [lat, lng, acc, epochMs, speed].
    AsyncFunction("drainFixes") { () -> [[Double]] in
      return WfahBackgroundActivityModule.drainFixFile()
    }

    AsyncFunction("isLive") { () -> Bool in
      return self.liveTask != nil
    }.runOnQueue(.main)

    // MARK: pedometer

    AsyncFunction("pedometerStatus") { () -> String in
      return WfahBackgroundActivityModule.pedometerAuthName()
    }

    /// Triggers the Motion & Fitness prompt (a query is what asks). Foreground only.
    AsyncFunction("pedometerRequest") { (promise: Promise) in
      guard CMPedometer.isStepCountingAvailable() else {
        promise.resolve("unavailable")
        return
      }
      let now = Date()
      self.pedometer.queryPedometerData(from: now.addingTimeInterval(-60), to: now) { _, error in
        let status = WfahBackgroundActivityModule.pedometerAuthName()
        WfahBackgroundActivityModule.record("pedometer_auth", "\(status) error=\(error != nil)")
        promise.resolve(status)
      }
    }

    /// Steps and metres per bucket between two epoch-ms times, plus the total.
    AsyncFunction("pedometerBuckets") { (startMs: Double, endMs: Double, bucketSeconds: Double, promise: Promise) in
      guard CMPedometer.isStepCountingAvailable(), endMs > startMs else {
        promise.resolve(["status": WfahBackgroundActivityModule.pedometerAuthName(), "buckets": [Any]()])
        return
      }
      let size = max(30.0, bucketSeconds) * 1000
      var windows: [(Double, Double)] = []
      var s = startMs
      while s < endMs && windows.count < 1500 {
        let e = min(endMs, s + size)
        windows.append((s, e))
        s = e
      }
      let group = DispatchGroup()
      let lock = NSLock()
      var buckets: [[String: Any]] = []
      var total: [String: Any] = [:]
      for (ws, we) in windows {
        group.enter()
        self.pedometer.queryPedometerData(
          from: Date(timeIntervalSince1970: ws / 1000),
          to: Date(timeIntervalSince1970: we / 1000)
        ) { data, _ in
          if let d = data {
            var b: [String: Any] = ["s": ws, "e": we, "steps": d.numberOfSteps.doubleValue]
            if let m = d.distance { b["m"] = m.doubleValue }
            lock.lock()
            buckets.append(b)
            lock.unlock()
          }
          group.leave()
        }
      }
      group.enter()
      self.pedometer.queryPedometerData(
        from: Date(timeIntervalSince1970: startMs / 1000),
        to: Date(timeIntervalSince1970: endMs / 1000)
      ) { data, _ in
        if let d = data {
          lock.lock()
          total["steps"] = d.numberOfSteps.doubleValue
          if let m = d.distance { total["m"] = m.doubleValue }
          lock.unlock()
        }
        group.leave()
      }
      group.notify(queue: .main) {
        promise.resolve([
          "status": WfahBackgroundActivityModule.pedometerAuthName(),
          "buckets": buckets,
          "total": total,
        ])
      }
    }

    /// Device, app and permission facts for a walk's diagnostics report.
    AsyncFunction("snapshot") { (dbPath: String?) -> [String: Any] in
      let info = Bundle.main.infoDictionary ?? [:]
      let manager = CLLocationManager()
      var auth = "unknown"
      switch manager.authorizationStatus {
      case .notDetermined: auth = "notDetermined"
      case .restricted: auth = "restricted"
      case .denied: auth = "denied"
      case .authorizedAlways: auth = "always"
      case .authorizedWhenInUse: auth = "whenInUse"
      @unknown default: auth = "unknown"
      }
      let precise = manager.accuracyAuthorization == .fullAccuracy
      var refresh = "unknown"
      switch UIApplication.shared.backgroundRefreshStatus {
      case .available: refresh = "available"
      case .denied: refresh = "denied"
      case .restricted: refresh = "restricted"
      @unknown default: refresh = "unknown"
      }
      var protection = "n/a"
      if let path = dbPath, !path.isEmpty {
        let clean = path.hasPrefix("file://") ? String(path.dropFirst(7)) : path
        if let attrs = try? FileManager.default.attributesOfItem(atPath: clean),
           let p = attrs[.protectionKey] as? FileProtectionType {
          protection = p.rawValue
        } else {
          protection = "unreadable"
        }
      }
      var sys = utsname()
      uname(&sys)
      let model = withUnsafePointer(to: &sys.machine) {
        $0.withMemoryRebound(to: CChar.self, capacity: 1) { String(cString: $0) }
      }
      return [
        "app_version": info["CFBundleShortVersionString"] as? String ?? "",
        "build": info["CFBundleVersion"] as? String ?? "",
        "os": "ios",
        "os_version": UIDevice.current.systemVersion,
        "model": model,
        "location_auth": auth,
        "precise": precise,
        "location_services_on": CLLocationManager.locationServicesEnabled(),
        "low_power_mode": ProcessInfo.processInfo.isLowPowerModeEnabled,
        "background_refresh": refresh,
        "protected_data_available": UIApplication.shared.isProtectedDataAvailable,
        "db_file_protection": protection,
        "app_state": WfahBackgroundActivityModule.appStateName(),
        "bg_session_held": self.session != nil,
        "live_running": self.liveTask != nil,
        "pedometer": WfahBackgroundActivityModule.pedometerAuthName(),
      ]
    }.runOnQueue(.main)

    /// Returns the recorded native events and clears them.
    AsyncFunction("drainEvents") { () -> [String] in
      let defaults = UserDefaults.standard
      let events = defaults.stringArray(forKey: WfahBackgroundActivityModule.eventsKey) ?? []
      defaults.removeObject(forKey: WfahBackgroundActivityModule.eventsKey)
      return events
    }

    OnDestroy {
      // Not disarmLive(): the live flag must survive so a relaunch re-arms.
      self.liveTask?.cancel()
      self.liveTask = nil
      if #available(iOS 17.0, *) {
        (self.session as? CLBackgroundActivitySession)?.invalidate()
      }
      self.session = nil
      for token in self.observers {
        NotificationCenter.default.removeObserver(token)
      }
      self.observers.removeAll()
    }
  }
}
