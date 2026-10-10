package com.gentoo.driverstation

import android.util.Base64
import android.content.Context
import android.content.Intent
import android.net.Network
import android.provider.Settings
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.os.bundleOf
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.SocketException
import java.util.concurrent.atomic.AtomicBoolean

class GentooDriverStationModule : Module() {
  private val running = AtomicBoolean(false)
  private var socket: DatagramSocket? = null
  private var receiveThread: Thread? = null
  private var rumbleVibrator: Vibrator? = null
  private var robotWifi: RobotWifiConnection? = null
  private var wifiNetwork: Network? = null

  override fun definition() = ModuleDefinition {
    Name("GentooDriverStation")

    Events("onDatagram", "onSocketError")

    AsyncFunction("keepAwake") { enabled: Boolean ->
      setKeepAwake(enabled)
    }
    AsyncFunction("joinWifi") { ssid: String, password: String, promise: Promise ->
      Handler(Looper.getMainLooper()).post {
        val context = appContext.reactContext
        if (context == null) promise.reject("ERR_WIFI_CONTEXT", "The app is unavailable.", null)
        else {
          val connection = robotWifi ?: RobotWifiConnection(context) { network ->
            setWifiNetwork(network)
          }.also { robotWifi = it }
          try { connection.join(ssid, password, promise) }
          catch (error: Exception) { promise.reject("ERR_WIFI_JOIN", "Could not join the robot network.", error) }
        }
      }
    }
    AsyncFunction("releaseWifi") {
      Handler(Looper.getMainLooper()).post { robotWifi?.release() }
    }
    AsyncFunction("openWifiSettings") {
      appContext.reactContext?.startActivity(Intent(Settings.ACTION_WIFI_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    AsyncFunction("start") { port: Int ->
      startSocket(port)
    }

    AsyncFunction("stop") {
      stopSocket()
    }

    AsyncFunction("send") { base64: String, host: String, port: Int ->
      val activeSocket = socket ?: throw IllegalStateException(
        "The Driver Station socket is not running."
      )
      val data = Base64.decode(base64, Base64.DEFAULT)
      val packet = DatagramPacket(data, data.size, InetAddress.getByName(host), port)
      activeSocket.send(packet)
    }

    AsyncFunction("rumble") { steps: List<Map<String, Int>> ->
      stopRumble()
      val vibrator = phoneVibrator()
      if (vibrator != null && vibrator.hasVibrator() && steps.isNotEmpty()) {
        val bounded = steps.take(128)
        val timings = bounded.map { step ->
          if (step["duration"] == -1) 1000L else (step["duration"] ?: 0).coerceIn(0, 60000).toLong()
        }.toLongArray()
        val amplitudes = bounded.map { step ->
          maxOf(step["large"] ?: 0, step["small"] ?: 0).coerceIn(0, 255)
        }.toIntArray()
        val repeat = if (bounded.size == 1 && bounded[0]["duration"] == -1) 0 else -1
        if (timings.any { it > 0 } && amplitudes.any { it > 0 }) {
          rumbleVibrator = vibrator
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, repeat))
          } else {
            // Android 7 supports timed vibration but not adjustable strength.
            val pattern = mutableListOf(0L)
            timings.indices.forEach { index ->
              val on = amplitudes[index] > 0
              if ((pattern.lastIndex % 2 == 1) == on) {
                pattern[pattern.lastIndex] += timings[index]
              } else {
                pattern.add(timings[index])
              }
            }
            @Suppress("DEPRECATION")
            vibrator.vibrate(pattern.toLongArray(), repeat)
          }
        }
      }
    }

    AsyncFunction("stopRumble") { stopRumble() }

    AsyncFunction("joystickTick") { strength: Double, _sharpness: Double ->
      val vibrator = phoneVibrator()
      if (vibrator != null && vibrator.hasVibrator()) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          val amplitude = (strength.coerceIn(0.0, 1.0) * 255).toInt().coerceIn(1, 255)
          vibrator.vibrate(VibrationEffect.createOneShot(12, amplitude))
        } else {
          @Suppress("DEPRECATION")
          vibrator.vibrate(12L)
        }
      }
    }

    OnDestroy {
      stopSocket()
      stopRumble()
      setKeepAwake(false)
      Handler(Looper.getMainLooper()).post { robotWifi?.release() }
    }
  }

  private fun setKeepAwake(enabled: Boolean) {
    val activity = appContext.currentActivity ?: return
    activity.runOnUiThread {
      if (enabled) activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
  }

  @Synchronized
  private fun setWifiNetwork(network: Network?) {
    if (wifiNetwork == network) return
    wifiNetwork = network
    socket?.localPort?.let { port ->
      try { startSocket(port) }
      catch (error: Exception) {
        sendEvent("onSocketError", bundleOf("message" to "Could not reopen the robot UDP socket."))
        if (network != null) throw error
      }
    }
  }

  private fun stopRumble() {
    rumbleVibrator?.cancel()
    rumbleVibrator = null
  }

  @Suppress("DEPRECATION")
  private fun phoneVibrator(): Vibrator? {
    val context = appContext.reactContext ?: return null
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      context.getSystemService(VibratorManager::class.java)?.defaultVibrator
    } else {
      context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }
  }

  @Synchronized
  private fun startSocket(port: Int) {
    stopSocket()
    val newSocket = DatagramSocket(null).apply {
      reuseAddress = true
      bind(InetSocketAddress(port))
    }
    try { wifiNetwork?.bindSocket(newSocket) }
    catch (error: Exception) { newSocket.close(); throw error }
    socket = newSocket
    running.set(true)
    receiveThread = Thread({ receiveLoop(newSocket) }, "GentooDriverStationUdp").apply {
      isDaemon = true
      start()
    }
  }

  @Synchronized
  private fun stopSocket() {
    running.set(false)
    socket?.close()
    socket = null
    receiveThread = null
  }

  private fun receiveLoop(activeSocket: DatagramSocket) {
    val buffer = ByteArray(65_520)
    while (running.get() && !activeSocket.isClosed) {
      try {
        val packet = DatagramPacket(buffer, buffer.size)
        activeSocket.receive(packet)
        val encoded = Base64.encodeToString(
          packet.data,
          packet.offset,
          packet.length,
          Base64.NO_WRAP
        )
        sendEvent(
          "onDatagram",
          bundleOf(
            "data" to encoded,
            "host" to packet.address.hostAddress,
            "port" to packet.port
          )
        )
      } catch (_: SocketException) {
        if (running.get() && socket === activeSocket) {
          sendEvent("onSocketError", bundleOf("message" to "The UDP socket closed unexpectedly."))
        }
        return
      } catch (error: Exception) {
        sendEvent(
          "onSocketError",
          bundleOf("message" to (error.message ?: "UDP receive failed."))
        )
      }
    }
  }
}
