// lib/photogrammetry/gltf.ts
// ============================================================
// Construit un fichier glTF 2.0 (JSON + buffer base64 embarqué) à partir
// de boîtes colorées. Pur Node — aucune dépendance, valide pour three.js
// (useGLTF) et <model-viewer>.
// ============================================================

export interface Box {
  center: [number, number, number]
  size: [number, number, number]
  color: string // hex #rrggbb
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [0.8, 0.8, 0.8]
  const n = parseInt(m[1], 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

// 8 coins d'une boîte centrée
function boxCorners(cx: number, cy: number, cz: number, w: number, h: number, d: number): number[] {
  const x0 = cx - w / 2, x1 = cx + w / 2
  const y0 = cy - h / 2, y1 = cy + h / 2
  const z0 = cz - d / 2, z1 = cz + d / 2
  return [
    x0, y0, z0,  x1, y0, z0,  x1, y1, z0,  x0, y1, z0, // face z0
    x0, y0, z1,  x1, y0, z1,  x1, y1, z1,  x0, y1, z1, // face z1
  ]
}

// 12 triangles (36 indices) référant les 8 coins
const BOX_INDICES = [
  0, 1, 2, 0, 2, 3,   // arrière
  4, 6, 5, 4, 7, 6,   // avant
  0, 4, 5, 0, 5, 1,   // bas
  3, 2, 6, 3, 6, 7,   // haut
  0, 3, 7, 0, 7, 4,   // gauche
  1, 5, 6, 1, 6, 2,   // droite
]

/** Génère un glTF 2.0 (chaîne JSON) représentant les boîtes fournies. */
export function buildGltf(boxes: Box[]): string {
  // Buffers : positions (float32) puis indices (uint16)
  const posPerBox = 8 * 3 * 4 // 96 octets
  const idxPerBox = 36 * 2    // 72 octets
  const positionsBytes = boxes.length * posPerBox
  // Aligne le bloc d'indices sur 4 octets
  const indicesStart = Math.ceil(positionsBytes / 4) * 4
  const totalBytes = indicesStart + boxes.length * idxPerBox

  const buf = new ArrayBuffer(totalBytes)
  const posView = new DataView(buf)
  const idxView = new DataView(buf)

  const accessors: unknown[] = []
  const materials: unknown[] = []
  const primitives: unknown[] = []

  boxes.forEach((box, i) => {
    const corners = boxCorners(box.center[0], box.center[1], box.center[2], box.size[0], box.size[1], box.size[2])
    const posOffset = i * posPerBox
    let min = [Infinity, Infinity, Infinity]
    let max = [-Infinity, -Infinity, -Infinity]
    for (let v = 0; v < corners.length; v += 3) {
      for (let a = 0; a < 3; a++) {
        const val = corners[v + a]
        posView.setFloat32(posOffset + (v + a) * 4, val, true)
        if (val < min[a]) min[a] = val
        if (val > max[a]) max[a] = val
      }
    }
    const idxOffset = indicesStart + i * idxPerBox
    BOX_INDICES.forEach((ix, k) => idxView.setUint16(idxOffset + k * 2, ix, true))

    // Accessor POSITION (2*i) et indices (2*i+1)
    accessors.push({ bufferView: 0, byteOffset: posOffset, componentType: 5126, count: 8, type: 'VEC3', min, max })
    accessors.push({ bufferView: 1, byteOffset: i * idxPerBox, componentType: 5123, count: 36, type: 'SCALAR' })

    const [r, g, b] = hexToRgb(box.color)
    materials.push({ pbrMetallicRoughness: { baseColorFactor: [r, g, b, 1], metallicFactor: 0, roughnessFactor: 0.9 } })

    primitives.push({ attributes: { POSITION: i * 2 }, indices: i * 2 + 1, material: i })
  })

  const base64 = Buffer.from(buf).toString('base64')

  const gltf = {
    asset: { version: '2.0', generator: 'Measura Photogrammetry' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'Bâtiment' }],
    meshes: [{ primitives }],
    materials,
    accessors,
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positionsBytes, target: 34962 },
      { buffer: 0, byteOffset: indicesStart, byteLength: boxes.length * idxPerBox, target: 34963 },
    ],
    buffers: [{ byteLength: totalBytes, uri: `data:application/octet-stream;base64,${base64}` }],
  }

  return JSON.stringify(gltf)
}
