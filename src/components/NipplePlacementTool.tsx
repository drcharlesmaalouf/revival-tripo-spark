import { useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { NippleMarker } from '@/lib/manualMeasurements';

interface NipplePlacementToolProps {
  isActive: boolean;
  nippleSide: 'left' | 'right';
  onNipplePlaced: (nipple: NippleMarker) => void;
  existingNipple?: NippleMarker | null;
}

export const NipplePlacementTool = ({ 
  isActive, 
  nippleSide, 
  onNipplePlaced,
  existingNipple 
}: NipplePlacementToolProps) => {
  const { camera, raycaster, scene } = useThree();
  const [isPlacing, setIsPlacing] = useState(false);

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
      if (child instanceof THREE.Mesh && 
          child.name !== 'BreastMarkers' && 
          !child.name.includes('Contour') &&
          !child.name.includes('Nipple')) {
        meshes.push(child);
      }
    });

    const intersects = raycaster.intersectObjects(meshes);
    
    if (intersects.length > 0) {
      const point = intersects[0].point.clone();
      
      const nipple: NippleMarker = {
        position: point,
        id: nippleSide
      };

      onNipplePlaced(nipple);
      setIsPlacing(false);
      
      console.log(`${nippleSide} nipple placed at:`, point);
    }
  }, [isActive, nippleSide, onNipplePlaced, camera, raycaster, scene]);

  // Add event listeners
  useEffect(() => {
    if (!isActive) return;

    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    // Change cursor to indicate nipple placement mode
    canvas.style.cursor = 'crosshair';
    canvas.addEventListener('click', handleClick);
    
    return () => {
      canvas.style.cursor = 'default';
      canvas.removeEventListener('click', handleClick);
    };
  }, [isActive, handleClick]);

  return null; // This is a tool component that doesn't render anything visible
};