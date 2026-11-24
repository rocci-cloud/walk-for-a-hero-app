import CoreLocation
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
 */
public class WfahBackgroundActivityModule: Module {
  // Held as AnyObject so the class compiles for the iOS 16.4 deployment target.
  private var session: AnyObject?
  private var observers: [NSObjectProtocol] = []

  private static let eventsKey = "wfah.diag.events"
  private static let maxEvents = 400

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

  private func observe(_ name: Notification.Name, _ kind: String) {
    let token = NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { _ in
      WfahBackgroundActivityModule.record(kind, "")
    }
    observers.append(token)
  }

  public func definition() -> ModuleDefinition {
    Name("WfahBackgroundActivity")

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
        self.observe(ProcessInfo.powerStateDidChangeNotification, "n_power_state")
      }
    }

    /// Returns true when a session is held (iOS 17+), false on older iOS.
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
      if #available(iOS 17.0, *) {
        (self.session as? CLBackgroundActivitySession)?.invalidate()
      }
      WfahBackgroundActivityModule.record("bg_session_stop", "held=\(self.session != nil)")
      self.session = nil
    }.runOnQueue(.main)

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
