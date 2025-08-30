import { Suspense, useRef, useImperativeHandle, forwardRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Box, useGLTF } from "@react-three/drei";
import { Mesh } from "three";
import { Download, RotateCcw, Maximize2, X, Eye, EyeOff, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MeshAnalyzerComponent } from "./MeshAnalyzer";
import { BreastLandmarks } from "@/lib/breastDetection";
import { AugmentationParameters } from "@/lib/meshManipulation";
import { MeasurementDisplay } from "./MeasurementDisplay";
import { ScaleInput } from "./ScaleInput";
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

const GeneratedModel = ({ 
  modelUrl, 
  onSceneLoaded 
}: { 
  modelUrl: string;
  onSceneLoaded?: (scene: THREE.Group) => void;
}) => {
  const groupRef = useRef<any>(null);

  const shouldUseProxy = !modelUrl.startsWith('blob:') && !modelUrl.startsWith('data:');
  const finalUrl = shouldUseProxy 
    ? `https://jdjdwysfkjqgfdidcmnh.supabase.co/functions/v1/proxy-model?url=${encodeURIComponent(modelUrl)}`
    : modelUrl;

  console.log('Loading model:', { original: modelUrl, final: finalUrl, useProxy: shouldUseProxy });

  const gltfResult = useGLTF(finalUrl);

  // Notify parent when scene is loaded
  useEffect(() => {
    if (gltfResult?.scene && onSceneLoaded) {
      console.log('Scene loaded, notifying parent');
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

  console.log('Model loaded successfully:', gltfResult, 'Original URL:', modelUrl);

  return (
    <group ref={groupRef}>
      <primitive
        object={gltfResult.scene.clone()}
        scale={[10, 10, 10]}
        position={[0, 0, 0]}
      />
    </group>
  );
};

// Component to display mesh analysis results
const AnalyzedMesh = ({ 
  originalMesh,
  visualizationMesh,
  augmentedMesh,
  showVisualization,
  showAugmented 
}: {
  originalMesh: THREE.Mesh;
  visualizationMesh: THREE.Mesh;
  augmentedMesh?: THREE.Mesh;
  showVisualization: boolean;
  showAugmented: boolean;
}) => {
  const meshToShow = showAugmented && augmentedMesh 
    ? augmentedMesh 
    : showVisualization 
      ? visualizationMesh 
      : originalMesh;

  return (
    <primitive
      object={meshToShow}
      scale={[10, 10, 10]}
      position={[0, 0, 0]}
    />
  );
};

const Scene = forwardRef<any, { 
  modelUrl?: string; 
  meshAnalysisResults?: {
    originalMesh: THREE.Mesh;
    landmarks: BreastLandmarks;
    visualizationMesh: THREE.Mesh;
    augmentedMesh?: THREE.Mesh;
  } | null;
  showVisualization?: boolean;
  showAugmented?: boolean;
  isFullscreen?: boolean;
  onSceneLoaded?: (scene: THREE.Group) => void;
}>(({ modelUrl, meshAnalysisResults, showVisualization = false, showAugmented = false, isFullscreen = false, onSceneLoaded }, ref) => {
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

      {modelUrl && meshAnalysisResults ? (
        <AnalyzedMesh 
          originalMesh={meshAnalysisResults.originalMesh}
          visualizationMesh={meshAnalysisResults.visualizationMesh}
          augmentedMesh={meshAnalysisResults.augmentedMesh}
          showVisualization={showVisualization}
          showAugmented={showAugmented}
        />
      ) : modelUrl ? (
        <GeneratedModel modelUrl={modelUrl} onSceneLoaded={onSceneLoaded} />
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
      />
    </>
  );
});

export const ModelViewer = ({ modelUrl }: ModelViewerProps) => {
  const sceneRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadedScene, setLoadedScene] = useState<THREE.Group | null>(null);
  
  // Mesh analysis state
  const [meshAnalysisResults, setMeshAnalysisResults] = useState<{
    originalMesh: THREE.Mesh;
    landmarks: BreastLandmarks;
    visualizationMesh: THREE.Mesh;
    augmentedMesh?: THREE.Mesh;
  } | null>(null);
  
  const [showVisualization, setShowVisualization] = useState(false);
  const [showAugmented, setShowAugmented] = useState(false);
  const [augmentationParams] = useState<AugmentationParameters>({
    implantSize: 300,
    implantType: 'round',
    projectionLevel: 'moderate',
    placementLevel: 'subglandular'
  });
  
  const { toast } = useToast();

  // Get the loaded scene from the model
  useEffect(() => {
    if (modelUrl) {
      // This will be populated when the model loads
      // We need to extract the scene from the GLTF result
      setLoadedScene(null);
      setMeshAnalysisResults(null);
      setShowVisualization(false);
      setShowAugmented(false);
    }
  }, [modelUrl]);

  const handleMeshAnalysisComplete = (results: {
    originalMesh: THREE.Mesh;
    landmarks: BreastLandmarks;
    visualizationMesh: THREE.Mesh;
    augmentedMesh?: THREE.Mesh;
  }) => {
    console.log('Mesh analysis complete:', results);
    setMeshAnalysisResults(results);
    toast({
      title: "Mesh Analysis Complete",
      description: "Breast regions detected from mesh geometry.",
    });
  };

  const handleSceneLoaded = (scene: THREE.Group) => {
    console.log('Scene loaded in ModelViewer:', scene);
    setLoadedScene(scene);
  };

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
              meshAnalysisResults={meshAnalysisResults}
              showVisualization={false}
              showAugmented={false}
              isFullscreen={false}
              onSceneLoaded={handleSceneLoaded}
            />
          </Suspense>
        </Canvas>

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
                  meshAnalysisResults={meshAnalysisResults}
                  showVisualization={showVisualization}
                  showAugmented={showAugmented}
                  isFullscreen={true}
                  onSceneLoaded={handleSceneLoaded}
                />
              </Suspense>
            </Canvas>
          </div>

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

              <Button
                variant={showVisualization ? "default" : "secondary"}
                size="sm"
                onClick={() => setShowVisualization(!showVisualization)}
                disabled={!meshAnalysisResults}
              >
                {showVisualization ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </Button>

              <Button
                variant={showAugmented ? "default" : "secondary"}
                size="sm"
                onClick={() => setShowAugmented(!showAugmented)}
                disabled={!meshAnalysisResults?.augmentedMesh}
              >
                <Settings className="w-4 h-4" />
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

          {/* Mesh Analyzer - hidden component that analyzes when model loads */}
          {isFullscreen && modelUrl && loadedScene && (
            <MeshAnalyzerComponent
              scene={loadedScene}
              onAnalysisComplete={handleMeshAnalysisComplete}
              augmentationParams={showAugmented ? augmentationParams : undefined}
            />
          )}

          {/* Measurement panels - show when we have analysis results */}
          {meshAnalysisResults && (
            <div className="absolute bottom-4 right-4 z-60 max-w-sm">
              <div className="space-y-2">
                <div className="bg-background/95 backdrop-blur-sm rounded-lg p-3 border shadow-lg text-sm">
                  <h3 className="font-semibold mb-2">Breast Analysis Results</h3>
                  <p>Left nipple: {meshAnalysisResults.landmarks.leftNipple ? '✓ Detected' : '✗ Not found'}</p>
                  <p>Right nipple: {meshAnalysisResults.landmarks.rightNipple ? '✓ Detected' : '✗ Not found'}</p>
                  <p>Left region: {meshAnalysisResults.landmarks.leftBreastRegion?.vertices.length || 0} vertices</p>
                  <p>Right region: {meshAnalysisResults.landmarks.rightBreastRegion?.vertices.length || 0} vertices</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};