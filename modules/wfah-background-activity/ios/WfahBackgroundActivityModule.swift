import CoreLocation
import ExpoModulesCore

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
 */
public class WfahBackgroundActivityModule: Module {
  // Held as AnyObject so the class compiles for the iOS 16.4 deployment target.
  private var session: AnyObject?

  public func definition() -> ModuleDefinition {
    Name("WfahBackgroundActivity")

    /// Returns true when a session is held (iOS 17+), false on older iOS.
    AsyncFunction("start") { () -> Bool in
      if #available(iOS 17.0, *) {
        if self.session == nil {
          self.session = CLBackgroundActivitySession()
        }
        return true
      }
      return false
    }.runOnQueue(.main)

    AsyncFunction("stop") {
      if #available(iOS 17.0, *) {
        (self.session as? CLBackgroundActivitySession)?.invalidate()
      }
      self.session = nil
    }.runOnQueue(.main)

    OnDestroy {
      if #available(iOS 17.0, *) {
        (self.session as? CLBackgroundActivitySession)?.invalidate()
      }
      self.session = nil
    }
  }
}
