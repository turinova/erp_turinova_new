import React, { useRef, useEffect } from 'react';
import './Squares.css';

type CanvasStrokeStyle = string | CanvasGradient | CanvasPattern;

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  baseColor?: string;
}

interface SquaresProps {
  borderColor?: CanvasStrokeStyle;
  squareSize?: number;
  hoverFillColor?: CanvasStrokeStyle;
  excludeCenter?: boolean;
  centerWidth?: number;
  centerHeight?: number;
}

const Squares: React.FC<SquaresProps> = ({
  borderColor = '#666',
  squareSize = 40,
  hoverFillColor = '#333',
  excludeCenter = false,
  centerWidth = 400,
  centerHeight = 300
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rectanglesRef = useRef<Rectangle[]>([]);
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const lastHoveredIndexRef = useRef<number>(-1);
  const tileColorsRef = useRef<Map<number, string>>(new Map());
  const animatingTilesRef = useRef<Map<number, { brightness: number; direction: number; targetBrightness: number }>>(new Map());
  const animationFrameRef = useRef<number>();
  const lastAnimationTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Binary Space Partitioning - creates perfect mosaic tiling
    const splitSpace = (x: number, y: number, width: number, height: number, depth: number): Rectangle[] => {
      const minSize = squareSize * 0.8;
      
      // Stop splitting if too deep or too small
      if (depth <= 0 || (width < minSize * 2 && height < minSize * 2)) {
        return [{ x, y, width, height }];
      }

      const rects: Rectangle[] = [];
      const canSplitHorizontally = height >= minSize * 2;
      const canSplitVertically = width >= minSize * 2;

      if (!canSplitHorizontally && !canSplitVertically) {
        return [{ x, y, width, height }];
      }

      // Randomly choose split direction
      const splitHorizontally = canSplitHorizontally && (!canSplitVertically || Math.random() > 0.5);

      if (splitHorizontally) {
        // Split horizontally
        const minSplit = minSize;
        const maxSplit = height - minSize;
        const splitY = minSplit + Math.random() * (maxSplit - minSplit);
        
        rects.push(...splitSpace(x, y, width, splitY, depth - 1));
        rects.push(...splitSpace(x, y + splitY, width, height - splitY, depth - 1));
      } else {
        // Split vertically
        const minSplit = minSize;
        const maxSplit = width - minSize;
        const splitX = minSplit + Math.random() * (maxSplit - minSplit);
        
        rects.push(...splitSpace(x, y, splitX, height, depth - 1));
        rects.push(...splitSpace(x + splitX, y, width - splitX, height, depth - 1));
      }

      return rects;
    };

    const generateRectangles = () => {
      if (excludeCenter) {
        // Generate mosaic in 4 sections around the center
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const halfWidth = centerWidth / 2;
        const halfHeight = centerHeight / 2;
        
        const centerLeft = centerX - halfWidth;
        const centerRight = centerX + halfWidth;
        const centerTop = centerY - halfHeight;
        const centerBottom = centerY + halfHeight;
        
        let rects: Rectangle[] = [];
        
        // Top section
        if (centerTop > 0) {
          rects = rects.concat(splitSpace(0, 0, canvas.width, centerTop, 7));
        }
        
        // Bottom section
        if (centerBottom < canvas.height) {
          rects = rects.concat(splitSpace(0, centerBottom, canvas.width, canvas.height - centerBottom, 7));
        }
        
        // Left section (between top and bottom)
        if (centerLeft > 0) {
          rects = rects.concat(splitSpace(0, centerTop, centerLeft, centerBottom - centerTop, 7));
        }
        
        // Right section (between top and bottom)
        if (centerRight < canvas.width) {
          rects = rects.concat(splitSpace(centerRight, centerTop, canvas.width - centerRight, centerBottom - centerTop, 7));
        }
        
        rectanglesRef.current = rects;
      } else {
        // Create perfect tiling with recursive splitting
        const rects = splitSpace(0, 0, canvas.width, canvas.height, 7);
        rectanglesRef.current = rects;
      }
    };

    const drawGrid = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Find the hovered rectangle
      let hoveredIndex = -1;
      if (mousePositionRef.current) {
        for (let i = 0; i < rectanglesRef.current.length; i++) {
          const rect = rectanglesRef.current[i];
          if (
            mousePositionRef.current.x >= rect.x &&
            mousePositionRef.current.x <= rect.x + rect.width &&
            mousePositionRef.current.y >= rect.y &&
            mousePositionRef.current.y <= rect.y + rect.height
          ) {
            hoveredIndex = i;
            break;
          }
        }
      }

      rectanglesRef.current.forEach((rect, index) => {
        let fillColor = 'rgb(255, 255, 255)'; // Default white

        // Check if this tile is being hovered
        if (hoveredIndex === index) {
          // Generate color only once per tile
          if (!tileColorsRef.current.has(index)) {
            const gray = Math.floor(30 + Math.random() * 90);
            tileColorsRef.current.set(index, `rgb(${gray}, ${gray}, ${gray})`);
          }
          fillColor = tileColorsRef.current.get(index)!;
        } 
        // Check if this tile is animating
        else if (animatingTilesRef.current.has(index)) {
          const anim = animatingTilesRef.current.get(index)!;
          const gray = Math.floor(255 - anim.brightness); // Brightness: 0=white, 255=black
          fillColor = `rgb(${gray}, ${gray}, ${gray})`;
        }

        ctx.fillStyle = fillColor;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

        // Always draw borders on top to keep them visible
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      });
      
      // Draw the center exclusion zone if enabled
      if (excludeCenter) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const halfWidth = centerWidth / 2;
        const halfHeight = centerHeight / 2;
        
        // Fill white
        ctx.fillStyle = 'rgb(255, 255, 255)';
        ctx.fillRect(
          centerX - halfWidth,
          centerY - halfHeight,
          centerWidth,
          centerHeight
        );
        
        // Draw border
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(
          centerX - halfWidth,
          centerY - halfHeight,
          centerWidth,
          centerHeight
        );
      }
    };

    // Helper function to find neighboring tiles
    const findNeighbors = (index: number): number[] => {
      const rect = rectanglesRef.current[index];
      const neighbors: number[] = [];
      const tolerance = 2;
      
      rectanglesRef.current.forEach((otherRect, otherIndex) => {
        if (index === otherIndex) return;
        
        // Check if rectangles are adjacent (sharing edges)
        const sharesVerticalEdge = (
          Math.abs(rect.x + rect.width - otherRect.x) < tolerance || 
          Math.abs(otherRect.x + otherRect.width - rect.x) < tolerance
        );
        
        const sharesHorizontalEdge = (
          Math.abs(rect.y + rect.height - otherRect.y) < tolerance || 
          Math.abs(otherRect.y + otherRect.height - rect.y) < tolerance
        );
        
        const overlapX = !(rect.x + rect.width < otherRect.x || otherRect.x + otherRect.width < rect.x);
        const overlapY = !(rect.y + rect.height < otherRect.y || otherRect.y + otherRect.height < rect.y);
        
        if ((sharesVerticalEdge && overlapY) || (sharesHorizontalEdge && overlapX)) {
          neighbors.push(otherIndex);
        }
      });
      
      return neighbors;
    };

    const animate = () => {
      const now = Date.now();
      
      // Only trigger new animation if no tiles are currently animating
      // Wait 800-1200ms between animations
      if (animatingTilesRef.current.size === 0 && now - lastAnimationTimeRef.current > 800 + Math.random() * 400) {
        lastAnimationTimeRef.current = now;
        
        // Pick a random starting tile
        const startIndex = Math.floor(Math.random() * rectanglesRef.current.length);
        const tilesToAnimate = new Set<number>([startIndex]);
        
        // Find all neighbors of the starting tile
        const neighbors = findNeighbors(startIndex);
        
        // Pick 2-4 random neighbors to also animate
        const numNeighborsToAdd = Math.min(2 + Math.floor(Math.random() * 3), neighbors.length);
        
        // Shuffle neighbors and pick first N
        const shuffledNeighbors = neighbors.sort(() => Math.random() - 0.5);
        for (let i = 0; i < numNeighborsToAdd; i++) {
          tilesToAnimate.add(shuffledNeighbors[i]);
        }
        
        // Animate all selected tiles
        tilesToAnimate.forEach(index => {
          const targetBrightness = 80 + Math.random() * 100; // Random darkness level
          animatingTilesRef.current.set(index, {
            brightness: 0,
            direction: 1, // 1 = getting darker, -1 = getting lighter
            targetBrightness: targetBrightness
          });
        });
      }

      // Update all animating tiles (3-5 tiles)
      const toDelete: number[] = [];
      animatingTilesRef.current.forEach((anim, index) => {
        if (anim.direction === 1) {
          // Fade to dark - slower speed
          anim.brightness += 1.5;
          if (anim.brightness >= anim.targetBrightness) {
            anim.direction = -1; // Start fading back
          }
        } else {
          // Fade to white - slower speed
          anim.brightness -= 1.5;
          if (anim.brightness <= 0) {
            toDelete.push(index); // Animation complete
          }
        }
      });

      // Remove completed animations
      toDelete.forEach(index => animatingTilesRef.current.delete(index));

      drawGrid();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      generateRectangles();
      drawGrid();
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // Start animation loop
    animate();

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      mousePositionRef.current = { x: mouseX, y: mouseY };
    };

    const handleMouseLeave = () => {
      mousePositionRef.current = null;
      lastHoveredIndexRef.current = -1;
      tileColorsRef.current.clear(); // Clear colors when leaving
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [borderColor, hoverFillColor, squareSize, excludeCenter, centerWidth, centerHeight]);

  return <canvas ref={canvasRef} className="squares-canvas"></canvas>;
};

export default Squares;

