// Regenerates assets/mac/AppIcon.icon/Assets/Penguin.png — the transparent
// glyph layer of the macOS Icon Composer document — from assets/images/icon.png
// by flood-filling the uniform background to transparent from the borders
// (enclosed light regions like the belly and notepad are untouched).
// Run from the repo root when the base icon artwork changes:
//   swift scripts/generate-mac-icon-layer.swift
// The output is committed; icon.json in the same .icon document defines the
// light/dark background fills (macOS 26+ appearance-aware icon).
import AppKit
import CoreGraphics

let srcURL = URL(fileURLWithPath: "assets/images/icon.png")
let outURL = URL(fileURLWithPath: "assets/mac/AppIcon.icon/Assets/Penguin.png")
let tolerance: Double = 45

guard let data = try? Data(contentsOf: srcURL),
      let rep = NSBitmapImageRep(data: data),
      let src = rep.cgImage else {
  fputs("error: cannot load \(srcURL.path)\n", stderr)
  exit(1)
}

let width = src.width
let height = src.height
let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
guard let ctx = CGContext(
  data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
  space: colorSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else {
  fputs("error: cannot create canvas\n", stderr)
  exit(1)
}
ctx.draw(src, in: CGRect(x: 0, y: 0, width: width, height: height))
guard let buffer = ctx.data else {
  fputs("error: no pixel buffer\n", stderr)
  exit(1)
}
let px = buffer.bindMemory(to: UInt8.self, capacity: width * height * 4)

let bgR = Double(px[0]), bgG = Double(px[1]), bgB = Double(px[2])
func isBackground(_ i: Int) -> Bool {
  let dr = Double(px[i]) - bgR
  let dg = Double(px[i + 1]) - bgG
  let db = Double(px[i + 2]) - bgB
  return (dr * dr + dg * dg + db * db).squareRoot() < tolerance
}

var visited = [Bool](repeating: false, count: width * height)
var queue: [Int] = []
for x in 0..<width {
  queue.append(x)
  queue.append((height - 1) * width + x)
}
for y in 0..<height {
  queue.append(y * width)
  queue.append(y * width + width - 1)
}

var head = 0
while head < queue.count {
  let p = queue[head]
  head += 1
  if p < 0 || p >= width * height || visited[p] { continue }
  visited[p] = true
  let i = p * 4
  guard isBackground(i) else { continue }
  px[i] = 0
  px[i + 1] = 0
  px[i + 2] = 0
  px[i + 3] = 0
  let x = p % width
  if x > 0 { queue.append(p - 1) }
  if x < width - 1 { queue.append(p + 1) }
  queue.append(p - width)
  queue.append(p + width)
}

guard let output = ctx.makeImage() else {
  fputs("error: cannot render layer\n", stderr)
  exit(1)
}
let outRep = NSBitmapImageRep(cgImage: output)
guard let png = outRep.representation(using: .png, properties: [:]) else {
  fputs("error: cannot encode png\n", stderr)
  exit(1)
}
try! png.write(to: outURL)
print("wrote \(outURL.path) (\(width)x\(height))")
