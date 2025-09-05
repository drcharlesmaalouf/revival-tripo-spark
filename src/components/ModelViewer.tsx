import { Suspense, useRef, useImperativeHandle, forwardRef, useState, useEffect, useCallback, memo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Box, useGLTF } from "@react-three/drei";
import { Mesh } from "three";
import { Download, RotateCcw, Maximize2, X, Eye, EyeOff, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DrawingInterface } from "./DrawingInterface";
import { DrawingTool } from "./DrawingTool";
import { BreastManipulator } from "./BreastManipulator";
import { PhysicsBreastSimulator } from "./PhysicsBreastSimulator";
import { CalculatedMeasurements, BreastContour, NippleMarker } from "@/lib/manualMeasurements";
import * as THREE from "three";

interface ModelViewerProps {
  modelUrl?: string;
}

const PlaceholderModel = () => {
  const meshRef = useRef<Mesh>(null);
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

const GeneratedModel = memo(({ 
  modelUrl, 
  onSceneLoaded 
}: { 
  modelUrl: string;
  onSceneLoaded?: (scene: THREE.Group) => void;
}) => {
  const groupRef = useRef<any>(null);
  const hasNotifiedRef = useRef<boolean>(false);

  const shouldUseProxy = !modelUrl.startsWith('blob:') && !modelUrl.startsWith('data:');
  const finalUrl = shouldUseProxy 
    ? `https://jdjdwysfkjqgfdidcmnh.supabase.co/functions/v1/proxy-model?url=${encodeURIComponent(modelUrl)}`
    : modelUrl;

  console.log('=== MODEL URL DEBUG ===');
  console.log('Original URL:', modelUrl);
  console.log('Final URL:', finalUrl);
  console.log('Using proxy:', shouldUseProxy);
  
  // Test if the model URL is accessible
  if (shouldUseProxy) {
    fetch(finalUrl)
      .then(response => {
        console.log('Model fetch response:', response.status, response.statusText);
        console.log('Content-Type:', response.headers.get('content-type'));
        console.log('Content-Length:', response.headers.get('content-length'));
        return response.blob();
      })
      .then(blob => {
        console.log('Model blob size:', blob.size, 'bytes');
        console.log('Model blob type:', blob.type);
      })
      .catch(err => console.error('Model fetch failed:', err));
  }

  const gltfResult = useGLTF(finalUrl);

  // Reset notification flag when URL changes
  useEffect(() => {
    hasNotifiedRef.current = false;
  }, [modelUrl]);

  // Notify parent when scene is loaded (only once per URL)
  useEffect(() => {
    if (gltfResult?.scene && onSceneLoaded && !hasNotifiedRef.current) {
      console.log('Scene loaded, notifying parent');
      hasNotifiedRef.current = true;
      onSceneLoaded(gltfResult.scene);
    }
  }, [gltfResult?.scene, onSceneLoaded]);

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

  console.log('=== GLTF MODEL RENDER DEBUG ===');
  console.log('GLTF Result:', gltfResult);
  
  // Fix potential material/geometry issues
  const clonedScene = gltfResult.scene.clone();
  clonedScene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      console.log('Processing mesh:', child);
      console.log('- Vertices:', child.geometry.attributes.position?.count);
      console.log('- Has index:', !!child.geometry.index);
      console.log('- Material type:', child.material?.constructor.name);
      
      // Ensure geometry has proper indices for solid rendering
      if (!child.geometry.index) {
        console.log('Adding missing index buffer');
        const indices = [];
        const positions = child.geometry.attributes.position;
        for (let i = 0; i < positions.count; i += 3) {
          indices.push(i, i + 1, i + 2);
        }
        child.geometry.setIndex(indices);
      }
      
      // Ensure proper material for solid rendering
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map(mat => {
            const newMat = mat.clone();
            newMat.wireframe = false;
            newMat.side = THREE.DoubleSide;
            return newMat;
          });
        } else {
          child.material = child.material.clone();
          child.material.wireframe = false;
          child.material.side = THREE.DoubleSide;
        }
      }
    }
  });

  return (
    <group ref={groupRef}>
      <primitive
        object={clonedScene}
        scale={[10, 10, 10]}
        position={[0, 0, 0]}
      />
    </group>
  );
});


const Scene = forwardRef<any, { 
  modelUrl?: string; 
  isFullscreen?: boolean;
  onSceneLoaded?: (scene: THREE.Group) => void;
  drawingMode?: 'leftContour' | 'rightContour' | 'leftNipple' | 'rightNipple' | 'none';
  onContourComplete?: (contour: BreastContour) => void;
  onNipplePlaced?: (nipple: NippleMarker) => void;
}>(({ modelUrl, isFullscreen = false, onSceneLoaded, drawingMode = 'none', onContourComplete, onNipplePlaced }, ref) => {
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
        <>
          <GeneratedModel modelUrl={modelUrl} onSceneLoaded={onSceneLoaded} />
           {isFullscreen && (
             <DrawingTool
               mode={drawingMode}
               onContourComplete={onContourComplete || (() => {})}
               onNipplePlaced={onNipplePlaced || (() => {})}
             />
           )}
        </>
      ) : (
        <PlaceholderModel />
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
        enabled={drawingMode === 'none'}
      />
    </>
  );
});

export const ModelViewer = ({ modelUrl }: ModelViewerProps) => {
  const sceneRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadedScene, setLoadedScene] = useState<THREE.Group | null>(null);
  
  // Drawing tool state
  const [calculatedMeasurements, setCalculatedMeasurements] = useState<CalculatedMeasurements | null>(null);
  const [drawingMode, setDrawingMode] = useState<'leftContour' | 'rightContour' | 'leftNipple' | 'rightNipple' | 'none'>('none');
  const [breastAnnotations, setBreastAnnotations] = useState<{
    leftContour: BreastContour;
    rightContour: BreastContour;
    leftNipple: NippleMarker;
    rightNipple: NippleMarker;
  } | null>(null);
  
  // Drawing interface handlers
  const [interfaceHandlers, setInterfaceHandlers] = useState<{
    handleContourComplete: (contour: BreastContour) => void;
    handleNipplePlaced: (nipple: NippleMarker) => void;
  } | null>(null);
  
  const { toast } = useToast();

  // Reset state when URL changes
  useEffect(() => {
    if (modelUrl) {
      setLoadedScene(null);
      setCalculatedMeasurements(null);
      setBreastAnnotations(null);
    }
  }, [modelUrl]);

  const handleMeasurementsComplete = useCallback((
    measurements: CalculatedMeasurements,
    annotations: {
      leftContour: BreastContour;
      rightContour: BreastContour;
      leftNipple: NippleMarker;
      rightNipple: NippleMarker;
    }
  ) => {
    console.log('Manual measurements complete:', measurements);
    setCalculatedMeasurements(measurements);
    setBreastAnnotations(annotations);
    toast({
      title: "Analysis Complete",
      description: "Breast measurements calculated. Simulation tools are now available.",
    });
  }, [toast]);

  const handleGetHandlers = useCallback((handlers: {
    handleContourComplete: (contour: BreastContour) => void;
    handleNipplePlaced: (nipple: NippleMarker) => void;
  }) => {
    setInterfaceHandlers(handlers);
  }, []);

  const handleSceneLoaded = useCallback((scene: THREE.Group) => {
    console.log('Scene loaded in ModelViewer:', scene);
    setLoadedScene(scene);
  }, []);

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
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
  };

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
        >
          <Suspense fallback={null}>
            <Scene 
              ref={sceneRef} 
              modelUrl={modelUrl} 
              isFullscreen={false}
              onSceneLoaded={handleSceneLoaded}
            />
          </Suspense>
        </Canvas>
          {/* Breast Manipulator - show when measurements and annotations are complete */}
        {/* Normal viewer controls */}
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

      {/* FULLSCREEN MODAL */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-background">
          {/* Header with close button */}
          <div className="absolute top-0 left-0 right-0 z-60 bg-muted border-b p-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">3D Model Analysis</h2>
            <Button variant="ghost" size="sm" onClick={closeFullscreen}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Main 3D viewer area */}
          <div className="absolute inset-0 pt-16 bg-gradient-secondary">
            <Canvas
              camera={{ 
                position: [1, 0.5, 1], 
                fov: 75,
                near: 0.001,
                far: 1000
              }}
              style={{ background: "transparent" }}
            >
              <Suspense fallback={null}>
                <Scene 
                  ref={sceneRef} 
                  modelUrl={modelUrl} 
                  isFullscreen={true}
                  onSceneLoaded={handleSceneLoaded}
                   drawingMode={drawingMode}
                   onContourComplete={interfaceHandlers?.handleContourComplete || (() => {})}
                   onNipplePlaced={interfaceHandlers?.handleNipplePlaced || (() => {})}
                 />
               </Suspense>
             </Canvas>
           </div>

           {/* Drawing interface - only show in fullscreen */}
           {isFullscreen && modelUrl && loadedScene && (
             <DrawingInterface
               scene={loadedScene}
               onMeasurementsComplete={handleMeasurementsComplete}
               onModeChange={setDrawingMode}
               onGetHandlers={handleGetHandlers}
             />
           )}

            {/* Physics Breast Simulator - show when measurements and annotations are complete */}
            {isFullscreen && calculatedMeasurements && breastAnnotations && loadedScene && (
             <PhysicsBreastSimulator
                scene={loadedScene}
                measurements={calculatedMeasurements}
                leftContour={breastAnnotations.leftContour}
                rightContour={breastAnnotations.rightContour}
                leftNipple={breastAnnotations.leftNipple}
                rightNipple={breastAnnotations.rightNipple}
              />
            )}

          {/* CONTROL BUTTONS - ALWAYS VISIBLE */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-60">
            <div className="flex gap-2 bg-background/95 backdrop-blur-sm rounded-lg p-3 border shadow-lg">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleReset}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>

              {modelUrl && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              )}
            </div>
          </div>

          {/* Measurement results panel - show when we have measurements */}
          {calculatedMeasurements && (
            <div className="absolute bottom-4 right-4 z-60 max-w-sm">
              <div className="space-y-2">
                <div className="bg-background/95 backdrop-blur-sm rounded-lg p-3 border shadow-lg text-sm">
                  <h3 className="font-semibold mb-2">Measurement Results</h3>
                  <div className="space-y-1">
                    <p>Nipple distance: {calculatedMeasurements.nippleToNippleDistance.toFixed(1)} cm</p>
                    <p>Left diameter: {calculatedMeasurements.leftBreastDiameter.toFixed(1)} cm</p>
                    <p>Right diameter: {calculatedMeasurements.rightBreastDiameter.toFixed(1)} cm</p>
                    <p>Left circumference: {calculatedMeasurements.leftBreastCircumference.toFixed(1)} cm</p>
                    <p>Right circumference: {calculatedMeasurements.rightBreastCircumference.toFixed(1)} cm</p>
                    <p>Left projection: {calculatedMeasurements.projectionLeft.toFixed(1)} cm</p>
                    <p>Right projection: {calculatedMeasurements.projectionRight.toFixed(1)} cm</p>
                    <p>Symmetry: {calculatedMeasurements.symmetryRatio.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};