// Small dependency-free GIF89a encoder using a 3-3-2 RGB palette.
// Frames are RGBA byte arrays of identical dimensions. No image data leaves the browser.
function pushWord(bytes, value) {
  bytes.push(value & 255, (value >> 8) & 255)
}

function lzwEncode(indices) {
  const CLEAR = 256, END = 257
  let codeSize = 9
  let nextCode = 258
  let dictionary = new Map()
  const output = []
  let bitBuffer = 0, bitCount = 0
  const writeCode = function (code) {
    bitBuffer |= code << bitCount
    bitCount += codeSize
    while (bitCount >= 8) {
      output.push(bitBuffer & 255)
      bitBuffer >>= 8
      bitCount -= 8
    }
  }
  const reset = function () {
    dictionary = new Map()
    nextCode = 258
    codeSize = 9
  }
  writeCode(CLEAR)
  if (!indices.length) {
    writeCode(END)
    if (bitCount) output.push(bitBuffer & 255)
    return output
  }
  let prefix = indices[0]
  for (let i = 1; i < indices.length; i++) {
    const next = indices[i]
    const key = prefix * 256 + next
    const found = dictionary.get(key)
    if (found !== undefined) {
      prefix = found
      continue
    }
    writeCode(prefix)
    if (nextCode < 4096) {
      dictionary.set(key, nextCode++)
      if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++
    } else {
      writeCode(CLEAR)
      reset()
    }
    prefix = next
  }
  writeCode(prefix)
  writeCode(END)
  if (bitCount) output.push(bitBuffer & 255)
  return output
}

export function encodeGif(frames, width, height, delay = 18) {
  if (!frames || frames.length < 2 || width < 1 || height < 1) {
    throw new Error('A GIF needs at least two frames and valid dimensions.')
  }
  const bytes = []
  const text = function (value) { for (let i = 0; i < value.length; i++) bytes.push(value.charCodeAt(i)) }
  text('GIF89a')
  pushWord(bytes, width)
  pushWord(bytes, height)
  bytes.push(0xF7, 0, 0) // 256-color global table, 8-bit color resolution
  for (let index = 0; index < 256; index++) {
    const r = (index >> 5) & 7
    const g = (index >> 2) & 7
    const b = index & 3
    bytes.push((r << 5) | (r << 2) | (r >> 1), (g << 5) | (g << 2) | (g >> 1), (b << 6) | (b << 4) | (b << 2) | b)
  }
  // Loop forever for the familiar photobooth GIF effect.
  bytes.push(0x21, 0xFF, 0x0B)
  text('NETSCAPE2.0')
  bytes.push(0x03, 0x01, 0x00, 0x00, 0x00)
  const expected = width * height
  frames.forEach(function (rgba) {
    if (rgba.length !== expected * 4) throw new Error('GIF frame dimensions do not match.')
    const indices = new Uint8Array(expected)
    for (let pixel = 0, offset = 0; pixel < expected; pixel++, offset += 4) {
      indices[pixel] = ((rgba[offset] >> 5) << 5) | ((rgba[offset + 1] >> 5) << 2) | (rgba[offset + 2] >> 6)
    }
    bytes.push(0x21, 0xF9, 0x04, 0x04)
    pushWord(bytes, delay)
    bytes.push(0x00, 0x00)
    bytes.push(0x2C)
    pushWord(bytes, 0)
    pushWord(bytes, 0)
    pushWord(bytes, width)
    pushWord(bytes, height)
    bytes.push(0x00, 0x08)
    const compressed = lzwEncode(indices)
    for (let offset = 0; offset < compressed.length; offset += 255) {
      const chunk = compressed.slice(offset, offset + 255)
      bytes.push(chunk.length, ...chunk)
    }
    bytes.push(0x00)
  })
  bytes.push(0x3B)
  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' })
}
