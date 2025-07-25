import React, { useRef, useEffect, useCallback, useState } from 'react';

/**
 * GameCanvas - Renders the 2D game world using HTML5 Canvas
 */
function GameCanvas({ gameState, className = '' }) {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [showGrid, setShowGrid] = useState(true);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Update canvas size on window resize
  useEffect(() => {
    const updateCanvasSize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const container = canvas.parentElement;
      const rect = container.getBoundingClientRect();
      
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      
      setCanvasSize({ width, height });
      
      // Set actual canvas size
      canvas.width = width;
      canvas.height = height;
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Main render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvasSize;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Save context state
    ctx.save();

    // Apply camera transform
    ctx.translate(width / 2 - camera.x, height / 2 - camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // Draw background gradient
    drawBackground(ctx, width, height);

    // Draw grid if enabled
    if (showGrid) {
      drawGrid(ctx, width, height);
    }

    // Draw entities
    if (gameState.entities) {
      gameState.entities.forEach(entity => {
        drawEntity(ctx, entity);
      });
    }

    // Restore context state
    ctx.restore();

    // Draw UI overlay
    drawUI(ctx, width, height);

  }, [gameState, canvasSize, camera, showGrid, showDebugInfo]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      render();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render]);

  // Draw background
  const drawBackground = (ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1a1a3a');
    gradient.addColorStop(1, '#0f0f23');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(-width, -height, width * 3, height * 3);
  };

  // Draw grid
  const drawGrid = (ctx, width, height) => {
    const gridSize = 50;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    // Calculate grid bounds
    const startX = Math.floor((-width / 2 - camera.x) / gridSize) * gridSize;
    const endX = Math.ceil((width / 2 - camera.x) / gridSize) * gridSize;
    const startY = Math.floor((-height / 2 - camera.y) / gridSize) * gridSize;
    const endY = Math.ceil((height / 2 - camera.y) / gridSize) * gridSize;

    // Draw vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }

    // Draw origin
    ctx.strokeStyle = 'rgba(74, 144, 226, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 10);
    ctx.stroke();
  };

  // Draw individual entity
  const drawEntity = (ctx, entity) => {
    const transform = entity.components?.TransformComponent?.data;
    const render = entity.components?.RenderComponent?.data;

    if (!transform || !render || !render.visible) return;

    const { position, rotation = 0, scale = { x: 1, y: 1 } } = transform;
    const { color = '#ffffff', shape = 'rectangle', width = 32, height = 32, opacity = 1 } = render;

    ctx.save();

    // Apply transform
    ctx.translate(position.x, position.y);
    ctx.rotate(rotation);
    ctx.scale(scale.x, scale.y);

    // Set opacity
    ctx.globalAlpha = opacity;

    // Draw shape
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;

    switch (shape) {
      case 'rectangle':
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.strokeRect(-width / 2, -height / 2, width, height);
        break;
        
      case 'circle':
        const radius = Math.max(width, height) / 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
        
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(0, -height / 2);
        ctx.lineTo(-width / 2, height / 2);
        ctx.lineTo(width / 2, height / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
        
      default:
        // Default to rectangle
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.strokeRect(-width / 2, -height / 2, width, height);
    }

    // Draw entity ID if debug mode
    if (showDebugInfo) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(entity.id, 0, height / 2 + 15);
      
      // Draw tags
      if (entity.tags.length > 0) {
        ctx.font = '8px monospace';
        ctx.fillText(entity.tags.join(', '), 0, height / 2 + 25);
      }
    }

    ctx.restore();
  };

  // Draw UI overlay
  const drawUI = (ctx, width, height) => {
    // Game status
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 200, 60);
    
    ctx.fillStyle = 'white';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'left';
    
    const isRunning = gameState?.running;
    ctx.fillText(`Game: ${isRunning ? 'Running' : 'Stopped'}`, 20, 30);
    ctx.fillText(`Entities: ${gameState?.entities?.length || 0}`, 20, 45);
    ctx.fillText(`Camera: ${Math.round(camera.x)}, ${Math.round(camera.y)}`, 20, 60);

    // Controls help
    if (showDebugInfo) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(width - 160, 10, 150, 80);
      
      ctx.fillStyle = 'white';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText('Controls:', width - 150, 25);
      ctx.fillText('WASD: Move camera', width - 150, 40);
      ctx.fillText('Scroll: Zoom', width - 150, 55);
      ctx.fillText('G: Toggle grid', width - 150, 70);
      ctx.fillText('I: Toggle debug', width - 150, 85);
    }
  };

  // Handle mouse events for camera control
  const handleMouseDown = (event) => {
    // TODO: Implement mouse drag for camera panning
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    setCamera(prev => ({
      ...prev,
      zoom: Math.max(0.1, Math.min(5, prev.zoom * zoomFactor))
    }));
  };

  // Handle keyboard events for camera and debug controls
  useEffect(() => {
    const handleKeyDown = (event) => {
      const moveSpeed = 10 / camera.zoom;
      
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          setCamera(prev => ({ ...prev, y: prev.y - moveSpeed }));
          break;
        case 'KeyS':
        case 'ArrowDown':
          setCamera(prev => ({ ...prev, y: prev.y + moveSpeed }));
          break;
        case 'KeyA':
        case 'ArrowLeft':
          setCamera(prev => ({ ...prev, x: prev.x - moveSpeed }));
          break;
        case 'KeyD':
        case 'ArrowRight':
          setCamera(prev => ({ ...prev, x: prev.x + moveSpeed }));
          break;
        case 'KeyG':
          setShowGrid(prev => !prev);
          break;
        case 'KeyI':
          setShowDebugInfo(prev => !prev);
          break;
        case 'KeyR':
          // Reset camera
          setCamera({ x: 0, y: 0, zoom: 1 });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [camera.zoom]);

  return (
    <div className={`relative bg-gray-900 ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        style={{ cursor: 'crosshair' }}
      />
      
      {/* Canvas Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle Grid (G)"
        >
          {showGrid ? '⏹️' : '📊'} Grid
        </button>
        
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowDebugInfo(!showDebugInfo)}
          title="Toggle Debug Info (I)"
        >
          {showDebugInfo ? '🐛' : '🔍'} Debug
        </button>
        
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })}
          title="Reset Camera (R)"
        >
          🎯 Reset
        </button>
      </div>

      {/* Camera Info */}
      <div className="absolute bottom-4 left-4 text-xs text-muted font-mono">
        Camera: ({Math.round(camera.x)}, {Math.round(camera.y)}) | Zoom: {camera.zoom.toFixed(1)}x
      </div>

      {/* Help Text */}
      <div className="absolute bottom-4 right-4 text-xs text-muted">
        WASD/Arrows: Move | Scroll: Zoom | G: Grid | I: Debug | R: Reset
      </div>
    </div>
  );
}

export default GameCanvas; 