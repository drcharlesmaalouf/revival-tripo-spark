import { useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { BreastContour, NippleMarker } from '@/lib/manualMeasurements';

interface InteractiveToolsProps {
  mode: 'leftContour' | 'rightContour' | 'leftNipple' | 'rightNipple' | 'none';
  onContourComplete: (contour: BreastContour) => void;
  onNipplePlaced: (nipple: NippleMarker) => void;
}

export const InteractiveTools = ({ 
  mode, 
  onContourComplete,
  onNipplePlaced 
}: InteractiveToolsProps) => {
  const { camera, raycaster, scene } = useThree();
  const [vertices, setVertices] = useState<THREE.Vector3[]>([]);

  const handleClick = useCallback((event: MouseEvent) => {
    if (mode === 'none') return;

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
      if (child instanceof THREE.Mesh && 
          child.name !== 'BreastMarkers' && 
          child.name !== 'ManualAnnotations' &&
          !child.name.includes('Contour') &&
          !child.name.includes('Nipple')) {
        meshes.push(child);
      }
    });

    const intersects = raycaster.intersectObjects(meshes);
    
    if (intersects.length > 0) {
      const point = intersects[0].point.clone();
      
      if (mode === 'leftContour' || mode === 'rightContour') {
        // Contour mode
        if (event.ctrlKey && vertices.length >= 3) {
          // Ctrl+click to finish contour
          finishContour();
        } else {
          // Add new vertex
          setVertices(prev => [...prev, point]);
        }
      } else if (mode === 'leftNipple' || mode === 'rightNipple') {
        // Nipple placement mode
        const nipple: NippleMarker = {
          position: point,
          id: mode === 'leftNipple' ? 'left' : 'right'
        };
        onNipplePlaced(nipple);
        console.log(`${nipple.id} nipple placed at:`, point);
      }
    }
  }, [mode, vertices, camera, raycaster, scene, onNipplePlaced]);

  const finishContour = useCallback(() => {
    if (vertices.length < 3) {
      console.warn('Need at least 3 vertices to create a contour');
      return;
    }

    const breastSide = mode === 'leftContour' ? 'left' : 'right';

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
    setVertices([]);
  }, [vertices, mode, onContourComplete]);

  // Reset vertices when mode changes
  useEffect(() => {
    if (mode === 'leftContour' || mode === 'rightContour') {
      setVertices([]);
    }
  }, [mode]);

  // Add event listeners
  useEffect(() => {
    if (mode === 'none') return;

    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    // Set cursor style based on mode
    if (mode === 'leftNipple' || mode === 'rightNipple') {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = 'pointer';
    }

    canvas.addEventListener('click', handleClick);
    
    return () => {
      canvas.style.cursor = 'default';
      canvas.removeEventListener('click', handleClick);
    };
  }, [mode, handleClick]);

  // Keyboard shortcuts
  useEffect(() => {
    if (mode !== 'leftContour' && mode !== 'rightContour') return;

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && vertices.length >= 3) {
        finishContour();
      } else if (event.key === 'Escape') {
        setVertices([]);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [mode, vertices, finishContour]);

  return null; // This component doesn't render anything visible
};