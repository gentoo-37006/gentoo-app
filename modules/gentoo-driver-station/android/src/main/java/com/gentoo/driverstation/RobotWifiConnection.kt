package com.gentoo.driverstation

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiNetworkSpecifier
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise

class RobotWifiConnection(private val context: Context, private val changed: (Network?) -> Unit) {
  private val manager = context.getSystemService(ConnectivityManager::class.java)
  private val handler = Handler(Looper.getMainLooper())
  private var callback: ConnectivityManager.NetworkCallback? = null
  private var pending: Promise? = null

  fun join(ssid: String, password: String, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      promise.resolve("settings-required")
      return
    }
    release()
    val specifier = WifiNetworkSpecifier.Builder().setSsid(ssid).apply {
      if (password.isNotEmpty()) setWpa2Passphrase(password)
    }.build()
    val request = NetworkRequest.Builder()
      .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
      .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .setNetworkSpecifier(specifier).build()
    val listener = object : ConnectivityManager.NetworkCallback() {
      override fun onAvailable(network: Network) {
        if (callback !== this) return
        try {
          changed(network)
          pending?.resolve("requested")
          pending = null
        } catch (error: Exception) {
          pending?.reject("ERR_WIFI_SOCKET", "Could not route robot traffic over Wi-Fi.", error)
          pending = null
          release()
        }
      }
      override fun onUnavailable() {
        if (callback !== this) return
        pending?.reject("ERR_WIFI_UNAVAILABLE", "Wi-Fi joining was cancelled or the robot network is unavailable.", null)
        pending = null
        release()
      }
      override fun onLost(network: Network) {
        if (callback === this) changed(null)
      }
    }
    callback = listener
    pending = promise
    try { manager.requestNetwork(request, listener, handler, 45_000) }
    catch (error: Exception) {
      pending = null
      release()
      promise.reject("ERR_WIFI_PERMISSION", "Allow Wi-Fi access and enable Wi-Fi/location in Settings.", error)
    }
  }

  fun release() {
    callback?.let { try { manager.unregisterNetworkCallback(it) } catch (_: Exception) {} }
    callback = null
    pending?.reject("ERR_WIFI_CANCELLED", "Wi-Fi joining was cancelled.", null)
    pending = null
    changed(null)
  }
}
