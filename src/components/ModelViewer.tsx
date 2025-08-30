import { Suspense, useRef, useImperativeHandle, forwardRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Box, useGLTF } from "@react-three/drei";
import { Mesh } from "three";
import { Download, RotateCcw, Maximize2, X, Move, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { anatomicalAnalyzer, AnatomicalLandmarks, BreastMeshData } from "@/lib/anatomicalAnalysis";
import { MeasurementDisplay } from "./MeasurementDisplay";
import { ScaleInput } from "./ScaleInput";
import { AnatomicalMarkers } from "./AnatomicalMarkers";
import { ImplantMesh } from "./ImplantMesh";
import * as THREE from "three";

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

// Enhanced Generated 3D model component with anatomical analysis
const GeneratedModel = ({ 
  modelUrl, 
  onAnalysisComplete 
}: { 
  modelUrl: string;
  onAnalysisComplete?: (data: BreastMeshData) => void;
}) => {
  const groupRef = useRef<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedModelUrl, setAnalyzedModelUrl] = useState<string>('');
  const [forceReanalysis, setForceReanalysis] = useState(0);
  const { toast } = useToast();

  // Check if it's a blob URL - use directly, otherwise use proxy
  const shouldUseProxy = !modelUrl.startsWith('blob:') && !modelUrl.startsWith('data:');
  const finalUrl = shouldUseProxy 
    ? `https://jdjdwysfkjqgfdidcmnh.supabase.co/functions/v1/proxy-model?url=${encodeURIComponent(modelUrl)}`
    : modelUrl;

  console.log('Loading model:', { original: modelUrl, final: finalUrl, useProxy: shouldUseProxy });

  // Use useGLTF hook properly - it handles loading states internally
  const gltfResult = useGLTF(finalUrl);

  // Perform anatomical analysis when model loads
  useEffect(() => {
    console.log('Analysis effect triggered:', {
      hasScene: !!gltfResult?.scene,
      isAnalyzing,
      finalUrl,
      hasCallback: !!onAnalysisComplete,
      forceReanalysis
    });
    
    if (gltfResult?.scene && !isAnalyzing && onAnalysisComplete) {
      console.log('Starting anatomical analysis for model...');
      setIsAnalyzing(true);
      setAnalyzedModelUrl(finalUrl);
      
      anatomicalAnalyzer.analyzeModel(gltfResult.scene)
        .then((analysisData) => {
          console.log('Anatomical analysis complete:', analysisData);
          onAnalysisComplete(analysisData);
        })
        .catch((error) => {
          console.error('Anatomical analysis failed:', error);
          // Show error to user
          toast({
            variant: "destructive",
            title: "Analysis Failed",
            description: error.message || "Model does not appear suitable for anatomical analysis.",
          });
        })
        .finally(() => {
          setIsAnalyzing(false);
        });
    }
  }, [gltfResult?.scene, isAnalyzing, finalUrl, onAnalysisComplete, forceReanalysis]);

  // Check if the model has loaded successfully
  if (!gltfResult?.scene) {
    console.log('No GLTF scene found - showing green cube fallback', {
      gltfResult,
      modelUrl: finalUrl,
      isBlob: modelUrl.startsWith('blob:')
    });
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

  console.log('Model loaded successfully:', gltfResult, 'Original URL:', modelUrl);

  return (
    <group ref={groupRef}>
      <primitive
        object={gltfResult.scene.clone()}
        scale={[10, 10, 10]}
        position={[0, 0, 0]}
      />
      {isAnalyzing && (
        <mesh position={[0, 2, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshBasicMaterial color="#ffff00" />
        </mesh>
      )}
    </group>
  );
};

const Scene = forwardRef<any, { 
  modelUrl?: string; 
  analysisData?: BreastMeshData | null;
  showMarkers?: boolean;
  showImplants?: boolean;
  onAnalysisComplete?: (data: BreastMeshData) => void;
  isFullscreen?: boolean;
}>(({ modelUrl, analysisData, showMarkers = false, showImplants = false, onAnalysisComplete, isFullscreen = false }, ref) => {
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
        <GeneratedModel 
          modelUrl={modelUrl} 
          onAnalysisComplete={onAnalysisComplete}
        />
      ) : (
        <PlaceholderModel />
      )}

      {/* Show color-coded mesh in fullscreen mode when available */}
      {isFullscreen && analysisData?.analyzedMesh && (
        <primitive object={analysisData.analyzedMesh} />
      )}

      {/* Anatomical markers and implants overlay - only show in fullscreen */}
      {isFullscreen && analysisData && (
        <>
          {showMarkers && (
            <AnatomicalMarkers 
              landmarks={analysisData.landmarks} 
              showMarkers={true} 
            />
          )}
          
          {showImplants && (
            <>
              <ImplantMesh 
                position={anatomicalAnalyzer.getImplantPosition(analysisData.landmarks, 'left')}
                side="left"
                visible={true}
              />
              <ImplantMesh 
                position={anatomicalAnalyzer.getImplantPosition(analysisData.landmarks, 'right')}
                side="right"
                visible={true}
              />
            </>
          )}
        </>
      )}

      <Environment preset="city" />
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={0.005}
        maxDistance={100}
        autoRotate={false}
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
  
  // Anatomical analysis state
  const [analysisData, setAnalysisData] = useState<BreastMeshData | null>(null);
  const [showMarkers, setShowMarkers] = useState(false);
  const [showImplants, setShowImplants] = useState(false);
  const [userNippleDistance, setUserNippleDistance] = useState<number | undefined>(undefined);
  const { toast } = useToast();

  const handleAnalysisComplete = (data: BreastMeshData) => {
    setAnalysisData(data);
    toast({
      title: "Analysis Complete",
      description: "Anatomical landmarks detected and breast regions isolated.",
    });
  };

  // Clear analysis data when model changes and force re-analysis
  useEffect(() => {
    if (modelUrl) {
      console.log('Model URL changed, clearing analysis data:', modelUrl);
      setAnalysisData(null);
      setShowMarkers(false);
      setShowImplants(false);
    }
  }, [modelUrl]);

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
          key="main-viewer"
          camera={{ 
            position: [3, 2, 3], 
            fov: 75,
            near: 0.01,
            far: 1000
          }}
          style={{ background: "transparent" }}
          onCreated={({ gl }) => {
            // Handle WebGL context loss
            gl.domElement.addEventListener('webglcontextlost', (event) => {
              console.warn('WebGL context lost, preventing default and attempting recovery');
              event.preventDefault();
              toast({
                title: "Display Issue",
                description: "3D viewer context lost. Refreshing...",
                variant: "destructive"
              });
            });
            
            gl.domElement.addEventListener('webglcontextrestored', () => {
              console.log('WebGL context restored');
              toast({
                title: "Display Restored",
                description: "3D viewer is working again.",
              });
            });
          }}
        >
          <Suspense fallback={null}>
            <Scene 
              ref={sceneRef} 
              modelUrl={modelUrl} 
              analysisData={analysisData}
              showMarkers={showMarkers}
              showImplants={showImplants}
              onAnalysisComplete={handleAnalysisComplete}
              isFullscreen={false}
            />
          </Suspense>
        </Canvas>

        {/* Control Panel - Simple controls only */}
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

          {/* Fullscreen window - occupy entire screen */}
          <div
            ref={windowRef}
            className="fixed inset-0 z-50 bg-background overflow-hidden"
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

            {/* Window content - full height */}
            <div className="relative bg-gradient-secondary h-full">
              <Canvas
                camera={{ 
                  position: [1, 0.5, 1], 
                  fov: 75,
                  near: 0.001,
                  far: 1000
                }}
                style={{ background: "transparent" }}
                onCreated={({ gl }) => {
                  // Handle WebGL context loss for fullscreen viewer too
                  gl.domElement.addEventListener('webglcontextlost', (event) => {
                    console.warn('WebGL context lost in fullscreen viewer');
                    event.preventDefault();
                  });
                }}
              >
                <Suspense fallback={null}>
                  <Scene 
                    ref={sceneRef} 
                    modelUrl={modelUrl} 
                    analysisData={analysisData}
                    showMarkers={showMarkers}
                    showImplants={showImplants}
                    onAnalysisComplete={handleAnalysisComplete}
                    isFullscreen={true}
                  />
                </Suspense>
              </Canvas>

              {/* Analysis controls in fullscreen - at bottom center */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReset}
                  className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>

                {/* Analysis controls - only in fullscreen */}
                {analysisData && (
                  <>
                    <Button
                      variant={showMarkers ? "default" : "secondary"}
                      size="sm"
                      onClick={() => setShowMarkers(!showMarkers)}
                      className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
                      title="Toggle anatomical landmarks"
                    >
                      {showMarkers ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>

                    <Button
                      variant={showImplants ? "default" : "secondary"}
                      size="sm"
                      onClick={() => setShowImplants(!showImplants)}
                      className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
                      title="Toggle implant preview"
                    >
                      <span className="w-4 h-4 text-xs font-bold">300</span>
                    </Button>
                  </>
                )}

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

              {/* Measurement Display in fullscreen - bottom right */}
              {analysisData && (
                <div className="absolute bottom-16 right-4 max-w-sm">
                  <div className="space-y-2">
                    <ScaleInput 
                      onScaleSet={setUserNippleDistance}
                      currentScale={userNippleDistance}
                    />
                    <MeasurementDisplay 
                      measurements={analysisData.measurements}
                      userNippleDistance={userNippleDistance}
                    />
                    
                    {/* Color legend for analysis visualization */}
                    {analysisData.analyzedMesh && (
                      <div className="bg-background/90 backdrop-blur-sm rounded-lg p-3 text-sm border border-border">
                        <h4 className="font-semibold mb-2 text-foreground">Breast Detection Analysis</h4>
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span className="text-muted-foreground">Nipples detected</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-pink-400 rounded-full"></div>
                            <span className="text-muted-foreground">Left breast region</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                            <span className="text-muted-foreground">Right breast region</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                            <span className="text-muted-foreground">Other areas</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
