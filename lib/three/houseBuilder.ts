// lib/three/houseBuilder.ts
import * as THREE from 'three'

export interface HouseParams {
  width: number       // meters
  depth: number       // meters
  wallHeight: number  // meters
  roofType: 'gable' | 'hip' | 'flat' | 'shed'
  roofPitch?: number  // degrees, default 30
}

export interface HouseGeometry {
  walls: THREE.BoxGeometry[]
  roof: THREE.BufferGeometry
  floor: THREE.PlaneGeometry
}

// ─── helpers ────────────────────────────────────────────────────────────────

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180
}

// ─── roof builders ──────────────────────────────────────────────────────────

/**
 * Gable roof: two rectangular slope faces + two triangular gable end faces.
 * The ridge runs along the Z axis (depth direction) at the centre of the
 * width.  Returns a merged BufferGeometry.
 */
function buildGableRoof(
  width: number,
  depth: number,
  wallHeight: number,
  pitchDeg: number
): THREE.BufferGeometry {
  const halfW = width / 2
  const halfD = depth / 2
  const ridgeH = Math.tan(deg2rad(pitchDeg)) * halfW  // height of ridge above wall top
  const apex = wallHeight + ridgeH

  // We build the geometry with manual vertices so the normals are correct.
  // Coordinate system: X = width, Y = height, Z = depth. Origin at (0,0,0)
  // i.e. house centred on X/Z, base at Y=0.

  const positions: number[] = []
  const indices: number[] = []

  function addQuad(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number
  ) {
    const base = positions.length / 3
    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz)
    // two triangles: (0,1,2) and (0,2,3)
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  function addTri(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number
  ) {
    const base = positions.length / 3
    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz)
    indices.push(base, base + 1, base + 2)
  }

  // Left slope  (−X side going up to ridge)
  addQuad(
    -halfW, wallHeight, -halfD,
    0,      apex,       -halfD,
    0,      apex,        halfD,
    -halfW, wallHeight,  halfD
  )

  // Right slope  (+X side going up to ridge)
  addQuad(
    0,     apex,       -halfD,
    halfW, wallHeight, -halfD,
    halfW, wallHeight,  halfD,
    0,     apex,        halfD
  )

  // Front gable triangle  (−Z end)
  addTri(
    -halfW, wallHeight, -halfD,
    halfW,  wallHeight, -halfD,
    0,      apex,       -halfD
  )

  // Back gable triangle  (+Z end)
  addTri(
    halfW,  wallHeight, halfD,
    -halfW, wallHeight, halfD,
    0,      apex,       halfD
  )

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/**
 * Hip roof: four triangular/trapezoidal faces all meeting at a ridge or apex.
 * Long sides are trapezoids; short ends are triangles.
 */
function buildHipRoof(
  width: number,
  depth: number,
  wallHeight: number,
  pitchDeg: number
): THREE.BufferGeometry {
  const halfW = width / 2
  const halfD = depth / 2

  // The ridge length is depth − 2 * (halfW * tan(pitch)) projected on Z.
  // We choose a uniform pitch off all four walls.
  const pitchRad = deg2rad(pitchDeg)
  const riseFromW = Math.tan(pitchRad) * halfW   // rise over half-width
  const riseFromD = Math.tan(pitchRad) * halfD   // rise over half-depth

  // Use the smaller rise to keep the ridge sensible
  const ridgeHalfLength = halfD - halfW * (halfD / halfW)

  // Clamp ridge half length (can be 0 for a pyramid)
  const rhl = Math.max(0, ridgeHalfLength)
  const ridgeH = wallHeight + riseFromW

  const positions: number[] = []
  const indices: number[] = []

  function addQuad(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number
  ) {
    const base = positions.length / 3
    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz)
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  function addTri(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number
  ) {
    const base = positions.length / 3
    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz)
    indices.push(base, base + 1, base + 2)
  }

  if (rhl > 0.001) {
    // Long sides (trapezoids)
    addQuad(
      -halfW, wallHeight, -halfD,
      halfW,  wallHeight, -halfD,
      rhl,    ridgeH,      0,
      -rhl,   ridgeH,      0
    )
    // Wait, let me redo: left/right are the long wall sides; front/back are ends.
    // Long walls along Z axis:
    // Left face (−X)
    addQuad(
      -halfW, wallHeight, -halfD,
      -halfW, wallHeight,  halfD,
      -rhl,   ridgeH,      rhl,
      -rhl,   ridgeH,     -rhl
    )
    // Right face (+X)
    addQuad(
      halfW, wallHeight,  halfD,
      halfW, wallHeight, -halfD,
      rhl,   ridgeH,     -rhl,
      rhl,   ridgeH,      rhl
    )
    // Front end triangle (+Z)
    addTri(
      -halfW, wallHeight, halfD,
      halfW,  wallHeight, halfD,
      0,      wallHeight + riseFromD, halfD
    )
    // Back end triangle (−Z)
    addTri(
      halfW,  wallHeight, -halfD,
      -halfW, wallHeight, -halfD,
      0,      wallHeight + riseFromD, -halfD
    )
    // Ridge top (optional thin cap)
    addQuad(
      -rhl, ridgeH, -0.001,
       rhl, ridgeH, -0.001,
       rhl, ridgeH,  0.001,
      -rhl, ridgeH,  0.001
    )
  } else {
    // Pyramid: 4 triangles
    const apexH = wallHeight + riseFromW
    addTri(-halfW, wallHeight, -halfD,  halfW, wallHeight, -halfD,  0, apexH, 0)
    addTri( halfW, wallHeight, -halfD,  halfW, wallHeight,  halfD,  0, apexH, 0)
    addTri( halfW, wallHeight,  halfD, -halfW, wallHeight,  halfD,  0, apexH, 0)
    addTri(-halfW, wallHeight,  halfD, -halfW, wallHeight, -halfD,  0, apexH, 0)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/** Flat roof: a thin box on top of the walls. */
function buildFlatRoof(width: number, depth: number, wallHeight: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(width + 0.1, 0.15, depth + 0.1)
    .translate(0, wallHeight + 0.075, 0) as unknown as THREE.BufferGeometry
}

/**
 * Shed roof: a single sloped plane from front (low) to back (high).
 * Implemented as a BoxGeometry rotated to represent a slab.
 */
function buildShedRoof(
  width: number,
  depth: number,
  wallHeight: number,
  pitchDeg: number
): THREE.BufferGeometry {
  // Low edge at front (−Z), high edge at back (+Z)
  const pitchRad = deg2rad(pitchDeg)
  const rise = Math.tan(pitchRad) * depth
  const slopedLength = depth / Math.cos(pitchRad)
  const thickness = 0.15

  const positions: number[] = []
  const indices: number[] = []

  const halfW = width / 2

  // Front-bottom, front-top, back-top, back-bottom corners of the slab
  // Front edge at −Z at wallHeight; back edge at +Z at wallHeight+rise
  const frontY = wallHeight
  const backY = wallHeight + rise
  const frontZ = -depth / 2
  const backZ = depth / 2

  function addQuad(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number
  ) {
    const base = positions.length / 3
    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz)
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  // Top sloped face
  addQuad(
    -halfW, frontY, frontZ,
    halfW,  frontY, frontZ,
    halfW,  backY,  backZ,
    -halfW, backY,  backZ
  )
  // Bottom face (underside)
  addQuad(
    halfW,  frontY - thickness, frontZ,
    -halfW, frontY - thickness, frontZ,
    -halfW, backY  - thickness, backZ,
    halfW,  backY  - thickness, backZ
  )
  // Front edge
  addQuad(
    -halfW, frontY - thickness, frontZ,
    halfW,  frontY - thickness, frontZ,
    halfW,  frontY,             frontZ,
    -halfW, frontY,             frontZ
  )
  // Back edge
  addQuad(
    halfW,  backY - thickness, backZ,
    -halfW, backY - thickness, backZ,
    -halfW, backY,             backZ,
    halfW,  backY,             backZ
  )
  // Left edge
  addQuad(
    -halfW, frontY - thickness, frontZ,
    -halfW, frontY,             frontZ,
    -halfW, backY,              backZ,
    -halfW, backY - thickness,  backZ
  )
  // Right edge
  addQuad(
    halfW, frontY,             frontZ,
    halfW, frontY - thickness, frontZ,
    halfW, backY  - thickness, backZ,
    halfW, backY,              backZ
  )

  void slopedLength // suppress unused variable warning

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

// ─── main export ─────────────────────────────────────────────────────────────

export function buildHouseGeometry(params: HouseParams): HouseGeometry {
  const { width, depth, wallHeight, roofType, roofPitch = 30 } = params

  const halfW = width / 2
  const halfD = depth / 2
  const wallThickness = 0.25

  // 4 walls as BoxGeometry instances
  // Front wall (−Z face), back wall (+Z), left (−X), right (+X)
  const frontWall = new THREE.BoxGeometry(width, wallHeight, wallThickness)
  frontWall.translate(0, wallHeight / 2, -halfD + wallThickness / 2)

  const backWall = new THREE.BoxGeometry(width, wallHeight, wallThickness)
  backWall.translate(0, wallHeight / 2, halfD - wallThickness / 2)

  const leftWall = new THREE.BoxGeometry(wallThickness, wallHeight, depth - wallThickness * 2)
  leftWall.translate(-halfW + wallThickness / 2, wallHeight / 2, 0)

  const rightWall = new THREE.BoxGeometry(wallThickness, wallHeight, depth - wallThickness * 2)
  rightWall.translate(halfW - wallThickness / 2, wallHeight / 2, 0)

  // Floor
  const floor = new THREE.PlaneGeometry(width, depth)
  floor.rotateX(-Math.PI / 2)

  // Roof
  let roof: THREE.BufferGeometry
  switch (roofType) {
    case 'gable':
      roof = buildGableRoof(width, depth, wallHeight, roofPitch)
      break
    case 'hip':
      roof = buildHipRoof(width, depth, wallHeight, roofPitch)
      break
    case 'flat':
      roof = buildFlatRoof(width, depth, wallHeight)
      break
    case 'shed':
      roof = buildShedRoof(width, depth, wallHeight, roofPitch)
      break
  }

  return {
    walls: [frontWall, backWall, leftWall, rightWall],
    roof,
    floor,
  }
}
