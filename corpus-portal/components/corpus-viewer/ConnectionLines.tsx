'use client'

import { Line } from '@react-three/drei'

interface ConnectionLinesProps {
  widthM: number
  heightM: number
  depthM: number
  thicknessM: number
  topOffsetM: number
  bottomOffsetM: number
}

export default function ConnectionLines({
  widthM,
  heightM,
  depthM,
  thicknessM,
  topOffsetM,
  bottomOffsetM
}: ConnectionLinesProps) {
  const halfWidth = widthM / 2
  const halfDepth = depthM / 2

  // Calculate panel edge positions
  const topPanelBottomEdge = heightM - thicknessM - topOffsetM
  const topPanelTopEdge = heightM - topOffsetM
  const bottomPanelBottomEdge = bottomOffsetM
  const bottomPanelTopEdge = thicknessM + bottomOffsetM

  // Side panel X positions (inner faces)
  const leftInnerX = -(halfWidth - thicknessM)
  const rightInnerX = +(halfWidth - thicknessM)

  return (
    <group>
      {/* LEFT SIDE - BOTTOM PANEL CONNECTION */}
      {/* Inner corner line (visible from front) - front edge */}
      <Line
        points={[
          [leftInnerX, bottomPanelTopEdge, halfDepth],
          [leftInnerX, bottomPanelTopEdge, -halfDepth]
        ]}
        color="black"
        lineWidth={2}
      />
      
      {/* Vertical edge at front */}
      <Line
        points={[
          [leftInnerX, bottomPanelBottomEdge, halfDepth],
          [leftInnerX, bottomPanelTopEdge, halfDepth]
        ]}
        color="black"
        lineWidth={2}
      />
      
      {/* Vertical edge at back */}
      <Line
        points={[
          [leftInnerX, bottomPanelBottomEdge, -halfDepth],
          [leftInnerX, bottomPanelTopEdge, -halfDepth]
        ]}
        color="black"
        lineWidth={2}
      />

      {/* RIGHT SIDE - BOTTOM PANEL CONNECTION */}
      {/* Inner corner line (visible from front) - front edge */}
      <Line
        points={[
          [rightInnerX, bottomPanelTopEdge, halfDepth],
          [rightInnerX, bottomPanelTopEdge, -halfDepth]
        ]}
        color="black"
        lineWidth={2}
      />
      
      {/* Vertical edge at front */}
      <Line
        points={[
          [rightInnerX, bottomPanelBottomEdge, halfDepth],
          [rightInnerX, bottomPanelTopEdge, halfDepth]
        ]}
        color="black"
        lineWidth={2}
      />
      
      {/* Vertical edge at back */}
      <Line
        points={[
          [rightInnerX, bottomPanelBottomEdge, -halfDepth],
          [rightInnerX, bottomPanelTopEdge, -halfDepth]
        ]}
        color="black"
        lineWidth={2}
      />

      {/* LEFT SIDE - TOP PANEL CONNECTION */}
      {/* Inner corner line (visible from front) - bottom edge of top panel */}
      <Line
        points={[
          [leftInnerX, topPanelBottomEdge, halfDepth],
          [leftInnerX, topPanelBottomEdge, -halfDepth]
        ]}
        color="black"
        lineWidth={2}
      />
      
      {/* Vertical edge at front */}
      <Line
        points={[
          [leftInnerX, topPanelBottomEdge, halfDepth],
          [leftInnerX, topPanelTopEdge, halfDepth]
        ]}
        color="black"
        lineWidth={2}
      />
      
      {/* Vertical edge at back */}
      <Line
        points={[
          [leftInnerX, topPanelBottomEdge, -halfDepth],
          [leftInnerX, topPanelTopEdge, -halfDepth]
        ]}
        color="black"
        lineWidth={2}
      />

      {/* RIGHT SIDE - TOP PANEL CONNECTION */}
      {/* Inner corner line (visible from front) - bottom edge of top panel */}
      <Line
        points={[
          [rightInnerX, topPanelBottomEdge, halfDepth],
          [rightInnerX, topPanelBottomEdge, -halfDepth]
        ]}
        color="black"
        lineWidth={2}
      />
      
      {/* Vertical edge at front */}
      <Line
        points={[
          [rightInnerX, topPanelBottomEdge, halfDepth],
          [rightInnerX, topPanelTopEdge, halfDepth]
        ]}
        color="black"
        lineWidth={2}
      />
      
      {/* Vertical edge at back */}
      <Line
        points={[
          [rightInnerX, topPanelBottomEdge, -halfDepth],
          [rightInnerX, topPanelTopEdge, -halfDepth]
        ]}
        color="black"
        lineWidth={2}
      />
    </group>
  )
}

