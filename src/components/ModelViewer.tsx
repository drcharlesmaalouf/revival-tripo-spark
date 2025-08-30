import { Suspense, useRef, useImperativeHandle, forwardRef, useState, useEffect, useCallback, memo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Box, useGLTF } from "@react-three/drei";
import { Mesh } from "three";
import { Download, RotateCcw, Maximize2, X, Eye, EyeOff, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MeshAnalyzerComponent } from "./MeshAnalyzer";
import { BreastLandmarks, BreastDetector } from "@/lib/breastDetection";
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

// Component to display mesh analysis results
const AnalyzedMesh = ({ 
  originalMesh,
  visualizationMesh,
  augmentedMesh,
  landmarks,
  showVisualization,
  showAugmented 
}: {
  originalMesh: THREE.Mesh;
  visualizationMesh: THREE.Mesh;
  augmentedMesh?: THREE.Mesh;
  landmarks: BreastLandmarks;
  showVisualization: boolean;
  showAugmented: boolean;
}) => {
  console.log('=== ANALYZED MESH RENDER DEBUG ===');
  console.log('Original mesh:', originalMesh);
  console.log('- Geometry:', originalMesh.geometry);
  console.log('- Position count:', originalMesh.geometry.attributes.position?.count);
  console.log('- Index buffer:', originalMesh.geometry.index);
  console.log('- Material:', originalMesh.material);
  
  // Use the original mesh directly without cloning to avoid any potential issues
  const meshToDisplay = showAugmented && augmentedMesh ? augmentedMesh : originalMesh;
  
  console.log('Mesh to display:', meshToDisplay);
  console.log('- Will show augmented:', showAugmented && !!augmentedMesh);

  return (
    <group>
      <primitive
        object={meshToDisplay}
        scale={[10, 10, 10]}
        position={[0, 0, 0]}
      />
      {showVisualization && landmarks && (
        <primitive
          object={BreastDetector.createVisualizationMarkers(landmarks)}
          scale={[10, 10, 10]}
          position={[0, 0, 0]}
        />
      )}
    </group>
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

      {modelUrl ? (
        <group>
          <GeneratedModel modelUrl={modelUrl} onSceneLoaded={onSceneLoaded} />
          {/* Add visualization markers ONLY when analysis is complete and visualization is enabled */}
          {meshAnalysisResults && showVisualization && meshAnalysisResults.landmarks && (
            <group>
              {/* Position markers relative to the same coordinate system as the model */}
              <primitive
                object={BreastDetector.createVisualizationMarkers(meshAnalysisResults.landmarks)}
                scale={[10, 10, 10]}
                position={[0, 0, 0]}
              />
            </group>
          )}
        </group>
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
  const analysisCompletedRef = useRef<boolean>(false);
  
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

  // Reset analysis state when URL changes
  useEffect(() => {
    if (modelUrl) {
      setLoadedScene(null);
      setMeshAnalysisResults(null);
      setShowVisualization(false);
      setShowAugmented(false);
      analysisCompletedRef.current = false;
    }
  }, [modelUrl]);

  const handleMeshAnalysisComplete = useCallback((results: {
    originalMesh: THREE.Mesh;
    landmarks: BreastLandmarks;
    visualizationMesh: THREE.Mesh;
    augmentedMesh?: THREE.Mesh;
  }) => {
    if (analysisCompletedRef.current) {
      console.log('Analysis already completed, skipping');
      return;
    }
    
    console.log('Mesh analysis complete:', results);
    analysisCompletedRef.current = true;
    setMeshAnalysisResults(results);
    toast({
      title: "Mesh Analysis Complete",
      description: "Breast regions detected from mesh geometry.",
    });
  }, [toast]);

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
                onClick={() => {
                  console.log('=== EYE BUTTON CLICKED ===');
                  console.log('Current showVisualization:', showVisualization);
                  console.log('meshAnalysisResults:', !!meshAnalysisResults);
                  setShowVisualization(!showVisualization);
                  console.log('New showVisualization:', !showVisualization);
                }}
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
                  
                  {/* Calculate and display nipple-to-nipple distance */}
                  {meshAnalysisResults.landmarks.leftNipple && meshAnalysisResults.landmarks.rightNipple && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="font-medium">
                        Nipple distance: {
                          (meshAnalysisResults.landmarks.leftNipple.distanceTo(meshAnalysisResults.landmarks.rightNipple) * 100).toFixed(1)
                        } cm
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};