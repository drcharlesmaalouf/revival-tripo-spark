import { useState, useEffect } from 'react';
import * as THREE from 'three';
import { MeshAnalyzer } from '@/lib/meshAnalysis';
import { BreastDetector, BreastLandmarks } from '@/lib/breastDetection';
import { MeshManipulator, AugmentationParameters } from '@/lib/meshManipulation';
import { useToast } from '@/hooks/use-toast';

interface MeshAnalyzerProps {
  scene: THREE.Group | null;
  onAnalysisComplete: (results: {
    originalMesh: THREE.Mesh;
    landmarks: BreastLandmarks;
    visualizationMesh: THREE.Mesh;
    augmentedMesh?: THREE.Mesh;
  }) => void;
  augmentationParams?: AugmentationParameters;
}

export const MeshAnalyzerComponent = ({ 
  scene, 
  onAnalysisComplete,
  augmentationParams
}: MeshAnalyzerProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!scene || isAnalyzing) return;

    const analyzeScene = async () => {
      setIsAnalyzing(true);
      
      try {
        console.log('Starting mesh analysis...');
        
        // Extract main mesh from scene
        const mainMesh = MeshAnalyzer.extractMeshData(scene);
        if (!mainMesh) {
          throw new Error('No mesh found in scene');
        }

        console.log('Found main mesh, analyzing geometry...');
        
        // Analyze mesh geometry
        const vertices = MeshAnalyzer.analyzeMeshGeometry(mainMesh);
        console.log(`Analyzed ${vertices.length} vertices`);
        
        // Calculate curvature map (now async)
        const curvatureMap = await MeshAnalyzer.createCurvatureMap(vertices, mainMesh.geometry);
        console.log('Curvature analysis complete');
        
        // Detect breast regions
        const landmarks = BreastDetector.detectBreastRegions(vertices, curvatureMap, mainMesh);
        console.log('Breast detection complete');
        
        // Create visualization mesh
        const visualizationMesh = BreastDetector.createVisualizationMesh(mainMesh, landmarks);
        
        // Create augmented mesh if parameters provided
        let augmentedMesh: THREE.Mesh | undefined;
        if (augmentationParams && landmarks.leftNipple && landmarks.rightNipple) {
          console.log('Creating augmented mesh...');
          augmentedMesh = MeshManipulator.simulateBreastAugmentation(
            mainMesh,
            landmarks,
            augmentationParams
          );
        }
        
        // Return results
        onAnalysisComplete({
          originalMesh: mainMesh,
          landmarks,
          visualizationMesh,
          augmentedMesh
        });
        
        toast({
          title: "Analysis Complete",
          description: `Detected breast regions with ${landmarks.leftBreastRegion?.vertices.length || 0} left and ${landmarks.rightBreastRegion?.vertices.length || 0} right vertices`,
        });
        
      } catch (error) {
        console.error('Mesh analysis failed:', error);
        toast({
          variant: "destructive",
          title: "Analysis Failed",
          description: error instanceof Error ? error.message : "Failed to analyze mesh geometry",
        });
      } finally {
        setIsAnalyzing(false);
      }
    };

    analyzeScene();
  }, [scene, augmentationParams, onAnalysisComplete, toast]);

  // This component doesn't render anything visible
  return null;
};