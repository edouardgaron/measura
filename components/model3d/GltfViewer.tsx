// components/model3d/GltfViewer.tsx
'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF, Center, Environment } from '@react-three/drei'

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  return <Center><primitive object={scene} /></Center>
}

export default function GltfViewer({ url }: { url: string }) {
  return (
    <div className="h-[420px] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-900">
      <Canvas camera={{ position: [10, 8, 12], fov: 45 }} shadows>
        <ambientLight intensity={0.6} />
        <directionalLight position={[8, 12, 6]} intensity={1.1} castShadow />
        <Suspense fallback={null}>
          <Model url={url} />
          <Environment preset="city" />
        </Suspense>
        <OrbitControls enablePan autoRotate autoRotateSpeed={0.6} />
      </Canvas>
    </div>
  )
}
