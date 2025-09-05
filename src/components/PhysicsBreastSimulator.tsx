import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, RotateCcw, Volume2 } from 'lucide-react';
import { BreastPhysicsEngine, PhysicsParameters, BreastPhysicsState } from '@/lib/breastPhysics';
import { BreastContour, NippleMarker, CalculatedMeasurements } from '@/lib/manualMeasurements';
import { useToast } from '@/hooks/use-toast';

interface PhysicsBreastSimulatorProps {
  scene: THREE.Group;
  measurements: CalculatedMeasurements;
  leftContour: BreastContour;
  rightContour: BreastContour;
  leftNipple: NippleMarker;
  rightNipple: NippleMarker;
}

interface SimulationState {
  isRunning: boolean;
  physicsStates: Map<string, BreastPhysicsState>;
  leftVolume: number;
  rightVolume: number;
  leftImplantVisible: boolean;
  rightImplantVisible: boolean;
}

// Physics simulation component that runs inside Canvas
const PhysicsSimulation: React.FC<{
  engine: BreastPhysicsEngine;
  leftParams: PhysicsParameters;
  rightParams: PhysicsParameters;
  onStateUpdate: (states: Map<string, BreastPhysicsState>) => void;
}> = ({ engine, leftParams, rightParams, onStateUpdate }) => {
  const frameCount = useRef(0);
  
  useFrame(() => {
    frameCount.current++;
    
    // Update physics at 60fps
    if (frameCount.current % 1 === 0) {
      // This would be handled by the physics engine
      // For now, we'll simulate the updates
      const mockStates = new Map<string, BreastPhysicsState>();
      mockStates.set('left', {
        originalVolume: 250,
        currentVolume: 250 + leftParams.implantSize * 0.8,
        deformationField: new Float32Array(300),
        velocityField: new Float32Array(300),
        pressureField: new Float32Array(100)
      });
      mockStates.set('right', {
        originalVolume: 260,
        currentVolume: 260 + rightParams.implantSize * 0.8,
        deformationField: new Float32Array(300),
        velocityField: new Float32Array(300),
        pressureField: new Float32Array(100)
      });
      
      onStateUpdate(mockStates);
    }
  });
  
  return null;
};

export const PhysicsBreastSimulator: React.FC<PhysicsBreastSimulatorProps> = ({
  scene,
  measurements,
  leftContour,
  rightContour,
  leftNipple,
  rightNipple
}) => {
  const engineRef = useRef<BreastPhysicsEngine | null>(null);
  const { toast } = useToast();
  
  console.log('PhysicsBreastSimulator rendered with:', {
    scene,
    measurements,
    leftContour,
    rightContour,
    leftNipple,
    rightNipple
  });
  
  // Simulation state
  const [simulationState, setSimulationState] = useState<SimulationState>({
    isRunning: false,
    physicsStates: new Map(),
    leftVolume: 0,
    rightVolume: 0,
    leftImplantVisible: true,
    rightImplantVisible: true
  });
  
  // Physics parameters for each side
  const [leftParams, setLeftParams] = useState<PhysicsParameters>({
    implantSize: 300,
    implantType: 'round',
    implantProfile: 'moderate',
    tissueElasticity: 0.7,
    skinTension: 0.6,
    gravityEffect: 0.8,
    implantPosition: 'subglandular'
  });
  
  const [rightParams, setRightParams] = useState<PhysicsParameters>({
    implantSize: 300,
    implantType: 'round',
    implantProfile: 'moderate',
    tissueElasticity: 0.7,
    skinTension: 0.6,
    gravityEffect: 0.8,
    implantPosition: 'subglandular'
  });
  
  // Initialize physics engine
  useEffect(() => {
    console.log('Attempting to initialize physics engine...');
    
    if (!engineRef.current && leftContour && rightContour && leftNipple && rightNipple) {
      try {
        console.log('Creating BreastPhysicsEngine...');
        engineRef.current = new BreastPhysicsEngine();
        console.log('Physics engine initialized successfully');
        
        console.log('Creating soft bodies...');
        // Create soft bodies for breasts
        const leftBreast = engineRef.current.createBreastSoftBody(
          leftContour,
          leftNipple,
          'left',
          leftParams
        );
        console.log('Left breast created:', leftBreast);
        
        const rightBreast = engineRef.current.createBreastSoftBody(
          rightContour,
          rightNipple,
          'right',
          rightParams
        );
        console.log('Right breast created:', rightBreast);
        
        // Add implants
        const leftImplantPos = leftNipple.position.clone();
        leftImplantPos.z -= 0.03;
        engineRef.current.addImplant(leftImplantPos, 'left', leftParams);
        console.log('Left implant added');
        
        const rightImplantPos = rightNipple.position.clone();
        rightImplantPos.z -= 0.03;
        engineRef.current.addImplant(rightImplantPos, 'right', rightParams);
        console.log('Right implant added');
        
        setSimulationState(prev => ({
          ...prev,
          leftVolume: leftBreast.state.originalVolume,
          rightVolume: rightBreast.state.originalVolume
        }));
        console.log('Simulation state updated');
      } catch (error) {
        console.error('Failed to initialize physics engine:', error);
        console.error('Error stack:', error.stack);
      }
    } else {
      console.log('Physics engine already exists or missing dependencies');
    }
    
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, []); // Empty dependency array to prevent infinite loops
  
  const handleStartSimulation = useCallback(() => {
    if (!engineRef.current) return;
    
    engineRef.current.startSimulation((states) => {
      setSimulationState(prev => ({
        ...prev,
        physicsStates: states,
        leftVolume: states.get('left')?.currentVolume || prev.leftVolume,
        rightVolume: states.get('right')?.currentVolume || prev.rightVolume
      }));
    });
    
    setSimulationState(prev => ({ ...prev, isRunning: true }));
    toast({
      title: "Physics Simulation Started",
      description: "Real-time breast augmentation simulation is now running"
    });
  }, [toast]);
  
  const handleStopSimulation = useCallback(() => {
    if (!engineRef.current) return;
    
    engineRef.current.stopSimulation();
    setSimulationState(prev => ({ ...prev, isRunning: false }));
    toast({
      title: "Simulation Paused",
      description: "Physics simulation has been paused"
    });
  }, [toast]);
  
  const handleResetSimulation = useCallback(() => {
    if (!engineRef.current) return;
    
    engineRef.current.stopSimulation();
    engineRef.current.dispose();
    engineRef.current = null;
    
    setSimulationState({
      isRunning: false,
      physicsStates: new Map(),
      leftVolume: 0,
      rightVolume: 0,
      leftImplantVisible: true,
      rightImplantVisible: true
    });
    
    toast({
      title: "Simulation Reset",
      description: "Physics simulation has been reset to initial state"
    });
  }, [toast]);
  
  const updateLeftParams = useCallback((updates: Partial<PhysicsParameters>) => {
    const newParams = { ...leftParams, ...updates };
    setLeftParams(newParams);
    
    if (engineRef.current) {
      engineRef.current.updateImplantParameters('left', newParams);
    }
  }, [leftParams]);
  
  const updateRightParams = useCallback((updates: Partial<PhysicsParameters>) => {
    const newParams = { ...rightParams, ...updates };
    setRightParams(newParams);
    
    if (engineRef.current) {
      engineRef.current.updateImplantParameters('right', newParams);
    }
  }, [rightParams]);
  
  const calculateVolumeIncrease = (originalVolume: number, currentVolume: number) => {
    return currentVolume - originalVolume;
  };
  
  const calculateCupSizeIncrease = (volumeIncrease: number) => {
    const cupSizes = ['AA', 'A', 'B', 'C', 'D', 'DD', 'E', 'F', 'G', 'H'];
    const sizeIncrease = Math.floor(volumeIncrease / 150); // ~150cc per cup size
    return sizeIncrease;
  };

  return (
    <div className="absolute top-16 left-4 z-50 w-80 space-y-4" style={{ backgroundColor: 'rgba(255, 0, 0, 0.1)', border: '2px solid red' }}>
      {/* Simulation Controls */}
      <Card className="bg-background/95 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-primary" />
            Physics Simulation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Control buttons */}
          <div className="flex gap-2">
            {!simulationState.isRunning ? (
              <Button
                onClick={handleStartSimulation}
                className="flex-1"
                size="sm"
              >
                <Play className="w-4 h-4 mr-2" />
                Start
              </Button>
            ) : (
              <Button
                onClick={handleStopSimulation}
                variant="secondary"
                className="flex-1"
                size="sm"
              >
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
            )}
            
            <Button
              onClick={handleResetSimulation}
              variant="outline"
              size="sm"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Real-time results */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Left Breast:</span>
              <Badge variant="secondary">
                {simulationState.leftVolume.toFixed(0)} cm³
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Right Breast:</span>
              <Badge variant="secondary">
                {simulationState.rightVolume.toFixed(0)} cm³
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Volume Increase:</span>
              <Badge variant="default">
                +{calculateVolumeIncrease(250, simulationState.leftVolume).toFixed(0)} cm³
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Left Breast Parameters */}
      <Card className="bg-background/95 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Left Breast Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Implant Size: {leftParams.implantSize} cc
            </label>
            <Slider
              value={[leftParams.implantSize]}
              onValueChange={([value]) => updateLeftParams({ implantSize: value })}
              min={100}
              max={800}
              step={25}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">
              Tissue Elasticity: {(leftParams.tissueElasticity * 100).toFixed(0)}%
            </label>
            <Slider
              value={[leftParams.tissueElasticity * 100]}
              onValueChange={([value]) => updateLeftParams({ tissueElasticity: value / 100 })}
              min={10}
              max={100}
              step={5}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">
              Skin Tension: {(leftParams.skinTension * 100).toFixed(0)}%
            </label>
            <Slider
              value={[leftParams.skinTension * 100]}
              onValueChange={([value]) => updateLeftParams({ skinTension: value / 100 })}
              min={10}
              max={100}
              step={5}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">
              Gravity Effect: {(leftParams.gravityEffect * 100).toFixed(0)}%
            </label>
            <Slider
              value={[leftParams.gravityEffect * 100]}
              onValueChange={([value]) => updateLeftParams({ gravityEffect: value / 100 })}
              min={0}
              max={100}
              step={10}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Right Breast Parameters */}
      <Card className="bg-background/95 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Right Breast Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Implant Size: {rightParams.implantSize} cc
            </label>
            <Slider
              value={[rightParams.implantSize]}
              onValueChange={([value]) => updateRightParams({ implantSize: value })}
              min={100}
              max={800}
              step={25}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">
              Tissue Elasticity: {(rightParams.tissueElasticity * 100).toFixed(0)}%
            </label>
            <Slider
              value={[rightParams.tissueElasticity * 100]}
              onValueChange={([value]) => updateRightParams({ tissueElasticity: value / 100 })}
              min={10}
              max={100}
              step={5}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">
              Skin Tension: {(rightParams.skinTension * 100).toFixed(0)}%
            </label>
            <Slider
              value={[rightParams.skinTension * 100]}
              onValueChange={([value]) => updateRightParams({ skinTension: value / 100 })}
              min={10}
              max={100}
              step={5}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">
              Gravity Effect: {(rightParams.gravityEffect * 100).toFixed(0)}%
            </label>
            <Slider
              value={[rightParams.gravityEffect * 100]}
              onValueChange={([value]) => updateRightParams({ gravityEffect: value / 100 })}
              min={0}
              max={100}
              step={10}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Hidden Physics Canvas */}
      <div className="hidden">
        <Canvas>
          <Physics gravity={[0, -9.82, 0]} iterations={10}>
            <PhysicsSimulation
              engine={engineRef.current!}
              leftParams={leftParams}
              rightParams={rightParams}
              onStateUpdate={(states) => {
                setSimulationState(prev => ({
                  ...prev,
                  physicsStates: states
                }));
              }}
            />
          </Physics>
        </Canvas>
      </div>
    </div>
  );
};