import { Suspense, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Box, useGLTF } from "@react-three/drei";
import { Mesh, Box3, Vector3 } from "three";
import { Download, RotateCcw, Maximize2, X, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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

  let gltfResult = null;
  try {
    gltfResult = useGLTF(modelUrl);
  } catch (error) {
    console.error('Error loading GLTF model:', error);
    return <PlaceholderModel />;
  }

  if (gltfResult?.scene) {
    // Scale and center the model
    const box = new Box3().setFromObject(gltfResult.scene);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 3 / maxDim; // Scale to fit in a 3x3x3 space
    
    gltfResult.scene.scale.setScalar(scale);
    gltfResult.scene.position.copy(center.multiplyScalar(-scale));

    return <primitive ref={groupRef} object={gltfResult.scene} />;
  }

  return <PlaceholderModel />;
};

const LoadingModel = () => {
  const meshRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <Box ref={meshRef} args={[1.5, 1.5, 1.5]}>
      <meshStandardMaterial
        color="#6366f1"
        metalness={0.2}
        roughness={0.8}
        transparent
        opacity={0.7}
      />
    </Box>
  );
};

export const ModelViewer = ({ modelUrl }: ModelViewerProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { toast } = useToast();

  const downloadModel = async () => {
    if (!modelUrl) {
      toast({
        variant: "destructive",
        title: "No Model Available",
        description: "Please generate a model first.",
      });
      return;
    }

    try {
      const response = await fetch(modelUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `tripo-model-${Date.now()}.glb`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Started",
        description: "Your 3D model is being downloaded.",
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Failed to download the model. Please try again.",
      });
    }
  };

  const ViewerContent = () => (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ position: [5, 5, 5], fov: 45 }}
        style={{ background: 'radial-gradient(circle, hsl(240 10% 8%) 0%, hsl(240 10% 3.9%) 100%)' }}
      >
        <Suspense fallback={<LoadingModel />}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
          <pointLight position={[-10, -10, -10]} intensity={0.3} />
          
          {modelUrl ? (
            <GeneratedModel modelUrl={modelUrl} />
          ) : (
            <PlaceholderModel />
          )}
          
          <Environment preset="studio" />
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={2}
            maxDistance={20}
          />
        </Suspense>
      </Canvas>

      {/* Controls Overlay */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        {modelUrl && (
          <Button
            size="sm"
            variant="secondary"
            onClick={downloadModel}
            className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
        
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
        >
          {isFullscreen ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm rounded-lg p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 mb-1">
          <Move className="h-3 w-3" />
          <span>Click & drag to rotate</span>
        </div>
        <div>Scroll to zoom • Right-click & drag to pan</div>
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <ViewerContent />
      </div>
    );
  }

  return (
    <div className="w-full h-[500px] rounded-xl border border-border overflow-hidden shadow-lg">
      <ViewerContent />
    </div>
  );
};