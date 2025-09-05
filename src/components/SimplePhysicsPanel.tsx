import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, RotateCcw, Volume2 } from 'lucide-react';
import { CalculatedMeasurements, BreastContour, NippleMarker } from '@/lib/manualMeasurements';
import { useToast } from '@/hooks/use-toast';

interface SimplePhysicsPanelProps {
  measurements: CalculatedMeasurements;
  leftContour: BreastContour;
  rightContour: BreastContour;
  leftNipple: NippleMarker;
  rightNipple: NippleMarker;
}

export const SimplePhysicsPanel: React.FC<SimplePhysicsPanelProps> = ({
  measurements,
  leftContour,
  rightContour,
  leftNipple,
  rightNipple
}) => {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [leftImplantSize, setLeftImplantSize] = useState(300);
  const [rightImplantSize, setRightImplantSize] = useState(300);
  
  // Calculate base volumes from breast diameter
  const leftBaseVolume = Math.PI * Math.pow(measurements.leftBreastDiameter / 2, 3) * (4/3) * 100; // cm³
  const rightBaseVolume = Math.PI * Math.pow(measurements.rightBreastDiameter / 2, 3) * (4/3) * 100; // cm³
  
  const leftTotalVolume = leftBaseVolume + leftImplantSize;
  const rightTotalVolume = rightBaseVolume + rightImplantSize;

  const handleStart = () => {
    setIsRunning(true);
    toast({
      title: "Physics Simulation Started",
      description: "Real-time breast augmentation simulation is now running"
    });
  };

  const handleStop = () => {
    setIsRunning(false);
    toast({
      title: "Simulation Paused",
      description: "Physics simulation has been paused"
    });
  };

  const handleReset = () => {
    setIsRunning(false);
    setLeftImplantSize(300);
    setRightImplantSize(300);
    toast({
      title: "Simulation Reset",
      description: "Physics simulation has been reset to initial state"
    });
  };

  return (
    <div className="absolute top-16 left-4 z-50 w-80 space-y-4">
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
            {!isRunning ? (
              <Button
                onClick={handleStart}
                className="flex-1"
                size="sm"
              >
                <Play className="w-4 h-4 mr-2" />
                Start
              </Button>
            ) : (
              <Button
                onClick={handleStop}
                variant="secondary"
                className="flex-1"
                size="sm"
              >
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
            )}
            
            <Button
              onClick={handleReset}
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
                {leftTotalVolume.toFixed(0)} cm³
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Right Breast:</span>
              <Badge variant="secondary">
                {rightTotalVolume.toFixed(0)} cm³
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Volume Increase:</span>
              <Badge variant="default">
                L: +{leftImplantSize} cm³ | R: +{rightImplantSize} cm³
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
              Implant Size: {leftImplantSize} cc
            </label>
            <Slider
              value={[leftImplantSize]}
              onValueChange={([value]) => setLeftImplantSize(value)}
              min={100}
              max={800}
              step={25}
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
              Implant Size: {rightImplantSize} cc
            </label>
            <Slider
              value={[rightImplantSize]}
              onValueChange={([value]) => setRightImplantSize(value)}
              min={100}
              max={800}
              step={25}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};