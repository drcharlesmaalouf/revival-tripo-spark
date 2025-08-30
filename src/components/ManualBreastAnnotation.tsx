import { useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MeasurementInput } from './MeasurementInput';
import { 
  ManualMeasurements, 
  BreastContour, 
  NippleMarker, 
  ManualMeasurementCalculator,
  CalculatedMeasurements 
} from '@/lib/manualMeasurements';
import { Circle, Target, Ruler, Eye, EyeOff } from 'lucide-react';

interface ManualBreastAnnotationProps {
  scene: THREE.Group | null;
  onMeasurementsComplete: (measurements: CalculatedMeasurements) => void;
  onModeChange: (mode: 'leftContour' | 'rightContour' | 'leftNipple' | 'rightNipple' | 'none') => void;
}

type AnnotationStep = 'leftContour' | 'rightContour' | 'leftNipple' | 'rightNipple' | 'distance' | 'complete';

export const ManualBreastAnnotation = ({ 
  scene, 
  onMeasurementsComplete,
  onModeChange 
}: ManualBreastAnnotationProps) => {
  const [currentStep, setCurrentStep] = useState<AnnotationStep>('leftContour');
  const [annotations, setAnnotations] = useState<ManualMeasurements>({
    leftContour: null,
    rightContour: null,
    leftNipple: null,
    rightNipple: null,
    nippleToNippleDistance: null
  });
  const [showVisualization, setShowVisualization] = useState(true);
  const [visualizationGroup, setVisualizationGroup] = useState<THREE.Group | null>(null);

  // Create visualization markers
  const updateVisualization = useCallback(() => {
    if (!scene || !showVisualization) return;

    // Remove existing visualization
    if (visualizationGroup) {
      scene.remove(visualizationGroup);
    }

    const newGroup = new THREE.Group();
    newGroup.name = 'ManualAnnotations';

    // Add contour visualizations
    if (annotations.leftContour) {
      const leftContourViz = ManualMeasurementCalculator.createContourVisualization(
        annotations.leftContour, 
        0xff69b4 // Hot pink
      );
      newGroup.add(leftContourViz);
    }

    if (annotations.rightContour) {
      const rightContourViz = ManualMeasurementCalculator.createContourVisualization(
        annotations.rightContour, 
        0x4169e1 // Royal blue
      );
      newGroup.add(rightContourViz);
    }

    // Add nipple visualizations
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
  }, [scene, annotations, showVisualization, visualizationGroup]);

  // Update mode when step changes
  useEffect(() => {
    const modeMap: Record<AnnotationStep, 'leftContour' | 'rightContour' | 'leftNipple' | 'rightNipple' | 'none'> = {
      leftContour: 'leftContour',
      rightContour: 'rightContour', 
      leftNipple: 'leftNipple',
      rightNipple: 'rightNipple',
      distance: 'none',
      complete: 'none'
    };
    onModeChange(modeMap[currentStep]);
  }, [currentStep, onModeChange]);

  // Update visualization when annotations change
  useEffect(() => {
    updateVisualization();
  }, [updateVisualization]);

  const handleContourComplete = useCallback((contour: BreastContour) => {
    setAnnotations(prev => ({
      ...prev,
      [contour.id === 'left' ? 'leftContour' : 'rightContour']: contour
    }));

    if (contour.id === 'left') {
      setCurrentStep('rightContour');
    } else {
      setCurrentStep('leftNipple');
    }
  }, []);

  const handleNipplePlaced = useCallback((nipple: NippleMarker) => {
    setAnnotations(prev => ({
      ...prev,
      [nipple.id === 'left' ? 'leftNipple' : 'rightNipple']: nipple
    }));

    if (nipple.id === 'left') {
      setCurrentStep('rightNipple');
    } else {
      setCurrentStep('distance');
    }
  }, []);

  const handleDistanceSubmit = useCallback((distance: number) => {
    setAnnotations(prev => ({
      ...prev,
      nippleToNippleDistance: distance
    }));

    // Calculate all measurements
    const updatedAnnotations = {
      ...annotations,
      nippleToNippleDistance: distance
    };

    const measurements = ManualMeasurementCalculator.calculateAllMeasurements(updatedAnnotations);
    if (measurements) {
      onMeasurementsComplete(measurements);
      setCurrentStep('complete');
    }
  }, [annotations, onMeasurementsComplete]);

  const resetAnnotations = useCallback(() => {
    setAnnotations({
      leftContour: null,
      rightContour: null,
      leftNipple: null,
      rightNipple: null,
      nippleToNippleDistance: null
    });
    setCurrentStep('leftContour');
    
    if (visualizationGroup && scene) {
      scene.remove(visualizationGroup);
      setVisualizationGroup(null);
    }
  }, [visualizationGroup, scene]);

  const getStepIcon = (step: AnnotationStep) => {
    switch (step) {
      case 'leftContour':
      case 'rightContour':
        return <Circle className="w-4 h-4" />;
      case 'leftNipple':
      case 'rightNipple':
        return <Target className="w-4 h-4" />;
      case 'distance':
        return <Ruler className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStepInstructions = () => {
    switch (currentStep) {
      case 'leftContour':
        return 'Click around the left breast to create a contour. Press Enter or Ctrl+Click to finish.';
      case 'rightContour':
        return 'Click around the right breast to create a contour. Press Enter or Ctrl+Click to finish.';
      case 'leftNipple':
        return 'Click on the left nipple to place a marker.';
      case 'rightNipple':
        return 'Click on the right nipple to place a marker.';
      case 'distance':
        return 'Enter the actual nipple-to-nipple distance to calibrate measurements.';
      case 'complete':
        return 'Annotation complete! All measurements have been calculated.';
      default:
        return '';
    }
  };

  return (
    <div className="absolute top-4 left-4 z-60 max-w-sm space-y-4">
      {/* Instructions Panel */}
      <Card className="bg-background/95 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              {getStepIcon(currentStep)}
              Manual Breast Annotation
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowVisualization(!showVisualization)}
            >
              {showVisualization ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {getStepInstructions()}
          </p>

          {/* Progress indicators */}
          <div className="flex gap-2 flex-wrap">
            <Badge variant={annotations.leftContour ? "default" : "secondary"}>
              Left Contour {annotations.leftContour ? '✓' : '○'}
            </Badge>
            <Badge variant={annotations.rightContour ? "default" : "secondary"}>
              Right Contour {annotations.rightContour ? '✓' : '○'}
            </Badge>
            <Badge variant={annotations.leftNipple ? "default" : "secondary"}>
              Left Nipple {annotations.leftNipple ? '✓' : '○'}
            </Badge>
            <Badge variant={annotations.rightNipple ? "default" : "secondary"}>
              Right Nipple {annotations.rightNipple ? '✓' : '○'}
            </Badge>
            <Badge variant={annotations.nippleToNippleDistance ? "default" : "secondary"}>
              Distance {annotations.nippleToNippleDistance ? '✓' : '○'}
            </Badge>
          </div>

          <Separator />

          {/* Distance input */}
          {currentStep === 'distance' && (
            <MeasurementInput
              onDistanceSubmit={handleDistanceSubmit}
              currentDistance={annotations.nippleToNippleDistance}
            />
          )}

          {/* Control buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetAnnotations}
              className="flex-1"
            >
              Reset
            </Button>
            {currentStep === 'complete' && (
              <Button
                variant="default"
                size="sm"
                onClick={resetAnnotations}
                className="flex-1"
              >
                New Annotation
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};