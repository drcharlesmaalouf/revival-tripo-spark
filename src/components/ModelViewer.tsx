import { Suspense, useRef, useImperativeHandle, forwardRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Box, useGLTF } from "@react-three/drei";
import { Mesh } from "three";
import { Download, RotateCcw, Maximize2, X, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ModelViewerProps {
  modelUrl?: string;
}

// Remove auto-rotation from placeholder too
const PlaceholderModel = () => {
  const meshRef = useRef<Mesh>(null);

  // Remove auto-rotation - keep it static
  // useFrame((state) => {
  //   if (meshRef.current) {
  //     meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime) * 0.2;
  //     meshRef.current.rotation.y += 0.01;
  //   }
  // });

  return (
    <Box ref={meshRef} args={[2, 2, 2]}>
      <meshStandardMaterial
        color="#8B5CF6"
        metalness={0.1}
        roughness={0.3}
      />
    </Box>
  );
};

// Generated 3D model component that loads the actual model
const GeneratedModel = ({ modelUrl }: { modelUrl: string }) => {
  const groupRef = useRef<any>(null);

  // Check if it's a blob URL - use directly, otherwise use proxy
  const shouldUseProxy = !modelUrl.startsWith('blob:') && !modelUrl.startsWith('data:');
  const finalUrl = shouldUseProxy 
    ? `https://jdjdwysfkjqgfdidcmnh.supabase.co/functions/v1/proxy-model?url=${encodeURIComponent(modelUrl)}`
    : modelUrl;

  console.log('Loading model:', { original: modelUrl, final: finalUrl, useProxy: shouldUseProxy });

  // Use useGLTF hook properly - it handles loading states internally
  const gltfResult = useGLTF(finalUrl);

  // Check if the model has loaded successfully
  if (!gltfResult?.scene) {
    console.log('No GLTF scene found - showing green cube fallback');
    return (
      <Box args={[1.5, 1.5, 1.5]}>
        <meshStandardMaterial
          color="#22C55E"
          metalness={0.3}
          roughness={0.2}
        />
      </Box>
    );
  }

  console.log('Model loaded successfully:', gltfResult);

  return (
    <group ref={groupRef}>
      <primitive
        object={gltfResult.scene.clone()}
        scale={[1, 1, 1]}
        position={[0, 0, 0]}
      />
    </group>
  );
};

const Scene = forwardRef<any, { modelUrl?: string }>(({ modelUrl }, ref) => {
  const controlsRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    resetCamera: () => {
      if (controlsRef.current) {
        controlsRef.current.reset();
      }
    }
  }));

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-10, -10, -5]} intensity={0.5} />

      {modelUrl ? (
        <GeneratedModel modelUrl={modelUrl} />
      ) : (
        <PlaceholderModel />
      )}

      <Environment preset="city" />
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={0.5}
        maxDistance={15}
      />
    </>
  );
});

export const ModelViewer = ({ modelUrl }: ModelViewerProps) => {
  const sceneRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [windowPosition, setWindowPosition] = useState({ x: 50, y: 50 });
  const [windowSize, setWindowSize] = useState({ width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (modelUrl) {
      const link = document.createElement('a');
      link.href = modelUrl;
      link.download = `3d-model-${Date.now()}.glb`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleReset = () => {
    if (sceneRef.current) {
      sceneRef.current.resetCamera();
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (!isFullscreen) {
      // Reset position and size when opening
      setWindowPosition({ x: 50, y: 50 });
      setWindowSize({ width: 800, height: 600 });
    }
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
  };

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - windowPosition.x,
      y: e.clientY - windowPosition.y,
    });
  };

  // Handle resizing
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: windowSize.width,
      height: windowSize.height,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = Math.max(0, Math.min(window.innerWidth - windowSize.width, e.clientX - dragStart.x));
      const newY = Math.max(0, Math.min(window.innerHeight - windowSize.height, e.clientY - dragStart.y));
      setWindowPosition({ x: newX, y: newY });
    }

    if (isResizing) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      const newWidth = Math.max(400, Math.min(window.innerWidth - windowPosition.x, resizeStart.width + deltaX));
      const newHeight = Math.max(300, Math.min(window.innerHeight - windowPosition.y, resizeStart.height + deltaY));

      setWindowSize({ width: newWidth, height: newHeight });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // Handle escape key and mouse events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isFullscreen, isDragging, isResizing, dragStart, resizeStart, windowPosition, windowSize]);

  return (
    <>
      {/* Normal viewer */}
      <div className={`relative h-full w-full overflow-hidden rounded-lg bg-gradient-secondary ${isFullscreen ? 'opacity-50' : ''}`}>
        <Canvas
          camera={{ position: [4, 4, 4], fov: 50 }}
          style={{ background: "transparent" }}
        >
          <Suspense fallback={null}>
            <Scene ref={sceneRef} modelUrl={modelUrl} />
          </Suspense>
        </Canvas>

        {/* Control Panel */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReset}
            className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={toggleFullscreen}
            className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>

          {modelUrl && (
            <Button
              variant="default"
              size="sm"
              onClick={handleDownload}
              className="bg-primary/90 backdrop-blur-sm hover:bg-primary"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          )}
        </div>

        {/* Instructions */}
        {!modelUrl && !isFullscreen && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2 bg-background/80 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground">3D Preview</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Upload an image and generate a 3D model to see it here
              </p>
              <div className="text-xs text-muted-foreground/60 space-y-1">
                <p>• Click and drag to rotate</p>
                <p>• Scroll to zoom</p>
                <p>• Right-click and drag to pan</p>
                <p>• Click expand for resizable window</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen draggable & resizable window */}
      {isFullscreen && (
        <>
          {/* Background overlay */}
          <div className="fixed inset-0 bg-black/20 z-40" onClick={closeFullscreen} />

          {/* Draggable & resizable window */}
          <div
            ref={windowRef}
            className="fixed z-50 bg-background border border-border rounded-lg shadow-2xl overflow-hidden"
            style={{
              left: windowPosition.x,
              top: windowPosition.y,
              width: windowSize.width,
              height: windowSize.height,
              cursor: isDragging ? 'move' : isResizing ? 'nw-resize' : 'default',
            }}
          >
            {/* Window header */}
            <div
              className="flex items-center justify-between p-3 bg-muted border-b cursor-move select-none"
              onMouseDown={handleMouseDown}
            >
              <div className="flex items-center gap-2">
                <Move className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">3D Model Viewer</span>
                <span className="text-xs text-muted-foreground">
                  {windowSize.width} × {windowSize.height}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeFullscreen}
                className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Window content */}
            <div className="relative bg-gradient-secondary" style={{ height: windowSize.height - 48 }}>
              <Canvas
                camera={{ position: [4, 4, 4], fov: 50 }}
                style={{ background: "transparent" }}
              >
                <Suspense fallback={null}>
                  <Scene ref={sceneRef} modelUrl={modelUrl} />
                </Suspense>
              </Canvas>

              {/* Window controls */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReset}
                  className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>

                {modelUrl && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleDownload}
                    className="bg-primary/90 backdrop-blur-sm hover:bg-primary"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            </div>

            {/* Resize handle - bottom-right corner */}
            <div
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nw-resize bg-primary/20 hover:bg-primary/40 transition-colors"
              onMouseDown={handleResizeMouseDown}
              style={{
                background: 'linear-gradient(-45deg, transparent 40%, currentColor 40%, currentColor 60%, transparent 60%)',
              }}
            />
          </div>
        </>
      )}
    </>
  );
};
