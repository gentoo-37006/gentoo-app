import Darwin
import ExpoModulesCore

private final class DriverStationSocketException: GenericException<String>, @unchecked Sendable {
  override var reason: String { param }
}

public final class GentooDriverStationModule: Module {
  private let stateLock = NSLock()
  private let receiveQueue = DispatchQueue(label: "com.gentoo.driverstation.udp")
  private var socketDescriptor: Int32 = -1
  private var readSource: DispatchSourceRead?

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

    OnDestroy {
      self.stopSocket()
    }
  }

  private func startSocket(port: Int) throws {
    stopSocket()

    let descriptor = Darwin.socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP)
    guard descriptor >= 0 else {
      throw DriverStationSocketException("Unable to create the Driver Station UDP socket.")
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
      throw DriverStationSocketException("The Driver Station packet could not be sent.")
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
