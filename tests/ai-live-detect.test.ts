// tests/ai-live-detect.test.ts
// ------------------------------------------------------------------
// Test EN DIRECT de la détection d'ouvertures par vision Claude.
// Ne s'exécute QUE si ANTHROPIC_API_KEY est définie (sinon ignoré).
// Appel réseau réel + coût en jetons → manuel.
//   ANTHROPIC_API_KEY=sk-ant-... \
//   AI_TEST_IMAGE_URL=<url façade> AI_TEST_WIDTH=32 AI_TEST_HEIGHT=18 \
//   npx vitest run tests/ai-live-detect.test.ts
// ------------------------------------------------------------------
import { test, expect } from 'vitest'
import { detectOpenings } from '@/lib/ai/detectOpenings'

const KEY = process.env.ANTHROPIC_API_KEY
const runLive = KEY ? test : test.skip

// Image de façade par défaut (remplaçable via AI_TEST_IMAGE_URL).
const IMAGE = process.env.AI_TEST_IMAGE_URL
  ?? 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Sears_Catalog_Home_-_The_Vallonia.jpg/640px-Sears_Catalog_Home_-_The_Vallonia.jpg'
const WIDTH = Number(process.env.AI_TEST_WIDTH ?? 32)
const HEIGHT = Number(process.env.AI_TEST_HEIGHT ?? 18)

runLive('détecte les ouvertures sur une vraie photo de façade', async () => {
  const res = await detectOpenings({ imageUrl: IMAGE, sideWidthFt: WIDTH, wallHeightFt: HEIGHT })
  console.log('configured:', res.configured, '| wallFound:', res.wallFound, '| warning:', res.warning ?? '—')
  console.log(`Façade ${WIDTH}×${HEIGHT} → ${res.openings.length} ouverture(s) :`)
  for (const o of res.openings) {
    console.log(
      `  ${o.type.padEnd(7)} X=${o.position_x.toFixed(1)}  allège=${o.sill_height.toFixed(1)}  ` +
      `L=${o.width.toFixed(1)}  H=${o.height.toFixed(1)}  conf=${(o.confidence * 100).toFixed(0)}%`
    )
  }
  expect(res.configured).toBe(true)
  // On vérifie surtout que l'appel aboutit et que les coords restent dans le mur.
  for (const o of res.openings) {
    expect(o.position_x).toBeGreaterThanOrEqual(0)
    expect(o.position_x + o.width).toBeLessThanOrEqual(WIDTH + 0.5)
    expect(o.sill_height + o.height).toBeLessThanOrEqual(HEIGHT + 0.5)
  }
}, 60_000)
