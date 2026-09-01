package com.gentoo.driverstation

import android.util.Base64
import androidx.core.os.bundleOf
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
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

  override fun definition() = ModuleDefinition {
    Name("GentooDriverStation")

    Events("onDatagram", "onSocketError")

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

    OnDestroy {
      stopSocket()
    }
  }

  @Synchronized
  private fun startSocket(port: Int) {
    stopSocket()
    val newSocket = DatagramSocket(null).apply {
      reuseAddress = true
      bind(InetSocketAddress(port))
    }
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
        if (running.get()) {
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
