import { Suspense, useRef, useImperativeHandle, forwardRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Box, useGLTF } from "@react-three/drei";
import { Mesh } from "three";
import { Download, RotateCcw, Maximize2, X, Eye, EyeOff } from "lucide-react";
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

const GeneratedModel = ({ modelUrl }: { modelUrl: string }) => {
  const groupRef = useRef<any>(null);

  const shouldUseProxy = !modelUrl.startsWith('blob:') && !modelUrl.startsWith('data:');
  const finalUrl = shouldUseProxy 
    ? `https://jdjdwysfkjqgfdidcmnh.supabase.co/functions/v1/proxy-model?url=${encodeURIComponent(modelUrl)}`
    : modelUrl;

  console.log('Loading model:', { original: modelUrl, final: finalUrl, useProxy: shouldUseProxy });

  const gltfResult = useGLTF(finalUrl);

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

const Scene = forwardRef<any, { 
  modelUrl?: string; 
  analysisData?: BreastMeshData | null;
  showMarkers?: boolean;
  showImplants?: boolean;
  isFullscreen?: boolean;
}>(({ modelUrl, analysisData, showMarkers = false, showImplants = false, isFullscreen = false }, ref) => {
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

      {/* Show marker-based detection instead of mesh modification */}
      {isFullscreen && showMarkers && analysisData && (
        <>
          {console.log('SHOWING DETECTION MARKERS!')}
          {/* Simple sphere markers for detected areas */}
          <AnatomicalMarkers 
            landmarks={analysisData.landmarks} 
            showMarkers={true} 
          />
        </>
      )}

      {/* Show markers and implants in fullscreen */}
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
  
  // Anatomical analysis state
  const [analysisData, setAnalysisData] = useState<BreastMeshData | null>(null);
  const [showMarkers, setShowMarkers] = useState(false);
  const [showImplants, setShowImplants] = useState(false);
  const [userNippleDistance, setUserNippleDistance] = useState<number | undefined>(undefined);
  const { toast } = useToast();

  const runAnalysis = () => {
    if (!modelUrl) return;
    
    console.log('Running manual analysis...');
    
    // Create mock analysis data with coordinates closer to model center
    const mockData: BreastMeshData = {
      leftBreastMesh: new THREE.Mesh(),
      rightBreastMesh: new THREE.Mesh(),
      landmarks: {
        leftNipple: new THREE.Vector3(-0.05, 0.02, 0.08),  // Very close to origin
        rightNipple: new THREE.Vector3(0.05, 0.02, 0.08),
        leftInframammaryFold: new THREE.Vector3(-0.05, -0.01, 0.07),
        rightInframammaryFold: new THREE.Vector3(0.05, -0.01, 0.07),
        leftBreastApex: new THREE.Vector3(-0.05, 0.02, 0.09),
        rightBreastApex: new THREE.Vector3(0.05, 0.02, 0.09),
        midChestPoint: new THREE.Vector3(0, 0.02, 0.06),
        chestWall: [
          new THREE.Vector3(0, 0.02, 0.06),
          new THREE.Vector3(-0.08, 0.02, 0.06),
          new THREE.Vector3(0.08, 0.02, 0.06)
        ],
        breastBoundaries: {
          left: [new THREE.Vector3(-0.05, 0.02, 0.08)],
          right: [new THREE.Vector3(0.05, 0.02, 0.08)]
        },
        measurements: {
          nippleToNippleDistance: 21,
          leftBreastWidth: 12,
          rightBreastWidth: 12,
          leftBreastHeight: 10,
          rightBreastHeight: 10,
          leftBreastProjection: 8,
          rightBreastProjection: 8,
          inframammaryFoldWidth: 15,
          chestWallWidth: 90,
          averageBreastSize: 'C' as const
        }
      },
      measurements: {
        nippleToNippleDistance: 21,
        leftBreastWidth: 12,
        rightBreastWidth: 12,
        leftBreastHeight: 10,
        rightBreastHeight: 10,
        leftBreastProjection: 8,
        rightBreastProjection: 8,
        inframammaryFoldWidth: 15,
        chestWallWidth: 90,
        averageBreastSize: 'C' as const
      },
      modelScale: 10
    };
    
    setAnalysisData(mockData);
    toast({
      title: "Analysis Complete",
      description: "Mock anatomical landmarks generated for testing.",
    });
  };

  // Clear analysis data when model changes
  useEffect(() => {
    console.log('Model URL effect triggered:', { modelUrl, hasAnalysisData: !!analysisData });
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
                analysisData={analysisData}
                showMarkers={false}
                showImplants={false}
                isFullscreen={false}
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
                  analysisData={analysisData}
                  showMarkers={showMarkers}
                  showImplants={showImplants}
                  isFullscreen={true}
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
                variant={showMarkers ? "default" : "secondary"}
                size="sm"
                onClick={() => {
                  if (!analysisData) {
                    runAnalysis();
                  }
                  console.log('EYE BUTTON CLICKED! showMarkers:', showMarkers, '-> ', !showMarkers);
                  setShowMarkers(!showMarkers);
                }}
              >
                {showMarkers ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </Button>

              <Button
                variant={showImplants ? "default" : "secondary"}
                size="sm"
                onClick={() => setShowImplants(!showImplants)}
              >
                <span className="w-4 h-4 text-xs font-bold">300</span>
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

          {/* Measurement panels - bottom right */}
          {analysisData && (
            <div className="absolute bottom-4 right-4 z-60 max-w-sm">
              <div className="space-y-2">
                <ScaleInput 
                  onScaleSet={setUserNippleDistance}
                  currentScale={userNippleDistance}
                />
                <MeasurementDisplay 
                  measurements={analysisData.measurements}
                  userNippleDistance={userNippleDistance}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};