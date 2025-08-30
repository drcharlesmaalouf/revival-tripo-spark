import { useState, useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  BreastMeshExtractor, 
  ExtractedBreastMesh, 
  BreastVolumeCalculation 
} from '@/lib/breastMeshExtraction';
import { CalculatedMeasurements, BreastContour, NippleMarker } from '@/lib/manualMeasurements';
import { Volume, RotateCcw, Play, Square } from 'lucide-react';

interface BreastSimulatorProps {
  scene: THREE.Group;
  measurements: CalculatedMeasurements;
  leftContour: BreastContour;
  rightContour: BreastContour;
  leftNipple: NippleMarker;
  rightNipple: NippleMarker;
}

interface SimulationState {
  leftSize: number;    // 0.5 to 2.0 (50% to 200%)
  rightSize: number;   // 0.5 to 2.0 (50% to 200%)
  leftProjection: number; // 0.5 to 2.0
  rightProjection: number; // 0.5 to 2.0
  isActive: boolean;
}

export const BreastSimulator = ({
  scene,
  measurements,
  leftContour,
  rightContour,
  leftNipple,
  rightNipple
}: BreastSimulatorProps) => {
  const [extractedMeshes, setExtractedMeshes] = useState<{
    left: ExtractedBreastMesh;
    right: ExtractedBreastMesh;
  } | null>(null);
  
  const [volumeCalculation, setVolumeCalculation] = useState<BreastVolumeCalculation | null>(null);
  const [simulationState, setSimulationState] = useState<SimulationState>({
    leftSize: 1.0,
    rightSize: 1.0,
    leftProjection: 1.0,
    rightProjection: 1.0,
    isActive: false
  });
  
  const [simulatedVolumes, setSimulatedVolumes] = useState<BreastVolumeCalculation | null>(null);
  const originalMeshesRef = useRef<{ left: THREE.Mesh; right: THREE.Mesh } | null>(null);

  // Extract breast meshes when component mounts
  useEffect(() => {
    if (scene && leftContour && rightContour && leftNipple && rightNipple) {
      console.log('Extracting breast meshes...');
      
      const extracted = BreastMeshExtractor.extractBreastMeshes(
        scene,
        leftContour,
        rightContour,
        leftNipple,
        rightNipple
      );

      if (extracted) {
        setExtractedMeshes(extracted);
        
        // Calculate volumes
        const volumes = BreastMeshExtractor.calculateBreastVolumes(
          measurements.leftBreastDiameter,
          measurements.rightBreastDiameter,
          measurements.projectionLeft,
          measurements.projectionRight,
          extracted
        );
        setVolumeCalculation(volumes);
        setSimulatedVolumes(volumes);
        
        console.log('Breast extraction completed:', {
          leftVolume: volumes.leftVolume,
          rightVolume: volumes.rightVolume,
          totalVolume: volumes.totalVolume
        });
      }
    }
  }, [scene, leftContour, rightContour, leftNipple, rightNipple, measurements]);

  const startSimulation = useCallback(() => {
    if (!extractedMeshes) return;

    // Hide original body mesh
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && 
          !child.name.includes('contour') && 
          !child.name.includes('nipple') &&
          !child.name.includes('drawing') &&
          !child.name.includes('breast')) {
        child.visible = false;
      }
    });

    // Add wireframe meshes to scene
    scene.add(extractedMeshes.left.wireframeMesh);
    scene.add(extractedMeshes.right.wireframeMesh);
    
    // Store original meshes for reference
    originalMeshesRef.current = {
      left: extractedMeshes.left.wireframeMesh,
      right: extractedMeshes.right.wireframeMesh
    };

    setSimulationState(prev => ({ ...prev, isActive: true }));
  }, [extractedMeshes, scene]);

  const stopSimulation = useCallback(() => {
    if (!extractedMeshes) return;

    // Show original body mesh
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && 
          !child.name.includes('contour') && 
          !child.name.includes('nipple') &&
          !child.name.includes('drawing') &&
          !child.name.includes('breast')) {
        child.visible = true;
      }
    });

    // Remove wireframe meshes
    scene.remove(extractedMeshes.left.wireframeMesh);
    scene.remove(extractedMeshes.right.wireframeMesh);

    setSimulationState(prev => ({ ...prev, isActive: false }));
  }, [extractedMeshes, scene]);

  const resetSimulation = useCallback(() => {
    setSimulationState({
      leftSize: 1.0,
      rightSize: 1.0,
      leftProjection: 1.0,
      rightProjection: 1.0,
      isActive: simulationState.isActive
    });
    
    if (originalMeshesRef.current) {
      // Reset scales
      originalMeshesRef.current.left.scale.set(1, 1, 1);
      originalMeshesRef.current.right.scale.set(1, 1, 1);
    }
    
    setSimulatedVolumes(volumeCalculation);
  }, [simulationState.isActive, volumeCalculation]);

  // Update mesh scaling when simulation parameters change
  useEffect(() => {
    if (!simulationState.isActive || !originalMeshesRef.current) return;

    const { left, right } = originalMeshesRef.current;
    
    // Apply scaling transformations
    left.scale.set(
      simulationState.leftSize,
      simulationState.leftSize,
      simulationState.leftProjection
    );
    
    right.scale.set(
      simulationState.rightSize,
      simulationState.rightSize,
      simulationState.rightProjection
    );

    // Recalculate volumes with new scaling
    if (volumeCalculation) {
      const scaledLeftVolume = volumeCalculation.leftVolume * 
        Math.pow(simulationState.leftSize, 2) * simulationState.leftProjection;
      const scaledRightVolume = volumeCalculation.rightVolume * 
        Math.pow(simulationState.rightSize, 2) * simulationState.rightProjection;
      
      const totalVolume = scaledLeftVolume + scaledRightVolume;
      const asymmetryRatio = Math.abs(scaledLeftVolume - scaledRightVolume) / 
        Math.max(scaledLeftVolume, scaledRightVolume) * 100;

      setSimulatedVolumes({
        leftVolume: Math.round(scaledLeftVolume),
        rightVolume: Math.round(scaledRightVolume),
        totalVolume: Math.round(totalVolume),
        asymmetryRatio: Math.round(asymmetryRatio * 10) / 10
      });
    }
  }, [simulationState, volumeCalculation]);

  const updateLeftSize = useCallback((value: number[]) => {
    setSimulationState(prev => ({ ...prev, leftSize: value[0] }));
  }, []);

  const updateRightSize = useCallback((value: number[]) => {
    setSimulationState(prev => ({ ...prev, rightSize: value[0] }));
  }, []);

  const updateLeftProjection = useCallback((value: number[]) => {
    setSimulationState(prev => ({ ...prev, leftProjection: value[0] }));
  }, []);

  const updateRightProjection = useCallback((value: number[]) => {
    setSimulationState(prev => ({ ...prev, rightProjection: value[0] }));
  }, []);

  if (!extractedMeshes || !volumeCalculation) {
    return (
      <div className="absolute top-4 right-4 z-60 max-w-sm">
        <Card className="bg-background/95 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Breast Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Extracting breast regions for simulation...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="absolute top-4 right-4 z-60 max-w-sm space-y-4">
      {/* Volume Information */}
      <Card className="bg-background/95 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Volume className="w-4 h-4" />
            Breast Volume Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <Label className="text-xs font-medium">Left Breast</Label>
              <p className="text-sm font-mono">
                {simulatedVolumes?.leftVolume || volumeCalculation.leftVolume} cm³
              </p>
            </div>
            <div>
              <Label className="text-xs font-medium">Right Breast</Label>
              <p className="text-sm font-mono">
                {simulatedVolumes?.rightVolume || volumeCalculation.rightVolume} cm³
              </p>
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Total Volume:</span>
              <span className="font-mono">
                {simulatedVolumes?.totalVolume || volumeCalculation.totalVolume} cm³
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Asymmetry:</span>
              <span className="font-mono">
                {simulatedVolumes?.asymmetryRatio || volumeCalculation.asymmetryRatio}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Simulation Controls */}
      <Card className="bg-background/95 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Augmentation Simulator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Control Buttons */}
          <div className="flex gap-2">
            {!simulationState.isActive ? (
              <Button onClick={startSimulation} size="sm" className="flex-1">
                <Play className="w-3 h-3 mr-2" />
                Start
              </Button>
            ) : (
              <Button onClick={stopSimulation} size="sm" variant="outline" className="flex-1">
                <Square className="w-3 h-3 mr-2" />
                Stop
              </Button>
            )}
            <Button onClick={resetSimulation} size="sm" variant="outline">
              <RotateCcw className="w-3 h-3" />
            </Button>
          </div>

          {/* Simulation Parameters */}
          {simulationState.isActive && (
            <div className="space-y-4">
              <Separator />
              
              {/* Left Breast Controls */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Left Breast Size</Label>
                <Slider
                  value={[simulationState.leftSize]}
                  onValueChange={updateLeftSize}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>50%</span>
                  <span>{Math.round(simulationState.leftSize * 100)}%</span>
                  <span>200%</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">Left Projection</Label>
                <Slider
                  value={[simulationState.leftProjection]}
                  onValueChange={updateLeftProjection}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>50%</span>
                  <span>{Math.round(simulationState.leftProjection * 100)}%</span>
                  <span>200%</span>
                </div>
              </div>

              <Separator />

              {/* Right Breast Controls */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Right Breast Size</Label>
                <Slider
                  value={[simulationState.rightSize]}
                  onValueChange={updateRightSize}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>50%</span>
                  <span>{Math.round(simulationState.rightSize * 100)}%</span>
                  <span>200%</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">Right Projection</Label>
                <Slider
                  value={[simulationState.rightProjection]}
                  onValueChange={updateRightProjection}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>50%</span>
                  <span>{Math.round(simulationState.rightProjection * 100)}%</span>
                  <span>200%</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};