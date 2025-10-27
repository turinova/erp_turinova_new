'use client'

import { Edges } from '@react-three/drei'

interface PanelProps {
  size: [number, number, number]
  position: [number, number, number]
}

export default function Panel({ size, position }: PanelProps) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshBasicMaterial color="white" />
      <Edges color="black" linewidth={1} />
    </mesh>
  )
}

