"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { uniformGridHalftone, circlePacking, type Circle } from "@/lib/dotAlgorithms"
import { Progress } from "@/components/ui/progress"

type ColorMode = "monochrome" | "cmyk" | "rybk"
type HalftoneMode = "uniform" | "packing"

export default function DotApp() {
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null)
  const [dotSize, setDotSize] = useState(10)
  const [minRadius, setMinRadius] = useState(2)
  const [maxRadius, setMaxRadius] = useState(20)
  const [brightness, setBrightness] = useState(0)
  const [contrast, setContrast] = useState(0)
  const [progress, setProgress] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [circles, setCircles] = useState<Circle[]>([])
  const [thresholdRange, setThresholdRange] = useState<[number, number]>([0.05, 0.85])
  const [colorMode, setColorMode] = useState<ColorMode>("monochrome")
  const [halftoneMode, setHalftoneMode] = useState<HalftoneMode>("uniform")

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const img = new Image()
      img.onload = () => {
        setOriginalImage(img)
        const canvas = document.createElement("canvas")
        const maxSize = 800
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        canvas.width = img.width * scale
        canvas.height = img.height * scale

        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          setImageData(imgData)
        }
      }
      img.src = URL.createObjectURL(file)
    }
  }

  useEffect(() => {
    if (imageData && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!

      canvas.width = imageData.width
      canvas.height = imageData.height

      setProgress(0)
      const startTime = Date.now()

      let newCircles: Circle[]
      if (halftoneMode === "uniform") {
        newCircles = uniformGridHalftone(
          imageData,
          dotSize,
          brightness,
          contrast,
          1, // Use a fixed gamma value of 1
          thresholdRange[0],
          thresholdRange[1],
          colorMode,
        )
      } else {
        newCircles = circlePacking(
          imageData,
          minRadius,
          maxRadius,
          brightness,
          contrast,
          1, // Use a fixed gamma value of 1
          thresholdRange[0],
          thresholdRange[1],
          colorMode,
        )
      }

      const endTime = Date.now()
      console.log(`Processing time: ${endTime - startTime}ms`)

      setCircles(newCircles)
      setProgress(100)

      // Clear canvas
      ctx.fillStyle = "white"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw circles
      newCircles.forEach((circle) => {
        ctx.beginPath()
        ctx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2)
        ctx.fillStyle = circle.color
        ctx.fill()
      })
    }
  }, [imageData, dotSize, minRadius, maxRadius, brightness, contrast, thresholdRange, colorMode, halftoneMode])

  const generateSVG = () => {
    if (!imageData) return

    let svgContent = `<svg width="${imageData.width}" height="${imageData.height}" xmlns="http://www.w3.org/2000/svg">`

    // Add circles
    circles.forEach((circle) => {
      svgContent += `<circle cx="${circle.x}" cy="${circle.y}" r="${circle.r}" fill="${circle.color}"/>`
    })

    svgContent += "</svg>"
    return svgContent
  }

  const handleExportSVG = () => {
    const svgContent = generateSVG()
    if (svgContent) {
      const blob = new Blob([svgContent], { type: "image/svg+xml" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "dot_image.svg"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="container mx-auto p-4 bg-[#ff4040] min-h-screen font-mono">
      <h1
        className="text-6xl font-bold mb-8 text-white transform -rotate-2 glitch"
        style={{ textShadow: "3px 3px 0 #000, -3px -3px 0 #000" }}
      >
        POP DOT APP
      </h1>
      <div className="grid grid-cols-2 gap-8 relative">
        <div className="bg-[#90EE90] p-6 rounded-lg transform rotate-1 shadow-lg">
          <Label htmlFor="image-upload" className="text-2xl text-black mb-2 block">
            UPLOAD IMAGE
          </Label>
          <Input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="bg-white text-black p-2 w-full border-4 border-black"
          />
        </div>
        <div className="bg-[#FFD700] p-6 rounded-lg transform -rotate-1 shadow-lg">
          <Label htmlFor="halftone-mode" className="text-2xl text-black mb-2 block">
            HALFTONE MODE
          </Label>
          <Select onValueChange={(value: HalftoneMode) => setHalftoneMode(value)} value={halftoneMode}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a halftone mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="uniform">Uniform Grid</SelectItem>
              <SelectItem value="packing">Circle Packing</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {halftoneMode === "uniform" ? (
          <div className="bg-[#FFD700] p-6 rounded-lg transform -rotate-1 shadow-lg">
            <Label htmlFor="dot-size" className="text-2xl text-black mb-2 block">
              DOT SIZE
            </Label>
            <Slider
              id="dot-size"
              min={5}
              max={50}
              step={1}
              value={[dotSize]}
              onValueChange={(value) => setDotSize(value[0])}
              className="w-full"
            />
          </div>
        ) : (
          <div className="bg-[#FFD700] p-6 rounded-lg transform -rotate-1 shadow-lg">
            <Label htmlFor="radius-range" className="text-2xl text-black mb-2 block">
              RADIUS RANGE
            </Label>
            <Slider
              id="radius-range"
              min={1}
              max={50}
              step={1}
              value={[minRadius, maxRadius]}
              onValueChange={(value) => {
                setMinRadius(value[0])
                setMaxRadius(value[1])
              }}
              className="w-full"
            />
            <div className="flex justify-between mt-2">
              <span>Min: {minRadius}px</span>
              <span>Max: {maxRadius}px</span>
            </div>
          </div>
        )}
        <div className="bg-[#87CEEB] p-6 rounded-lg transform rotate-1 shadow-lg">
          <Label htmlFor="brightness" className="text-2xl text-black mb-2 block">
            BRIGHTNESS
          </Label>
          <Slider
            id="brightness"
            min={-100}
            max={100}
            step={1}
            value={[brightness]}
            onValueChange={(value) => setBrightness(value[0])}
            className="w-full"
          />
        </div>
        <div className="bg-[#90EE90] p-6 rounded-lg transform -rotate-1 shadow-lg">
          <Label htmlFor="contrast" className="text-2xl text-black mb-2 block">
            CONTRAST
          </Label>
          <Slider
            id="contrast"
            min={-100}
            max={100}
            step={1}
            value={[contrast]}
            onValueChange={(value) => setContrast(value[0])}
            className="w-full"
          />
        </div>
        <div className="bg-white p-6 rounded-lg transform -rotate-1 shadow-lg">
          <Label htmlFor="threshold-range" className="text-2xl text-black mb-2 block">
            BLACK/WHITE THRESHOLD
          </Label>
          <Slider
            id="threshold-range"
            min={0}
            max={1}
            step={0.01}
            value={thresholdRange}
            onValueChange={(value) => setThresholdRange(value as [number, number])}
            className="w-full"
          />
          <div className="flex justify-between mt-2">
            <span>Black: {(thresholdRange[0] * 100).toFixed(0)}%</span>
            <span>White: {(thresholdRange[1] * 100).toFixed(0)}%</span>
          </div>
        </div>
        <div className="bg-purple-500 p-6 rounded-lg transform rotate-1 shadow-lg">
          <Label htmlFor="color-mode" className="text-2xl text-white mb-2 block">
            COLOR MODE
          </Label>
          <Select onValueChange={(value: ColorMode) => setColorMode(value)} value={colorMode}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a color mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monochrome">Monochrome</SelectItem>
              <SelectItem value="cmyk">CMYK</SelectItem>
              <SelectItem value="rybk">RYBK</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {imageData && (
        <div className="mt-8 flex items-center gap-8">
          <div className="bg-black p-4 inline-block transform rotate-1 w-1/2">
            <canvas ref={canvasRef} className="w-full border-4 border-white shadow-lg" />
          </div>
          <div className="relative flex-1 flex items-center justify-center min-h-[400px]">
            <Button
              onClick={handleExportSVG}
              className="relative bg-[#FFD700] hover:bg-[#8A2BE2] text-black hover:text-white font-bold py-12 px-24 text-5xl rounded transform rotate-2 transition-all duration-300 shadow-lg w-full border-4 border-black"
            >
              Export as SVG
            </Button>
          </div>
        </div>
      )}
      <div className="mt-4">
        <Progress value={progress} className="w-full" />
      </div>
      <style jsx global>{`
        @keyframes glitch {
          0% { transform: translate(0) rotate(-2deg); }
          20% { transform: translate(-2px, 2px) rotate(-2deg); }
          40% { transform: translate(-2px, -2px) rotate(-2deg); }
          60% { transform: translate(2px, 2px) rotate(-2deg); }
          80% { transform: translate(2px, -2px) rotate(-2deg); }
          100% { transform: translate(0) rotate(-2deg); }
        }
        .glitch {
          animation: glitch 0.3s infinite;
        }
        .group:hover .starburst {
          transform: scale(1.2) rotate(15deg);
        }
      `}</style>
    </div>
  )
}

