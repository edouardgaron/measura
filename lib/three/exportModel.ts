// lib/three/exportModel.ts
// ============================================================
// Construit une scène 3D schématique de la maison et l'exporte
// en GLB (pour la RA / model-viewer) ou OBJ (importable SketchUp/Blender).
// Client uniquement (importe three/examples).
// ============================================================

import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js'

export interface HouseColors { walls: string; roof: string; trim: string }
export interface HouseDims { width?: number; depth?: number; height?: number; roofType?: 'gable' | 'hip' | 'flat' | 'shed' }

function wall(w: number, h: number, d: number, x: number, y: number, z: number, color: string): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d)
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, y, z)
  return mesh
}

export function buildHouseScene(dims: HouseDims, colors: HouseColors): THREE.Scene {
  const W = dims.width ?? 10
  const D = dims.depth ?? 8
  const H = dims.height ?? 2.7
  const t = 0.2 // épaisseur des murs

  const scene = new THREE.Scene()
  const house = new THREE.Group()

  // Murs
  house.add(wall(W, H, t, 0, H / 2, D / 2, colors.walls))   // avant
  house.add(wall(W, H, t, 0, H / 2, -D / 2, colors.walls))  // arrière
  house.add(wall(t, H, D, W / 2, H / 2, 0, colors.walls))   // droite
  house.add(wall(t, H, D, -W / 2, H / 2, 0, colors.walls))  // gauche

  // Plancher
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, D), new THREE.MeshStandardMaterial({ color: colors.trim, roughness: 1 }))
  floor.position.y = 0
  house.add(floor)

  // Toit
  const roofType = dims.roofType ?? 'gable'
  const roofMat = new THREE.MeshStandardMaterial({ color: colors.roof, roughness: 0.7 })
  if (roofType === 'flat') {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.3, D + 0.4), roofMat)
    slab.position.y = H + 0.15
    house.add(slab)
  } else {
    // Pignon : prisme triangulaire (ConeGeometry à 4 faces aplati = pyramide)
    const ridge = Math.min(W, D) * 0.35
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(W, D) * 0.72, ridge, 4), roofMat)
    roof.rotation.y = Math.PI / 4
    roof.position.y = H + ridge / 2
    roof.scale.set(W / Math.max(W, D), 1, D / Math.max(W, D))
    house.add(roof)
  }

  scene.add(house)
  return scene
}

export function exportGLB(scene: THREE.Scene): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter()
    exporter.parse(
      scene,
      (result) => {
        const blob = result instanceof ArrayBuffer
          ? new Blob([result], { type: 'model/gltf-binary' })
          : new Blob([JSON.stringify(result)], { type: 'model/gltf+json' })
        resolve(blob)
      },
      (err) => reject(err),
      { binary: true }
    )
  })
}

export function exportOBJ(scene: THREE.Scene): Blob {
  const exporter = new OBJExporter()
  const text = exporter.parse(scene)
  return new Blob([text], { type: 'text/plain' })
}
