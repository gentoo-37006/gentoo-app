import Darwin
import CoreHaptics
import ExpoModulesCore
import UIKit

private final class DriverStationSocketException: GenericException<String>, @unchecked Sendable {
  override var reason: String { param }
}

public final class GentooDriverStationModule: Module {
  private let stateLock = NSLock()
  private let receiveQueue = DispatchQueue(label: "com.gentoo.driverstation.udp")
  private var socketDescriptor: Int32 = -1
  private var readSource: DispatchSourceRead?
  private var hapticEngine: CHHapticEngine?
  private var rumblePlayer: CHHapticAdvancedPatternPlayer?

  public func definition() -> ModuleDefinition {
    Name("GentooDriverStation")

    Events("onDatagram", "onSocketError")

    AsyncFunction("start") { (port: Int) in
      try self.startSocket(port: port)
    }

    AsyncFunction("stop") {
      self.stopSocket()
    }

    AsyncFunction("send") { (base64: String, host: String, port: Int) in
      try self.sendDatagram(base64: base64, host: host, port: port)
    }

    AsyncFunction("rumble") { (steps: [[String: Int]]) in
      try self.playRumble(steps)
    }
    .runOnQueue(.main)

    AsyncFunction("stopRumble") {
      self.stopRumble()
    }
    .runOnQueue(.main)

    AsyncFunction("joystickTick") { (strength: Double, sharpness: Double) in
      guard UIApplication.shared.applicationState == .active,
            CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
      let engine = try self.engineForHaptics()
      try engine.start()
      let event = CHHapticEvent(eventType: .hapticTransient, parameters: [
        CHHapticEventParameter(parameterID: .hapticIntensity, value: Float(max(0, min(1, strength)))),
        CHHapticEventParameter(parameterID: .hapticSharpness, value: Float(max(0, min(1, sharpness))))
      ], relativeTime: 0)
      let pattern = try CHHapticPattern(events: [event], parameters: [])
      let player = try engine.makePlayer(with: pattern)
      try player.start(atTime: CHHapticTimeImmediate)
    }
    .runOnQueue(.main)

    OnDestroy {
      self.stopSocket()
      DispatchQueue.main.async { self.stopRumble() }
    }
  }

  private func stopRumble() {
    try? rumblePlayer?.stop(atTime: CHHapticTimeImmediate)
    rumblePlayer = nil
  }

  private func engineForHaptics() throws -> CHHapticEngine {
    if let engine = hapticEngine { return engine }
    let engine = try CHHapticEngine()
    engine.playsHapticsOnly = true
    engine.isAutoShutdownEnabled = true
    hapticEngine = engine
    return engine
  }

  private func playRumble(_ steps: [[String: Int]]) throws {
    stopRumble()
    guard UIApplication.shared.applicationState == .active,
          CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }

    var events: [CHHapticEvent] = []
    var time: TimeInterval = 0
    var continuous = false
    for step in steps.prefix(128) {
      let large = Float(max(0, min(255, step["large"] ?? 0))) / 255
      let small = Float(max(0, min(255, step["small"] ?? 0))) / 255
      let milliseconds = step["duration"] ?? 0
      continuous = milliseconds == -1 && steps.count == 1
      var remaining = continuous ? 1.0 : Double(max(0, min(60_000, milliseconds))) / 1000
      if large == 0 && small == 0 {
        time += remaining
        continue
      }
      while remaining > 0 {
        let duration = min(30, remaining)
        events.append(CHHapticEvent(
          eventType: .hapticContinuous,
          parameters: [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: max(large, small)),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: small)
          ],
          relativeTime: time,
          duration: duration
        ))
        time += duration
        remaining -= duration
      }
    }
    guard !events.isEmpty else { return }
    let engine = try engineForHaptics()
    try engine.start()
    let pattern = try CHHapticPattern(events: events, parameters: [])
    let player = try engine.makeAdvancedPlayer(with: pattern)
    player.loopEnabled = continuous
    if continuous { player.loopEnd = time }
    rumblePlayer = player
    try player.start(atTime: CHHapticTimeImmediate)
  }

  private func startSocket(port: Int) throws {
    stopSocket()

    let descriptor = Darwin.socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP)
    guard descriptor >= 0 else {
      throw DriverStationSocketException("Unable to create the Driver Station UDP socket.")
    }

    // A Control Hub AP has no internet. Keep robot traffic on Wi-Fi even when
    // iOS prefers cellular for the default internet route.
    var wifiInterface = if_nametoindex("en0")
    guard wifiInterface != 0 else {
      Darwin.close(descriptor)
      throw DriverStationSocketException("Wi-Fi is unavailable. Join the Control Hub Wi-Fi network.")
    }
    guard setsockopt(
      descriptor, IPPROTO_IP, IP_BOUND_IF, &wifiInterface,
      socklen_t(MemoryLayout<UInt32>.size)
    ) == 0 else {
      let code = errno
      Darwin.close(descriptor)
      throw DriverStationSocketException("Unable to route robot traffic over Wi-Fi (\(code)).")
    }

    var reuseAddress: Int32 = 1
    setsockopt(
      descriptor,
      SOL_SOCKET,
      SO_REUSEADDR,
      &reuseAddress,
      socklen_t(MemoryLayout<Int32>.size)
    )

    var address = sockaddr_in()
    address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
    address.sin_family = sa_family_t(AF_INET)
    address.sin_port = in_port_t(port).bigEndian
    address.sin_addr = in_addr(s_addr: INADDR_ANY.bigEndian)

    let bindResult = withUnsafePointer(to: &address) { pointer in
      pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
        Darwin.bind(descriptor, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
      }
    }
    guard bindResult == 0 else {
      Darwin.close(descriptor)
      throw DriverStationSocketException(
        "Unable to bind UDP port \(port). Another Driver Station may already be running."
      )
    }

    let flags = fcntl(descriptor, F_GETFL, 0)
    _ = fcntl(descriptor, F_SETFL, flags | O_NONBLOCK)

    let source = DispatchSource.makeReadSource(
      fileDescriptor: descriptor,
      queue: receiveQueue
    )
    source.setEventHandler { [weak self] in
      self?.receiveDatagrams(from: descriptor)
    }
    source.setCancelHandler {
      Darwin.close(descriptor)
    }

    stateLock.lock()
    socketDescriptor = descriptor
    readSource = source
    stateLock.unlock()
    source.resume()
  }

  private func stopSocket() {
    stateLock.lock()
    let source = readSource
    readSource = nil
    socketDescriptor = -1
    stateLock.unlock()
    source?.cancel()
  }

  private func sendDatagram(base64: String, host: String, port: Int) throws {
    guard let data = Data(base64Encoded: base64) else {
      throw DriverStationSocketException("The outgoing Driver Station packet was invalid.")
    }

    stateLock.lock()
    let descriptor = socketDescriptor
    stateLock.unlock()
    guard descriptor >= 0 else {
      throw DriverStationSocketException("The Driver Station socket is not running.")
    }

    var destination = sockaddr_in()
    destination.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
    destination.sin_family = sa_family_t(AF_INET)
    destination.sin_port = in_port_t(port).bigEndian
    guard inet_pton(AF_INET, host, &destination.sin_addr) == 1 else {
      throw DriverStationSocketException("Invalid Control Hub address: \(host)")
    }

    let sent = data.withUnsafeBytes { bytes in
      withUnsafePointer(to: &destination) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
          Darwin.sendto(
            descriptor,
            bytes.baseAddress,
            data.count,
            0,
            $0,
            socklen_t(MemoryLayout<sockaddr_in>.size)
          )
        }
      }
    }
    guard sent == Int(data.count) else {
      let code = errno
      let detail = String(cString: strerror(code))
      let guidance: String
      switch code {
      case EACCES, EPERM, EHOSTUNREACH:
        guidance = " Check Gentoo's Local Network permission in Settings and join the Control Hub Wi-Fi."
      case ENETUNREACH, ENETDOWN, EADDRNOTAVAIL:
        guidance = " Join the Control Hub Wi-Fi network and reopen Driver Station."
      default:
        guidance = ""
      }
      throw DriverStationSocketException("UDP to \(host):\(port) failed: \(detail) (\(code)).\(guidance)")
    }
  }

  private func receiveDatagrams(from descriptor: Int32) {
    while true {
      var buffer = [UInt8](repeating: 0, count: 65_520)
      var sourceAddress = sockaddr_storage()
      var sourceLength = socklen_t(MemoryLayout<sockaddr_storage>.size)

      let received = withUnsafeMutablePointer(to: &sourceAddress) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { socketAddress in
          Darwin.recvfrom(
            descriptor,
            &buffer,
            buffer.count,
            0,
            socketAddress,
            &sourceLength
          )
        }
      }

      if received < 0 {
        if errno != EAGAIN && errno != EWOULDBLOCK {
          sendEvent("onSocketError", ["message": "UDP receive failed (\(errno))."])
        }
        return
      }
      if received == 0 { return }

      var hostBuffer = [CChar](repeating: 0, count: Int(NI_MAXHOST))
      var serviceBuffer = [CChar](repeating: 0, count: Int(NI_MAXSERV))
      let nameResult = withUnsafePointer(to: &sourceAddress) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
          getnameinfo(
            $0,
            sourceLength,
            &hostBuffer,
            socklen_t(hostBuffer.count),
            &serviceBuffer,
            socklen_t(serviceBuffer.count),
            NI_NUMERICHOST | NI_NUMERICSERV
          )
        }
      }
      guard nameResult == 0 else { continue }

      let packet = Data(buffer.prefix(Int(received)))
      sendEvent("onDatagram", [
        "data": packet.base64EncodedString(),
        "host": String(cString: hostBuffer),
        "port": Int(String(cString: serviceBuffer)) ?? 0,
      ])
    }
  }
}
