package org.walkforahero.steps

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.SystemClock
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android step counter for walks (app 1.0.3, 2026-11-27).
 *
 * TYPE_STEP_COUNTER is a hardware counter of steps since boot. While a walk
 * records, this listens with a 60 s batching latency (the sensor hub keeps
 * counting and delivers timestamped batches even while the CPU sleeps) and
 * keeps a (epochMs, cumulativeSteps) sample at most every 15 s in
 * SharedPreferences, so the samples survive the process being restarted.
 * At Finish the JS side turns consecutive samples into per-minute step
 * buckets for log-walk-miles, which converts steps to distance with the
 * walker's stored height and only uses them to fill GPS signal gaps.
 */
class WfahStepsModule : Module(), SensorEventListener {
  private var registered = false
  private var lastStoredMs = 0L

  private val context: Context?
    get() = appContext.reactContext

  private fun sensorManager(): SensorManager? =
    context?.getSystemService(Context.SENSOR_SERVICE) as? SensorManager

  private fun stepSensor(): Sensor? = sensorManager()?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

  private fun prefs() = context?.getSharedPreferences("wfah.steps", Context.MODE_PRIVATE)

  private fun appendSample(ms: Long, steps: Double) {
    val p = prefs() ?: return
    val existing = p.getString("samples", "") ?: ""
    var parts = if (existing.isEmpty()) mutableListOf() else existing.split(";").toMutableList()
    parts.add("$ms:$steps")
    if (parts.size > 3000) parts = parts.subList(parts.size - 3000, parts.size)
    p.edit().putString("samples", parts.joinToString(";")).apply()
  }

  override fun onSensorChanged(event: SensorEvent?) {
    val e = event ?: return
    if (e.sensor?.type != Sensor.TYPE_STEP_COUNTER || e.values.isEmpty()) return
    val ageMs = (SystemClock.elapsedRealtimeNanos() - e.timestamp) / 1_000_000L
    val epochMs = System.currentTimeMillis() - ageMs.coerceAtLeast(0L)
    if (epochMs - lastStoredMs < 15_000L) return
    lastStoredMs = epochMs
    appendSample(epochMs, e.values[0].toDouble())
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  private fun register(): Boolean {
    if (registered) return true
    val sm = sensorManager() ?: return false
    val sensor = stepSensor() ?: return false
    registered = sm.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL, 60_000_000)
    return registered
  }

  private fun unregister() {
    if (!registered) return
    sensorManager()?.unregisterListener(this)
    registered = false
  }

  override fun definition() = ModuleDefinition {
    Name("WfahSteps")

    Function("isAvailable") {
      stepSensor() != null
    }

    /** Start listening. reset=true clears samples from any earlier walk. */
    Function("start") { reset: Boolean ->
      if (reset) {
        prefs()?.edit()?.remove("samples")?.apply()
        lastStoredMs = 0L
      }
      register()
    }

    Function("stop") {
      unregister()
    }

    /** Ask the sensor hub to deliver any batched events now (before Finish reads samples). */
    Function("flush") {
      if (registered) {
        lastStoredMs = 0L // the flushed batch's newest event is always kept
        sensorManager()?.flush(this@WfahStepsModule) ?: false
      } else {
        false
      }
    }

    /** [[epochMs, cumulativeSteps], ...] oldest first. */
    Function("samples") {
      val raw = prefs()?.getString("samples", "") ?: ""
      if (raw.isEmpty()) {
        emptyList<List<Double>>()
      } else {
        raw.split(";").mapNotNull { item ->
          val kv = item.split(":")
          val ms = kv.getOrNull(0)?.toDoubleOrNull()
          val steps = kv.getOrNull(1)?.toDoubleOrNull()
          if (ms != null && steps != null) listOf(ms, steps) else null
        }
      }
    }

    OnDestroy {
      unregister()
    }
  }
}
