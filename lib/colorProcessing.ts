export function convertToGrayscale(imageData: ImageData): ImageData {
  const { width, height, data } = imageData
  const grayscaleData = new Uint8ClampedArray(width * height * 4)

  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    grayscaleData[i] = gray
    grayscaleData[i + 1] = gray
    grayscaleData[i + 2] = gray
    grayscaleData[i + 3] = data[i + 3]
  }

  return new ImageData(grayscaleData, width, height)
}

const RYBK_COLORS = [
  { r: 255, g: 0, b: 0 }, // Red
  { r: 255, g: 255, b: 0 }, // Yellow
  { r: 0, g: 0, b: 255 }, // Blue
  { r: 0, g: 0, b: 0 }, // Black
]

const CMYK_COLORS = [
  { r: 0, g: 255, b: 255 }, // Cyan
  { r: 255, g: 0, b: 255 }, // Magenta
  { r: 255, g: 255, b: 0 }, // Yellow
  { r: 0, g: 0, b: 0 }, // Black
]

function findClosestRYBK(r: number, g: number, b: number): [number, number, number] {
  let bestDist = Number.POSITIVE_INFINITY
  let chosen: [number, number, number] = [0, 0, 0]
  for (const c of RYBK_COLORS) {
    const dr = r - c.r,
      dg = g - c.g,
      db = b - c.b
    const dist = dr * dr + dg * dg + db * db
    if (dist < bestDist) {
      bestDist = dist
      chosen = [c.r, c.g, c.b]
    }
  }
  return chosen
}

function findClosestCMYK(r: number, g: number, b: number): [number, number, number] {
  let bestDist = Number.POSITIVE_INFINITY
  let chosen: [number, number, number] = [0, 0, 0]
  for (const c of CMYK_COLORS) {
    const dr = r - c.r,
      dg = g - c.g,
      db = b - c.b
    const dist = dr * dr + dg * dg + db * db
    if (dist < bestDist) {
      bestDist = dist
      chosen = [c.r, c.g, c.b]
    }
  }
  return chosen
}

function clamp(v: number): number {
  return Math.min(255, Math.max(0, Math.round(v)))
}

export function dither(
  imageData: ImageData,
  colorMode: "rybk" | "cmyk",
  blackThreshold: number,
  whiteThreshold: number,
  enableDithering: boolean,
): ImageData {
  const { width, height, data } = imageData
  const newData = new Uint8ClampedArray(data)
  const findClosestColor = colorMode === "rybk" ? findClosestRYBK : findClosestCMYK

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const oldR = newData[idx],
        oldG = newData[idx + 1],
        oldB = newData[idx + 2]

      const brightness = (oldR + oldG + oldB) / (3 * 255)
      let newR, newG, newB

      if (brightness <= blackThreshold) {
        ;[newR, newG, newB] = [0, 0, 0]
      } else if (brightness >= whiteThreshold) {
        ;[newR, newG, newB] = [255, 255, 255]
      } else {
        ;[newR, newG, newB] = findClosestColor(oldR, oldG, oldB)
      }

      newData[idx] = newR
      newData[idx + 1] = newG
      newData[idx + 2] = newB

      if (enableDithering) {
        const errR = oldR - newR
        const errG = oldG - newG
        const errB = oldB - newB

        // Floyd-Steinberg dithering
        function addError(nx: number, ny: number, w: number) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nidx = (ny * width + nx) * 4
            newData[nidx] = clamp(newData[nidx] + errR * w)
            newData[nidx + 1] = clamp(newData[nidx + 1] + errG * w)
            newData[nidx + 2] = clamp(newData[nidx + 2] + errB * w)
          }
        }

        addError(x + 1, y, 7 / 16)
        addError(x - 1, y + 1, 3 / 16)
        addError(x, y + 1, 5 / 16)
        addError(x + 1, y + 1, 1 / 16)
      }
    }
  }

  return new ImageData(newData, width, height)
}

export function getColorFromRGB(
  r: number,
  g: number,
  b: number,
  colorMode: "monochrome" | "rybk" | "cmyk",
  blackThreshold: number,
  whiteThreshold: number,
): string {
  const brightness = (r + g + b) / (3 * 255)

  if (brightness <= blackThreshold) return "#000000"
  if (brightness >= whiteThreshold) return "#FFFFFF"

  if (colorMode === "monochrome") {
    return "rgb(0,0,0)"
  }

  const findClosestColor = colorMode === "rybk" ? findClosestRYBK : findClosestCMYK
  const [newR, newG, newB] = findClosestColor(r, g, b)
  return `rgb(${newR},${newG},${newB})`
}

export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

