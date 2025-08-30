import { useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { BreastContour } from '@/lib/manualMeasurements';

interface BreastContourToolProps {
  isActive: boolean;
  breastSide: 'left' | 'right';
  onContourComplete: (contour: BreastContour) => void;
  existingContour?: BreastContour | null;
}

export const BreastContourTool = ({ 
  isActive, 
  breastSide, 
  onContourComplete,
  existingContour 
}: BreastContourToolProps) => {
  const { camera, raycaster, scene } = useThree();
  const [vertices, setVertices] = useState<THREE.Vector3[]>(
    existingContour?.vertices || []
  );
  const [isDrawing, setIsDrawing] = useState(false);

  const handleClick = useCallback((event: MouseEvent) => {
    if (!isActive) return;

    // Calculate mouse position in normalized device coordinates
    const canvas = event.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    // Cast ray from camera
    raycaster.setFromCamera(mouse, camera);
    
    // Find intersection with the 3D model
    const meshes: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name !== 'BreastMarkers') {
        meshes.push(child);
      }
    });

    const intersects = raycaster.intersectObjects(meshes);
    
    if (intersects.length > 0) {
      const point = intersects[0].point.clone();
      
      if (event.ctrlKey && vertices.length > 0) {
        // Ctrl+click to finish contour
        finishContour();
      } else {
        // Add new vertex
        setVertices(prev => [...prev, point]);
        setIsDrawing(true);
      }
    }
  }, [isActive, vertices, camera, raycaster, scene]);

  const finishContour = useCallback(() => {
    if (vertices.length < 3) {
      console.warn('Need at least 3 vertices to create a contour');
      return;
    }

    // Calculate center and radius
    const center = new THREE.Vector3();
    vertices.forEach(v => center.add(v));
    center.divideScalar(vertices.length);

    const radius = vertices.reduce((max, vertex) => {
      return Math.max(max, vertex.distanceTo(center));
    }, 0);

    const contour: BreastContour = {
      id: breastSide,
      vertices: [...vertices],
      center,
      radius
    };

    onContourComplete(contour);
    setIsDrawing(false);
  }, [vertices, breastSide, onContourComplete]);

  const clearContour = useCallback(() => {
    setVertices([]);
    setIsDrawing(false);
  }, []);

  // Add event listeners
  useEffect(() => {
    if (!isActive) return;

    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    canvas.addEventListener('click', handleClick);
    
    return () => {
      canvas.removeEventListener('click', handleClick);
    };
  }, [isActive, handleClick]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isActive) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && vertices.length >= 3) {
        finishContour();
      } else if (event.key === 'Escape') {
        clearContour();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [isActive, vertices, finishContour, clearContour]);

  return null; // This is a tool component that doesn't render anything visible
};