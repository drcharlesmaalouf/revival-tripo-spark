import { useState, useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Volume, 
  RotateCcw, 
  Play, 
  Square, 
  Maximize2, 
  Minimize2,
  Target,
  Settings
} from 'lucide-react';
import { CalculatedMeasurements, BreastContour, NippleMarker } from '@/lib/manualMeasurements';
import { useToast } from '@/hooks/use-toast';

interface BreastManipulatorProps {
  scene: THREE.Group;
  measurements: CalculatedMeasurements;
  leftContour: BreastContour;
  rightContour: BreastContour;
  leftNipple: NippleMarker;
  rightNipple: NippleMarker;
}

interface AugmentationState {
  // Size parameters (0.5 to 3.0 multiplier)
  leftSize: number;
  rightSize: number;
  
  // Projection parameters (0.5 to 2.5 multiplier)
  leftProjection: number;
  rightProjection: number;
  
  // Shape parameters
  leftUpperPole: number; // 0.5 to 1.5 (upper fullness)
  rightUpperPole: number;
  leftLowerPole: number; // 0.5 to 1.5 (lower fullness)
  rightLowerPole: number;
  
  // Position adjustments
  leftHeight: number; // -0.2 to 0.2 (vertical position)
  rightHeight: number;
  leftMedial: number; // -0.2 to 0.2 (medial/lateral position)
  rightMedial: number;
  
  // Implant type simulation
  implantType: 'round' | 'teardrop' | 'gummy';
  implantProfile: 'low' | 'moderate' | 'high' | 'ultra-high';
  
  // Simulation state
  isActive: boolean;
  showImplants: boolean;
}

interface SimulatedVolumes {
  leftVolume: number;
  rightVolume: number;
  totalVolume: number;
  asymmetryRatio: number;
  leftCupSize: string;
  rightCupSize: string;
}

export const BreastManipulator = ({
  scene,
  measurements,
  leftContour,
  rightContour,
  leftNipple,
  rightNipple
}: BreastManipulatorProps) => {
  const [augmentationState, setAugmentationState] = useState<AugmentationState>({
    leftSize: 1.0,
    rightSize: 1.0,
    leftProjection: 1.0,
    rightProjection: 1.0,
    leftUpperPole: 1.0,
    rightUpperPole: 1.0,
    leftLowerPole: 1.0,
    rightLowerPole: 1.0,
    leftHeight: 0.0,
    rightHeight: 0.0,
    leftMedial: 0.0,
    rightMedial: 0.0,
    implantType: 'round',
    implantProfile: 'moderate',
    isActive: false,
    showImplants: false
  });
  
  const [simulatedVolumes, setSimulatedVolumes] = useState<SimulatedVolumes | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const originalMeshesRef = useRef<{ left: THREE.Mesh; right: THREE.Mesh } | null>(null);
  const implantMeshesRef = useRef<{ left: THREE.Mesh; right: THREE.Mesh } | null>(null);
  const { toast } = useToast();

  // Calculate cup size from volume
  const calculateCupSize = useCallback((volume: number): string => {
    if (volume < 150) return 'A';
    if (volume < 250) return 'B';
    if (volume < 350) return 'C';
    if (volume < 450) return 'D';
    if (volume < 550) return 'DD';
    if (volume < 650) return 'E';
    if (volume < 750) return 'F';
    return 'G+';
  }, []);

  // Start simulation
  const startSimulation = useCallback(() => {
    console.log('Starting breast augmentation simulation...');
    
    // Create breast meshes from contours
    const leftBreastMesh = createBreastMeshFromContour(leftContour, leftNipple, 'left');
    const rightBreastMesh = createBreastMeshFromContour(rightContour, rightNipple, 'right');
    
    // Add to scene
    scene.add(leftBreastMesh);
    scene.add(rightBreastMesh);
    
    // Store references
    originalMeshesRef.current = {
      left: leftBreastMesh,
      right: rightBreastMesh
    };
    
    // Create implant visualizations
    const leftImplant = createImplantMesh(leftNipple.position, 'left');
    const rightImplant = createImplantMesh(rightNipple.position, 'right');
    
    implantMeshesRef.current = {
      left: leftImplant,
      right: rightImplant
    };
    
    if (augmentationState.showImplants) {
      scene.add(leftImplant);
      scene.add(rightImplant);
    }
    
    setAugmentationState(prev => ({ ...prev, isActive: true }));
    
    toast({
      title: "Simulation Started",
      description: "You can now adjust breast parameters to simulate augmentation results.",
    });
  }, [scene, leftContour, rightContour, leftNipple, rightNipple, augmentationState.showImplants, toast]);

  // Stop simulation
  const stopSimulation = useCallback(() => {
    if (originalMeshesRef.current) {
      scene.remove(originalMeshesRef.current.left);
      scene.remove(originalMeshesRef.current.right);
      originalMeshesRef.current = null;
    }
    
    if (implantMeshesRef.current) {
      scene.remove(implantMeshesRef.current.left);
      scene.remove(implantMeshesRef.current.right);
      implantMeshesRef.current = null;
    }
    
    setAugmentationState(prev => ({ ...prev, isActive: false }));
    
    toast({
      title: "Simulation Stopped",
      description: "Breast simulation has been deactivated.",
    });
  }, [scene, toast]);

  // Reset all parameters
  const resetSimulation = useCallback(() => {
    setAugmentationState(prev => ({
      ...prev,
      leftSize: 1.0,
      rightSize: 1.0,
      leftProjection: 1.0,
      rightProjection: 1.0,
      leftUpperPole: 1.0,
      rightUpperPole: 1.0,
      leftLowerPole: 1.0,
      rightLowerPole: 1.0,
      leftHeight: 0.0,
      rightHeight: 0.0,
      leftMedial: 0.0,
      rightMedial: 0.0,
      implantType: 'round',
      implantProfile: 'moderate'
    }));
    
    // Reset mesh transformations
    if (originalMeshesRef.current) {
      originalMeshesRef.current.left.scale.set(1, 1, 1);
      originalMeshesRef.current.right.scale.set(1, 1, 1);
      originalMeshesRef.current.left.position.copy(leftNipple.position);
      originalMeshesRef.current.right.position.copy(rightNipple.position);
    }
    
    updateSimulatedVolumes();
  }, [leftNipple.position, rightNipple.position]);

  // Update simulated volumes
  const updateSimulatedVolumes = useCallback(() => {
    const baseLeftVolume = Math.PI * Math.pow(measurements.leftBreastDiameter / 2, 2) * measurements.projectionLeft * 0.75;
    const baseRightVolume = Math.PI * Math.pow(measurements.rightBreastDiameter / 2, 2) * measurements.projectionRight * 0.75;
    
    const scaledLeftVolume = baseLeftVolume * 
      Math.pow(augmentationState.leftSize, 2) * 
      augmentationState.leftProjection *
      ((augmentationState.leftUpperPole + augmentationState.leftLowerPole) / 2);
      
    const scaledRightVolume = baseRightVolume * 
      Math.pow(augmentationState.rightSize, 2) * 
      augmentationState.rightProjection *
      ((augmentationState.rightUpperPole + augmentationState.rightLowerPole) / 2);
    
    const totalVolume = scaledLeftVolume + scaledRightVolume;
    const asymmetryRatio = Math.abs(scaledLeftVolume - scaledRightVolume) / 
      Math.max(scaledLeftVolume, scaledRightVolume) * 100;

    setSimulatedVolumes({
      leftVolume: Math.round(scaledLeftVolume),
      rightVolume: Math.round(scaledRightVolume),
      totalVolume: Math.round(totalVolume),
      asymmetryRatio: Math.round(asymmetryRatio * 10) / 10,
      leftCupSize: calculateCupSize(scaledLeftVolume),
      rightCupSize: calculateCupSize(scaledRightVolume)
    });
  }, [measurements, augmentationState, calculateCupSize]);

  // Update mesh transformations when parameters change
  useEffect(() => {
    if (!augmentationState.isActive || !originalMeshesRef.current) return;

    const { left, right } = originalMeshesRef.current;
    
    // Apply transformations to left breast
    left.scale.set(
      augmentationState.leftSize,
      augmentationState.leftSize * ((augmentationState.leftUpperPole + augmentationState.leftLowerPole) / 2),
      augmentationState.leftProjection
    );
    
    // Apply position adjustments
    const leftBasePos = leftNipple.position.clone();
    leftBasePos.y += augmentationState.leftHeight * 0.1;
    leftBasePos.x += augmentationState.leftMedial * 0.1;
    left.position.copy(leftBasePos);
    
    // Apply transformations to right breast
    right.scale.set(
      augmentationState.rightSize,
      augmentationState.rightSize * ((augmentationState.rightUpperPole + augmentationState.rightLowerPole) / 2),
      augmentationState.rightProjection
    );
    
    // Apply position adjustments
    const rightBasePos = rightNipple.position.clone();
    rightBasePos.y += augmentationState.rightHeight * 0.1;
    rightBasePos.x += augmentationState.rightMedial * 0.1;
    right.position.copy(rightBasePos);
    
    // Update implant meshes if visible
    if (augmentationState.showImplants && implantMeshesRef.current) {
      updateImplantMeshes();
    }
    
    updateSimulatedVolumes();
  }, [augmentationState, leftNipple.position, rightNipple.position, updateSimulatedVolumes]);

  // Update implant mesh visibility
  useEffect(() => {
    if (!implantMeshesRef.current) return;
    
    if (augmentationState.showImplants && augmentationState.isActive) {
      scene.add(implantMeshesRef.current.left);
      scene.add(implantMeshesRef.current.right);
    } else {
      scene.remove(implantMeshesRef.current.left);
      scene.remove(implantMeshesRef.current.right);
    }
  }, [augmentationState.showImplants, augmentationState.isActive, scene]);

  const updateImplantMeshes = useCallback(() => {
    if (!implantMeshesRef.current) return;
    
    const { left, right } = implantMeshesRef.current;
    
    // Scale implants based on size parameters
    const leftImplantScale = augmentationState.leftSize * 0.8;
    const rightImplantScale = augmentationState.rightSize * 0.8;
    
    left.scale.set(leftImplantScale, leftImplantScale, augmentationState.leftProjection * 0.6);
    right.scale.set(rightImplantScale, rightImplantScale, augmentationState.rightProjection * 0.6);
    
    // Position implants slightly behind nipples
    const leftImplantPos = leftNipple.position.clone();
    leftImplantPos.z -= 0.02;
    leftImplantPos.y += augmentationState.leftHeight * 0.1;
    leftImplantPos.x += augmentationState.leftMedial * 0.1;
    left.position.copy(leftImplantPos);
    
    const rightImplantPos = rightNipple.position.clone();
    rightImplantPos.z -= 0.02;
    rightImplantPos.y += augmentationState.rightHeight * 0.1;
    rightImplantPos.x += augmentationState.rightMedial * 0.1;
    right.position.copy(rightImplantPos);
  }, [augmentationState, leftNipple.position, rightNipple.position]);

  // Preset configurations
  const applyPreset = useCallback((preset: 'natural' | 'moderate' | 'dramatic') => {
    let newState: Partial<AugmentationState>;
    
    switch (preset) {
      case 'natural':
        newState = {
          leftSize: 1.2,
          rightSize: 1.2,
          leftProjection: 1.1,
          rightProjection: 1.1,
          leftUpperPole: 0.9,
          rightUpperPole: 0.9,
          leftLowerPole: 1.1,
          rightLowerPole: 1.1,
          implantProfile: 'low'
        };
        break;
      case 'moderate':
        newState = {
          leftSize: 1.5,
          rightSize: 1.5,
          leftProjection: 1.3,
          rightProjection: 1.3,
          leftUpperPole: 1.0,
          rightUpperPole: 1.0,
          leftLowerPole: 1.2,
          rightLowerPole: 1.2,
          implantProfile: 'moderate'
        };
        break;
      case 'dramatic':
        newState = {
          leftSize: 2.0,
          rightSize: 2.0,
          leftProjection: 1.8,
          rightProjection: 1.8,
          leftUpperPole: 1.3,
          rightUpperPole: 1.3,
          leftLowerPole: 1.4,
          rightLowerPole: 1.4,
          implantProfile: 'high'
        };
        break;
    }
    
    setAugmentationState(prev => ({ ...prev, ...newState }));
  }, []);

  // Sync left and right parameters
  const syncParameters = useCallback(() => {
    setAugmentationState(prev => ({
      ...prev,
      rightSize: prev.leftSize,
      rightProjection: prev.leftProjection,
      rightUpperPole: prev.leftUpperPole,
      rightLowerPole: prev.leftLowerPole,
      rightHeight: prev.leftHeight,
      rightMedial: -prev.leftMedial // Mirror medial adjustment
    }));
  }, []);

  return (
    <div className="absolute top-4 right-4 z-60 max-w-sm space-y-4">
      {/* Volume Information */}
      <Card className="bg-background/95 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Volume className="w-4 h-4" />
            Augmentation Results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {simulatedVolumes ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <Label className="text-xs font-medium">Left Breast</Label>
                  <p className="text-sm font-mono">{simulatedVolumes.leftVolume} cm³</p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {simulatedVolumes.leftCupSize} Cup
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs font-medium">Right Breast</Label>
                  <p className="text-sm font-mono">{simulatedVolumes.rightVolume} cm³</p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {simulatedVolumes.rightCupSize} Cup
                  </Badge>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Total Volume:</span>
                  <span className="font-mono">{simulatedVolumes.totalVolume} cm³</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Asymmetry:</span>
                  <span className="font-mono">{simulatedVolumes.asymmetryRatio}%</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground">
              Start simulation to see volume calculations
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Controls */}
      <Card className="bg-background/95 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Augmentation Simulator</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Control Buttons */}
          <div className="flex gap-2">
            {!augmentationState.isActive ? (
              <Button onClick={startSimulation} size="sm" className="flex-1">
                <Play className="w-3 h-3 mr-2" />
                Start Simulation
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
          {augmentationState.isActive && (
            <div className="space-y-4">
              <Separator />
              
              {/* Quick Presets */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Quick Presets</Label>
                <div className="grid grid-cols-3 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset('natural')}
                    className="text-xs"
                  >
                    Natural
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset('moderate')}
                    className="text-xs"
                  >
                    Moderate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset('dramatic')}
                    className="text-xs"
                  >
                    Dramatic
                  </Button>
                </div>
              </div>

              {/* Implant Configuration */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Implant Type</Label>
                <Select
                  value={augmentationState.implantType}
                  onValueChange={(value: 'round' | 'teardrop' | 'gummy') =>
                    setAugmentationState(prev => ({ ...prev, implantType: value }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round">Round</SelectItem>
                    <SelectItem value="teardrop">Teardrop</SelectItem>
                    <SelectItem value="gummy">Gummy Bear</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">Profile</Label>
                <Select
                  value={augmentationState.implantProfile}
                  onValueChange={(value: 'low' | 'moderate' | 'high' | 'ultra-high') =>
                    setAugmentationState(prev => ({ ...prev, implantProfile: value }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low Profile</SelectItem>
                    <SelectItem value="moderate">Moderate Profile</SelectItem>
                    <SelectItem value="high">High Profile</SelectItem>
                    <SelectItem value="ultra-high">Ultra High Profile</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sync Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={syncParameters}
                className="w-full text-xs"
              >
                <Target className="w-3 h-3 mr-2" />
                Sync Left to Right
              </Button>

              {isExpanded && (
                <>
                  <Separator />
                  
                  {/* Left Breast Controls */}
                  <div className="space-y-3">
                    <Label className="text-xs font-medium text-primary">Left Breast</Label>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Size</span>
                        <span>{Math.round(augmentationState.leftSize * 100)}%</span>
                      </div>
                      <Slider
                        value={[augmentationState.leftSize]}
                        onValueChange={(value) =>
                          setAugmentationState(prev => ({ ...prev, leftSize: value[0] }))
                        }
                        min={0.5}
                        max={3.0}
                        step={0.1}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Projection</span>
                        <span>{Math.round(augmentationState.leftProjection * 100)}%</span>
                      </div>
                      <Slider
                        value={[augmentationState.leftProjection]}
                        onValueChange={(value) =>
                          setAugmentationState(prev => ({ ...prev, leftProjection: value[0] }))
                        }
                        min={0.5}
                        max={2.5}
                        step={0.1}
                        className="w-full"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="text-xs">Upper Pole</div>
                        <Slider
                          value={[augmentationState.leftUpperPole]}
                          onValueChange={(value) =>
                            setAugmentationState(prev => ({ ...prev, leftUpperPole: value[0] }))
                          }
                          min={0.5}
                          max={1.5}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs">Lower Pole</div>
                        <Slider
                          value={[augmentationState.leftLowerPole]}
                          onValueChange={(value) =>
                            setAugmentationState(prev => ({ ...prev, leftLowerPole: value[0] }))
                          }
                          min={0.5}
                          max={1.5}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Right Breast Controls */}
                  <div className="space-y-3">
                    <Label className="text-xs font-medium text-blue-500">Right Breast</Label>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Size</span>
                        <span>{Math.round(augmentationState.rightSize * 100)}%</span>
                      </div>
                      <Slider
                        value={[augmentationState.rightSize]}
                        onValueChange={(value) =>
                          setAugmentationState(prev => ({ ...prev, rightSize: value[0] }))
                        }
                        min={0.5}
                        max={3.0}
                        step={0.1}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Projection</span>
                        <span>{Math.round(augmentationState.rightProjection * 100)}%</span>
                      </div>
                      <Slider
                        value={[augmentationState.rightProjection]}
                        onValueChange={(value) =>
                          setAugmentationState(prev => ({ ...prev, rightProjection: value[0] }))
                        }
                        min={0.5}
                        max={2.5}
                        step={0.1}
                        className="w-full"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="text-xs">Upper Pole</div>
                        <Slider
                          value={[augmentationState.rightUpperPole]}
                          onValueChange={(value) =>
                            setAugmentationState(prev => ({ ...prev, rightUpperPole: value[0] }))
                          }
                          min={0.5}
                          max={1.5}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs">Lower Pole</div>
                        <Slider
                          value={[augmentationState.rightLowerPole]}
                          onValueChange={(value) =>
                            setAugmentationState(prev => ({ ...prev, rightLowerPole: value[0] }))
                          }
                          min={0.5}
                          max={1.5}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Advanced Position Controls */}
                  <div className="space-y-3">
                    <Label className="text-xs font-medium">Position Adjustments</Label>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <div className="text-xs">Left Height</div>
                        <Slider
                          value={[augmentationState.leftHeight]}
                          onValueChange={(value) =>
                            setAugmentationState(prev => ({ ...prev, leftHeight: value[0] }))
                          }
                          min={-0.2}
                          max={0.2}
                          step={0.05}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs">Right Height</div>
                        <Slider
                          value={[augmentationState.rightHeight]}
                          onValueChange={(value) =>
                            setAugmentationState(prev => ({ ...prev, rightHeight: value[0] }))
                          }
                          min={-0.2}
                          max={0.2}
                          step={0.05}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Implant Visualization Toggle */}
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Show Implants</Label>
                    <Button
                      variant={augmentationState.showImplants ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        setAugmentationState(prev => ({ ...prev, showImplants: !prev.showImplants }))
                      }
                    >
                      <Settings className="w-3 h-3" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Helper function to create breast mesh from contour
function createBreastMeshFromContour(
  contour: BreastContour,
  nipple: NippleMarker,
  side: 'left' | 'right'
): THREE.Mesh {
  // Create a breast-shaped geometry based on the contour
  const geometry = new THREE.SphereGeometry(contour.radius, 16, 12);
  
  // Modify geometry to match breast shape
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const z = positions.getZ(i);
    
    // Flatten the back (chest wall side)
    if (z < 0) {
      positions.setZ(i, z * 0.3);
    }
    
    // Create more natural breast shape
    if (y < 0) {
      positions.setY(i, y * 1.2); // Extend lower pole
    }
  }
  
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  
  const material = new THREE.MeshStandardMaterial({
    color: side === 'left' ? 0xff69b4 : 0x4169e1,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(contour.center);
  mesh.name = `${side}-breast-simulation`;
  
  return mesh;
}

// Helper function to create implant mesh
function createImplantMesh(position: THREE.Vector3, side: 'left' | 'right'): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(0.04, 12, 10);
  
  // Modify for implant shape
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const z = positions.getZ(i);
    
    // Flatten back for chest wall contact
    if (z < 0) {
      positions.setZ(i, z * 0.2);
    }
    
    // Slightly flatten bottom
    if (y < 0) {
      positions.setY(i, y * 0.8);
    }
  }
  
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  
  const material = new THREE.MeshStandardMaterial({
    color: 0xe6f3ff,
    transparent: true,
    opacity: 0.4,
    metalness: 0.1,
    roughness: 0.2
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.position.z -= 0.02; // Position behind nipple
  mesh.name = `${side}-implant`;
  
  return mesh;
}