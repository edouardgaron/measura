// components/model3d/ModelViewer.tsx
'use client'

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModelViewerProps {
  measurements: { width?: number; depth?: number; height?: number }
  roofType: 'gable' | 'hip' | 'flat' | 'shed'
  colors: { walls: string; roof: string; trim: string }
  onColorsChange: (colors: { walls: string; roof: string; trim: string }) => void
}

// ─── House mesh components ────────────────────────────────────────────────────

interface HouseProps {
  width: number
  depth: number
  wallHeight: number
  roofType: 'gable' | 'hip' | 'flat' | 'shed'
  wallColor: string
  roofColor: string
  trimColor: string
}

function WallMesh({
  position,
  size,
  color,
}: {
  position: [number, number, number]
  size: [number, number, number]
  color: string
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

function GableRoof({
  width,
  depth,
  wallHeight,
  pitchDeg,
  roofColor,
}: {
  width: number
  depth: number
  wallHeight: number
  pitchDeg: number
  roofColor: string
}) {
  const pitchRad = (pitchDeg * Math.PI) / 180
  const halfW = width / 2
  const ridgeH = Math.tan(pitchRad) * halfW
  const slopeLength = halfW / Math.cos(pitchRad)
  const slopeThickness = 0.15

  // Each slope panel is a thin box rotated to the pitch angle
  const slopeAngle = pitchRad
  const pivotY = wallHeight
  const pivotOffsetY = (slopeLength / 2) * Math.sin(slopeAngle) + pivotY
  const pivotOffsetX = (slopeLength / 2) * Math.cos(slopeAngle)

  return (
    <group>
      {/* Left slope */}
      <mesh
        position={[-pivotOffsetX, pivotOffsetY, 0]}
        rotation={[0, 0, slopeAngle]}
        castShadow
      >
        <boxGeometry args={[slopeLength, slopeThickness, depth]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
      {/* Right slope */}
      <mesh
        position={[pivotOffsetX, pivotOffsetY, 0]}
        rotation={[0, 0, -slopeAngle]}
        castShadow
      >
        <boxGeometry args={[slopeLength, slopeThickness, depth]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
      {/* Ridge cap */}
      <mesh position={[0, wallHeight + ridgeH, 0]} castShadow>
        <boxGeometry args={[0.1, 0.1, depth]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
    </group>
  )
}

function HipRoof({
  width,
  depth,
  wallHeight,
  pitchDeg,
  roofColor,
}: {
  width: number
  depth: number
  wallHeight: number
  pitchDeg: number
  roofColor: string
}) {
  // Approximate hip roof as two angled planes (long sides) + pyramid-capped ends
  const pitchRad = (pitchDeg * Math.PI) / 180
  const halfW = width / 2
  const ridgeH = Math.tan(pitchRad) * halfW
  const slopeLength = halfW / Math.cos(pitchRad)
  const ridgeHalfLen = Math.max(0.01, depth / 2 - halfW)
  const slopeThickness = 0.15

  const slopeAngle = pitchRad
  const pivotOffsetY = (slopeLength / 2) * Math.sin(slopeAngle) + wallHeight
  const pivotOffsetX = (slopeLength / 2) * Math.cos(slopeAngle)

  // End slope (shorter trapezoidal approximated as a tilted box)
  const halfD = depth / 2
  const endSlopeLen = halfD / Math.cos(pitchRad)
  const endPivotY = (endSlopeLen / 2) * Math.sin(pitchRad) + wallHeight
  const endPivotZ = (endSlopeLen / 2) * Math.cos(pitchRad)

  return (
    <group>
      {/* Left long slope */}
      <mesh position={[-pivotOffsetX, pivotOffsetY, 0]} rotation={[0, 0, slopeAngle]} castShadow>
        <boxGeometry args={[slopeLength, slopeThickness, depth - width]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
      {/* Right long slope */}
      <mesh position={[pivotOffsetX, pivotOffsetY, 0]} rotation={[0, 0, -slopeAngle]} castShadow>
        <boxGeometry args={[slopeLength, slopeThickness, depth - width]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
      {/* Front hip */}
      <mesh position={[0, endPivotY, endPivotZ]} rotation={[pitchRad, 0, 0]} castShadow>
        <boxGeometry args={[width, slopeThickness, endSlopeLen]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
      {/* Back hip */}
      <mesh position={[0, endPivotY, -endPivotZ]} rotation={[-pitchRad, 0, 0]} castShadow>
        <boxGeometry args={[width, slopeThickness, endSlopeLen]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
      {/* Ridge */}
      <mesh position={[0, wallHeight + ridgeH, 0]} castShadow>
        <boxGeometry args={[0.1, 0.12, ridgeHalfLen * 2]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
    </group>
  )
}

function FlatRoof({
  width,
  depth,
  wallHeight,
  roofColor,
}: {
  width: number
  depth: number
  wallHeight: number
  roofColor: string
}) {
  return (
    <mesh position={[0, wallHeight + 0.1, 0]} receiveShadow castShadow>
      <boxGeometry args={[width + 0.2, 0.2, depth + 0.2]} />
      <meshStandardMaterial color={roofColor} />
    </mesh>
  )
}

function ShedRoof({
  width,
  depth,
  wallHeight,
  pitchDeg,
  roofColor,
}: {
  width: number
  depth: number
  wallHeight: number
  pitchDeg: number
  roofColor: string
}) {
  const pitchRad = (pitchDeg * Math.PI) / 180
  const rise = Math.tan(pitchRad) * depth
  const slopeLength = depth / Math.cos(pitchRad)
  const midY = wallHeight + rise / 2
  const slopeThickness = 0.15

  return (
    <mesh position={[0, midY, 0]} rotation={[pitchRad, 0, 0]} castShadow>
      <boxGeometry args={[width + 0.1, slopeThickness, slopeLength]} />
      <meshStandardMaterial color={roofColor} />
    </mesh>
  )
}

function House({
  width,
  depth,
  wallHeight,
  roofType,
  wallColor,
  roofColor,
  trimColor,
}: HouseProps) {
  const t = 0.25   // wall thickness
  const halfW = width / 2
  const halfD = depth / 2
  const pitchDeg = 30

  return (
    <group>
      {/* Floor slab */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[width, 0.1, depth]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>

      {/* Front wall */}
      <WallMesh position={[0, wallHeight / 2, -halfD + t / 2]} size={[width, wallHeight, t]} color={wallColor} />
      {/* Back wall */}
      <WallMesh position={[0, wallHeight / 2, halfD - t / 2]} size={[width, wallHeight, t]} color={wallColor} />
      {/* Left wall */}
      <WallMesh position={[-halfW + t / 2, wallHeight / 2, 0]} size={[t, wallHeight, depth - t * 2]} color={wallColor} />
      {/* Right wall */}
      <WallMesh position={[halfW - t / 2, wallHeight / 2, 0]} size={[t, wallHeight, depth - t * 2]} color={wallColor} />

      {/* Corner trim */}
      {([ [-halfW, halfD], [halfW, halfD], [-halfW, -halfD], [halfW, -halfD]] as [number, number][]).map(([x, z], i) => (
        <mesh key={i} position={[x, wallHeight / 2, z]} castShadow>
          <boxGeometry args={[0.08, wallHeight, 0.08]} />
          <meshStandardMaterial color={trimColor} />
        </mesh>
      ))}

      {/* Roof */}
      {roofType === 'gable' && (
        <GableRoof width={width} depth={depth} wallHeight={wallHeight} pitchDeg={pitchDeg} roofColor={roofColor} />
      )}
      {roofType === 'hip' && (
        <HipRoof width={width} depth={depth} wallHeight={wallHeight} pitchDeg={pitchDeg} roofColor={roofColor} />
      )}
      {roofType === 'flat' && (
        <FlatRoof width={width} depth={depth} wallHeight={wallHeight} roofColor={roofColor} />
      )}
      {roofType === 'shed' && (
        <ShedRoof width={width} depth={depth} wallHeight={wallHeight} pitchDeg={pitchDeg} roofColor={roofColor} />
      )}
    </group>
  )
}

// ─── Scene ────────────────────────────────────────────────────────────────────

function Scene({
  width,
  depth,
  wallHeight,
  roofType,
  wallColor,
  roofColor,
  trimColor,
}: HouseProps) {
  const groupRef = useRef<THREE.Group>(null)

  // Subtle idle auto-rotate when there is no user interaction
  useFrame((_state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.05
    }
  })

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-8, 12, -8]} intensity={0.4} />

      {/* Grid helper */}
      <Grid
        args={[50, 50]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#9ca3af"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#6b7280"
        fadeDistance={40}
        fadeStrength={1}
        position={[0, -0.001, 0]}
      />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#e5e7eb" />
      </mesh>

      {/* House — wrapped so the idle rotation only applies to the building */}
      <group ref={groupRef}>
        <House
          width={width}
          depth={depth}
          wallHeight={wallHeight}
          roofType={roofType}
          wallColor={wallColor}
          roofColor={roofColor}
          trimColor={trimColor}
        />
      </group>

      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        minDistance={3}
        maxDistance={60}
      />
    </>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

export default function ModelViewer({
  measurements,
  roofType,
  colors,
  onColorsChange,
}: ModelViewerProps) {
  const width = measurements.width ?? 8
  const depth = measurements.depth ?? 10
  const height = measurements.height ?? 3

  function handleColorChange(key: keyof typeof colors, value: string) {
    onColorsChange({ ...colors, [key]: value })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 3D Canvas */}
      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-900 shadow-sm" style={{ height: 480 }}>
        {!measurements.width && !measurements.depth && (
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md bg-black/50 px-2 py-1 text-xs text-white">
            Aperçu — dimensions indicatives (8 × 10 × 3 m)
          </div>
        )}
        <Canvas
          shadows
          camera={{ position: [width * 1.4, height * 2.2, depth * 1.6], fov: 45 }}
          style={{ width: '100%', height: '100%' }}
        >
          <Scene
            width={width}
            depth={depth}
            wallHeight={height}
            roofType={roofType}
            wallColor={colors.walls}
            roofColor={colors.roof}
            trimColor={colors.trim}
          />
        </Canvas>
      </div>

      {/* Color controls */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-medium text-gray-700">Couleurs du modèle</p>
        <div className="flex flex-wrap gap-6">
          <ColorPicker
            label="Murs"
            value={colors.walls}
            onChange={(v) => handleColorChange('walls', v)}
          />
          <ColorPicker
            label="Toit"
            value={colors.roof}
            onChange={(v) => handleColorChange('roof', v)}
          />
          <ColorPicker
            label="Garnitures"
            value={colors.trim}
            onChange={(v) => handleColorChange('trim', v)}
          />
        </div>
      </div>
    </div>
  )
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded border border-gray-300 p-0.5"
      />
      <span className="text-sm text-gray-600">{label}</span>
    </label>
  )
}
