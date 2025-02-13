export interface Circle {
  x: number
  y: number
  r: number
  color: string
}

const CMYK_COLORS = [
  { r: 0, g: 255, b: 255 }, // Cyan
  { r: 255, g: 0, b: 255 }, // Magenta
  { r: 255, g: 255, b: 0 }, // Yellow
  { r: 0, g: 0, b: 0 }, // Black
]

const RYBK_COLORS = [
  { r: 255, g: 0, b: 0 }, // Red
  { r: 255, g: 255, b: 0 }, // Yellow
  { r: 0, g: 0, b: 255 }, // Blue
  { r: 0, g: 0, b: 0 }, // Black
]

function findClosestColor(r: number, g: number, b: number, colorPalette: typeof CMYK_COLORS): string {
  let minDistance = Number.POSITIVE_INFINITY
  let closestColor = { r: 0, g: 0, b: 0 }

  for (const color of colorPalette) {
    const distance = Math.sqrt(Math.pow(r - color.r, 2) + Math.pow(g - color.g, 2) + Math.pow(b - color.b, 2))
    if (distance < minDistance) {
      minDistance = distance
      closestColor = color
    }
  }

  return `rgb(${closestColor.r},${closestColor.g},${closestColor.b})`
}

export function uniformGridHalftone(
  imageData: ImageData,
  gridSize: number,
  brightnessAdj: number,
  contrastAdj: number,
  gammaVal: number,
  blackThreshold: number,
  whiteThreshold: number,
  colorMode: "monochrome" | "cmyk" | "rybk",
): Circle[] {
  const { width, height, data } = imageData
  const circles: Circle[] = []

  // Compute grayscale value per pixel
  const grayData = new Float32Array(width * height)
  const contrastFactor = (259 * (contrastAdj + 255)) / (255 * (259 - contrastAdj))

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2]
    let gray = 0.299 * r + 0.587 * g + 0.114 * b
    gray = contrastFactor * (gray - 128) + 128 + brightnessAdj
    gray = Math.max(0, Math.min(255, gray))
    gray = 255 * Math.pow(gray / 255, 1 / gammaVal)
    grayData[i / 4] = gray
  }

  // Divide the image into grid cells
  const numCols = Math.ceil(width / gridSize)
  const numRows = Math.ceil(height / gridSize)
  const cellValues = new Float32Array(numRows * numCols)

  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      let sum = 0,
        count = 0
      const startY = row * gridSize
      const startX = col * gridSize
      const endY = Math.min(startY + gridSize, height)
      const endX = Math.min(startX + gridSize, width)
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          sum += grayData[y * width + x]
          count++
        }
      }
      cellValues[row * numCols + col] = sum / count
    }
  }

  // Generate circles
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const brightnessValue = cellValues[row * numCols + col]

      // Apply black and white thresholds
      if (brightnessValue <= blackThreshold * 255) {
        const centerX = col * gridSize + gridSize / 2
        const centerY = row * gridSize + gridSize / 2
        circles.push({ x: centerX, y: centerY, r: gridSize / 2, color: "black" })
      } else if (brightnessValue >= whiteThreshold * 255) {
        // Don't add a circle for white areas
        continue
      } else {
        const norm = (brightnessValue - blackThreshold * 255) / ((whiteThreshold - blackThreshold) * 255)
        const clampedNorm = Math.max(0, Math.min(1, norm))
        const maxRadius = gridSize / 2
        const radius = maxRadius * (1 - clampedNorm)
        if (radius > 0.5) {
          const centerX = col * gridSize + gridSize / 2
          const centerY = row * gridSize + gridSize / 2

          let color: string
          if (colorMode === "monochrome") {
            color = "black"
          } else {
            const startIdx = (row * gridSize * width + col * gridSize) * 4
            const r = data[startIdx]
            const g = data[startIdx + 1]
            const b = data[startIdx + 2]
            color = findClosestColor(r, g, b, colorMode === "cmyk" ? CMYK_COLORS : RYBK_COLORS)
          }

          circles.push({ x: centerX, y: centerY, r: radius, color })
        }
      }
    }
  }

  return circles
}

export function circlePacking(
  imageData: ImageData,
  minRadius: number,
  maxRadius: number,
  brightnessAdj: number,
  contrastAdj: number,
  gammaVal: number,
  blackThreshold: number,
  whiteThreshold: number,
  colorMode: "monochrome" | "cmyk" | "rybk",
): Circle[] {
  const { width, height, data } = imageData
  const circles: Circle[] = []
  const grid: boolean[][] = Array(height)
    .fill(null)
    .map(() => Array(width).fill(false))

  // Apply brightness, contrast, and gamma adjustments
  const adjustedData = new Uint8ClampedArray(data.length)
  const contrastFactor = (259 * (contrastAdj + 255)) / (255 * (259 - contrastAdj))

  for (let i = 0; i < data.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      let value = data[i + j]
      value = contrastFactor * (value - 128) + 128 + brightnessAdj
      value = Math.max(0, Math.min(255, value))
      value = 255 * Math.pow(value / 255, 1 / gammaVal)
      adjustedData[i + j] = value
    }
    adjustedData[i + 3] = data[i + 3] // Alpha channel
  }

  function isValidCircle(x: number, y: number, r: number): boolean {
    if (x - r < 0 || x + r >= width || y - r < 0 || y + r >= height) {
      return false
    }

    for (let i = Math.max(0, Math.floor(y - r)); i < Math.min(height, Math.ceil(y + r)); i++) {
      for (let j = Math.max(0, Math.floor(x - r)); j < Math.min(width, Math.ceil(x + r)); j++) {
        if (grid[i][j] && Math.sqrt(Math.pow(i - y, 2) + Math.pow(j - x, 2)) <= r) {
          return false
        }
      }
    }

    return true
  }

  function addCircle(x: number, y: number, r: number): void {
    for (let i = Math.max(0, Math.floor(y - r)); i < Math.min(height, Math.ceil(y + r)); i++) {
      for (let j = Math.max(0, Math.floor(x - r)); j < Math.min(width, Math.ceil(x + r)); j++) {
        if (Math.sqrt(Math.pow(i - y, 2) + Math.pow(j - x, 2)) <= r) {
          grid[i][j] = true
        }
      }
    }
  }

  const totalPixels = width * height
  let filledPixels = 0
  let attempts = 0
  const maxAttempts = totalPixels * 0.1 // 10% of total pixels as max attempts

  while (filledPixels < totalPixels * 0.5 && attempts < maxAttempts) {
    attempts++
    const x = Math.random() * width
    const y = Math.random() * height
    const idx = (Math.floor(y) * width + Math.floor(x)) * 4

    const brightness = (adjustedData[idx] + adjustedData[idx + 1] + adjustedData[idx + 2]) / (3 * 255)

    if (brightness <= blackThreshold || brightness >= whiteThreshold) {
      continue
    }

    const maxPossibleRadius = Math.min(
      x,
      y,
      width - x,
      height - y,
      maxRadius,
      minRadius + (maxRadius - minRadius) * (1 - brightness),
    )

    let r = maxPossibleRadius
    while (r >= minRadius) {
      if (isValidCircle(x, y, r)) {
        addCircle(x, y, r)
        let color: string
        if (colorMode === "monochrome") {
          color = "black"
        } else {
          const r = adjustedData[idx]
          const g = adjustedData[idx + 1]
          const b = adjustedData[idx + 2]
          color = findClosestColor(r, g, b, colorMode === "cmyk" ? CMYK_COLORS : RYBK_COLORS)
        }
        circles.push({ x, y, r, color })
        filledPixels += Math.PI * r * r
        break
      }
      r -= 0.5
    }
  }

  return circles
}

