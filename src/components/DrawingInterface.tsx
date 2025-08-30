import { useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  ManualMeasurements, 
  BreastContour, 
  NippleMarker, 
  ManualMeasurementCalculator,
  CalculatedMeasurements 
} from '@/lib/manualMeasurements';
import { Circle, Target, Ruler, RotateCcw } from 'lucide-react';

interface DrawingInterfaceProps {
  scene: THREE.Group | null;
  onMeasurementsComplete: (measurements: CalculatedMeasurements, annotations: {
    leftContour: BreastContour;
    rightContour: BreastContour;
    leftNipple: NippleMarker;
    rightNipple: NippleMarker;
  }) => void;
  onModeChange: (mode: 'leftContour' | 'rightContour' | 'leftNipple' | 'rightNipple' | 'none') => void;
  onGetHandlers?: (handlers: {
    handleContourComplete: (contour: BreastContour) => void;
    handleNipplePlaced: (nipple: NippleMarker) => void;
  }) => void;
}

type DrawingMode = 'leftContour' | 'rightContour' | 'leftNipple' | 'rightNipple' | 'none';

export const DrawingInterface = ({ 
  scene, 
  onMeasurementsComplete,
  onModeChange,
  onGetHandlers
}: DrawingInterfaceProps) => {
  const [currentMode, setCurrentMode] = useState<DrawingMode>('none');
  const [annotations, setAnnotations] = useState<ManualMeasurements>({
    leftContour: null,
    rightContour: null,
    leftNipple: null,
    rightNipple: null,
    nippleToNippleDistance: null
  });
  const [nippleDistance, setNippleDistance] = useState<string>('');
  const [visualizationGroup, setVisualizationGroup] = useState<THREE.Group | null>(null);

  // Update parent component when mode changes
  useEffect(() => {
    onModeChange(currentMode);
  }, [currentMode, onModeChange]);

  // Update visualization when annotations change
  useEffect(() => {
    updateVisualization();
  }, [annotations, scene]);

  const updateVisualization = useCallback(() => {
    if (!scene) return;

    // Remove existing visualization
    if (visualizationGroup) {
      scene.remove(visualizationGroup);
    }

    const newGroup = new THREE.Group();
    newGroup.name = 'DrawingVisualization';

    // Add nipple visualizations if they exist
    if (annotations.leftNipple) {
      const leftNippleViz = ManualMeasurementCalculator.createNippleVisualization(
        annotations.leftNipple
      );
      newGroup.add(leftNippleViz);
    }

    if (annotations.rightNipple) {
      const rightNippleViz = ManualMeasurementCalculator.createNippleVisualization(
        annotations.rightNipple
      );
      newGroup.add(rightNippleViz);
    }

    scene.add(newGroup);
    setVisualizationGroup(newGroup);
  }, [scene, annotations, visualizationGroup]);

  const handleModeSelect = useCallback((mode: DrawingMode) => {
    setCurrentMode(mode);
    console.log(`Switched to ${mode} mode`);
  }, []);

  const handleContourComplete = useCallback((contour: BreastContour) => {
    setAnnotations(prev => ({
      ...prev,
      [contour.id === 'left' ? 'leftContour' : 'rightContour']: contour
    }));
    
    // Auto-advance to next mode
    if (contour.id === 'left') {
      setCurrentMode('rightContour');
    } else {
      setCurrentMode('leftNipple');
    }
    
    console.log(`${contour.id} contour completed, advancing to next mode`);
  }, []);

  const handleNipplePlaced = useCallback((nipple: NippleMarker) => {
    setAnnotations(prev => ({
      ...prev,
      [nipple.id === 'left' ? 'leftNipple' : 'rightNipple']: nipple
    }));

    // Auto-advance to next mode
    if (nipple.id === 'left') {
      setCurrentMode('rightNipple');
    } else {
      setCurrentMode('none');
    }
    
    console.log(`${nipple.id} nipple placed, advancing to next mode`);
  }, []);

  // Export handlers to parent
  useEffect(() => {
    if (onGetHandlers) {
      onGetHandlers({
        handleContourComplete,
        handleNipplePlaced
      });
    }
  }, [handleContourComplete, handleNipplePlaced, onGetHandlers]);

  const handleDistanceSubmit = useCallback(() => {
    const distance = parseFloat(nippleDistance);
    
    if (isNaN(distance) || distance <= 0) {
      alert('Please enter a valid positive number');
      return;
    }
    
    if (distance < 5 || distance > 50) {
      alert('Distance should be between 5-50 cm');
      return;
    }

    const updatedAnnotations = {
      ...annotations,
      nippleToNippleDistance: distance
    };

    const measurements = ManualMeasurementCalculator.calculateAllMeasurements(updatedAnnotations);
    if (measurements && annotations.leftContour && annotations.rightContour && 
        annotations.leftNipple && annotations.rightNipple) {
      onMeasurementsComplete(measurements, {
        leftContour: annotations.leftContour,
        rightContour: annotations.rightContour,
        leftNipple: annotations.leftNipple,
        rightNipple: annotations.rightNipple
      });
      console.log('Measurements completed:', measurements);
    } else {
      alert('Please complete all annotations before calculating measurements');
    }
  }, [nippleDistance, annotations, onMeasurementsComplete]);

  const resetAnnotations = useCallback(() => {
    setAnnotations({
      leftContour: null,
      rightContour: null,
      leftNipple: null,
      rightNipple: null,
      nippleToNippleDistance: null
    });
    setNippleDistance('');
    setCurrentMode('none');
    
    // Clear all visual elements from scene
    if (scene) {
      const itemsToRemove: THREE.Object3D[] = [];
      scene.traverse((child) => {
        if (child.name.includes('drawing') || 
            child.name.includes('nipple-marker') ||
            child.name === 'DrawingVisualization') {
          itemsToRemove.push(child);
        }
      });
      itemsToRemove.forEach(item => scene.remove(item));
    }
    
    if (visualizationGroup && scene) {
      scene.remove(visualizationGroup);
      setVisualizationGroup(null);
    }
  }, [scene, visualizationGroup]);

  const isComplete = annotations.leftContour && annotations.rightContour && 
                    annotations.leftNipple && annotations.rightNipple;

  return (
    <div className="absolute top-4 left-4 z-60 max-w-sm space-y-4">
      {/* Drawing Tools */}
      <Card className="bg-background/95 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Breast Annotation Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Tool Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={currentMode === 'leftContour' ? "default" : "outline"}
              size="sm"
              onClick={() => handleModeSelect('leftContour')}
              className="flex items-center gap-2 text-xs"
            >
              <Circle className="w-3 h-3" />
              Left Contour
            </Button>
            
            <Button
              variant={currentMode === 'rightContour' ? "default" : "outline"}
              size="sm"
              onClick={() => handleModeSelect('rightContour')}
              className="flex items-center gap-2 text-xs"
              disabled={!annotations.leftContour}
            >
              <Circle className="w-3 h-3" />
              Right Contour
            </Button>
            
            <Button
              variant={currentMode === 'leftNipple' ? "default" : "outline"}
              size="sm"
              onClick={() => handleModeSelect('leftNipple')}
              className="flex items-center gap-2 text-xs"
              disabled={!annotations.rightContour}
            >
              <Target className="w-3 h-3" />
              Left Nipple
            </Button>
            
            <Button
              variant={currentMode === 'rightNipple' ? "default" : "outline"}
              size="sm"
              onClick={() => handleModeSelect('rightNipple')}
              className="flex items-center gap-2 text-xs"
              disabled={!annotations.leftNipple}
            >
              <Target className="w-3 h-3" />
              Right Nipple
            </Button>
          </div>

          {/* Instructions */}
          <div className="text-xs text-muted-foreground">
            {currentMode === 'leftContour' && 'Draw around the left breast contour'}
            {currentMode === 'rightContour' && 'Draw around the right breast contour'}
            {currentMode === 'leftNipple' && 'Click on the left nipple'}
            {currentMode === 'rightNipple' && 'Click on the right nipple'}
            {currentMode === 'none' && 'Select a tool to start annotating'}
          </div>

          <Separator />

          {/* Distance Input */}
          {isComplete && (
            <div className="space-y-2">
              <Label htmlFor="nipple-distance" className="text-xs">
                Nipple-to-Nipple Distance (cm)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="nipple-distance"
                  type="number"
                  value={nippleDistance}
                  onChange={(e) => setNippleDistance(e.target.value)}
                  placeholder="18.5"
                  className="text-xs"
                  min="5"
                  max="50"
                  step="0.1"
                />
                <Button 
                  onClick={handleDistanceSubmit}
                  size="sm"
                  disabled={!nippleDistance.trim()}
                >
                  <Ruler className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Reset Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={resetAnnotations}
            className="w-full flex items-center gap-2"
          >
            <RotateCcw className="w-3 h-3" />
            Reset All
          </Button>

          {/* Progress */}
          <div className="text-xs text-muted-foreground">
            Progress: {Object.values(annotations).filter(Boolean).length}/4 complete
          </div>
        </CardContent>
      </Card>
    </div>
  );
};