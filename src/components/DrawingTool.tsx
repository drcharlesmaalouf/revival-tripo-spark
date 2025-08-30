import { useState, useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { BreastContour, NippleMarker } from '@/lib/manualMeasurements';

type DrawingMode = 'leftContour' | 'rightContour' | 'leftNipple' | 'rightNipple' | 'none';

interface DrawingToolProps {
  mode: DrawingMode;
  onContourComplete: (contour: BreastContour) => void;
  onNipplePlaced: (nipple: NippleMarker) => void;
}

interface DrawnPath {
  points: THREE.Vector3[];
  line: THREE.Line | null;
}

export const DrawingTool = ({ 
  mode, 
  onContourComplete,
  onNipplePlaced 
}: DrawingToolProps) => {
  const { camera, raycaster, scene, gl, controls } = useThree();
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<DrawnPath>({ points: [], line: null });
  const mouseRef = useRef(new THREE.Vector2());

  // Clear any existing drawings when mode changes
  useEffect(() => {
    clearCurrentDrawing();
  }, [mode]);

  const clearCurrentDrawing = useCallback(() => {
    if (currentPath.line) {
      scene.remove(currentPath.line);
    }
    setCurrentPath({ points: [], line: null });
  }, [currentPath.line, scene]);

  const getDrawingColor = useCallback(() => {
    switch (mode) {
      case 'leftContour': return 0xff1493; // Deep pink
      case 'rightContour': return 0x1e90ff; // Deep blue
      case 'leftNipple': return 0xff69b4; // Hot pink
      case 'rightNipple': return 0x4169e1; // Royal blue
      default: return 0x888888;
    }
  }, [mode]);

  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (mode === 'none') return;

    // Prevent default behavior and stop propagation
    event.preventDefault();
    event.stopPropagation();

    // Disable camera controls immediately for any drawing mode
    if (controls && 'enabled' in controls) {
      (controls as any).enabled = false;
    }

    // Calculate mouse position
    const canvas = event.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    // Cast ray to find intersection with 3D model
    raycaster.setFromCamera(mouseRef.current, camera);
    
    const meshes: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && 
          !child.name.includes('contour') && 
          !child.name.includes('nipple') &&
          !child.name.includes('drawing') &&
          child.name !== 'BreastMarkers' && 
          child.name !== 'ManualAnnotations') {
        meshes.push(child);
      }
    });

    const intersects = raycaster.intersectObjects(meshes);
    
    if (intersects.length > 0) {
      const point = intersects[0].point.clone();
      
      if (mode === 'leftNipple' || mode === 'rightNipple') {
        // Place nipple marker
        const nipple: NippleMarker = {
          position: point,
          id: mode === 'leftNipple' ? 'left' : 'right'
        };
        onNipplePlaced(nipple);
        
        // Create visual marker
        const markerGeometry = new THREE.SphereGeometry(0.003, 16, 16);
        const markerMaterial = new THREE.MeshStandardMaterial({ 
          color: getDrawingColor(),
          emissive: getDrawingColor(),
          emissiveIntensity: 0.3
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.copy(point);
        marker.name = `nipple-marker-${mode}`;
        marker.renderOrder = 1000;
        scene.add(marker);
        
        console.log(`${nipple.id} nipple placed at:`, point);
        
        // Re-enable controls after nipple placement
        if (controls && 'enabled' in controls) {
          (controls as any).enabled = true;
        }
      } else if (mode === 'leftContour' || mode === 'rightContour') {
        // Start drawing contour
        setIsDrawing(true);
        
        // Clear any existing path
        clearCurrentDrawing();
        
        // Start new path
        setCurrentPath({ points: [point], line: null });
        
        console.log(`Starting ${mode} contour drawing`);
      }
    }
  }, [mode, camera, raycaster, scene, controls, onNipplePlaced, getDrawingColor, clearCurrentDrawing]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDrawing || (mode !== 'leftContour' && mode !== 'rightContour')) return;

    // Calculate mouse position
    const canvas = event.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    // Cast ray to find intersection
    raycaster.setFromCamera(mouseRef.current, camera);
    
    const meshes: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && 
          !child.name.includes('contour') && 
          !child.name.includes('nipple') &&
          !child.name.includes('drawing') &&
          child.name !== 'BreastMarkers' && 
          child.name !== 'ManualAnnotations') {
        meshes.push(child);
      }
    });

    const intersects = raycaster.intersectObjects(meshes);
    
    if (intersects.length > 0) {
      const point = intersects[0].point.clone();
      
      // Add point to current path if it's far enough from the last point
      const lastPoint = currentPath.points[currentPath.points.length - 1];
      if (!lastPoint || point.distanceTo(lastPoint) > 0.002) {
        const newPoints = [...currentPath.points, point];
        
        // Remove old line
        if (currentPath.line) {
          scene.remove(currentPath.line);
        }
        
        // Create new line with updated points
        if (newPoints.length > 1) {
          const lineGeometry = new THREE.BufferGeometry().setFromPoints(newPoints);
          const lineMaterial = new THREE.LineBasicMaterial({ 
            color: getDrawingColor(),
            linewidth: 3,
            transparent: true,
            opacity: 0.8
          });
          const line = new THREE.Line(lineGeometry, lineMaterial);
          line.name = `drawing-${mode}`;
          line.renderOrder = 999;
          scene.add(line);
          
          setCurrentPath({ points: newPoints, line });
        } else {
          setCurrentPath({ points: newPoints, line: null });
        }
      }
    }
  }, [isDrawing, mode, camera, raycaster, scene, currentPath, getDrawingColor]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    
    // Re-enable camera controls
    if (controls && 'enabled' in controls) {
      (controls as any).enabled = true;
    }
    
    // Complete the contour if we have enough points
    if (currentPath.points.length >= 3 && (mode === 'leftContour' || mode === 'rightContour')) {
      const breastSide = mode === 'leftContour' ? 'left' : 'right';
      
      // Calculate center and radius from drawn path
      const center = new THREE.Vector3();
      currentPath.points.forEach(p => center.add(p));
      center.divideScalar(currentPath.points.length);
      
      const radius = currentPath.points.reduce((max, point) => {
        return Math.max(max, point.distanceTo(center));
      }, 0);
      
      const contour: BreastContour = {
        id: breastSide,
        vertices: [...currentPath.points],
        center,
        radius
      };
      
      onContourComplete(contour);
      console.log(`${breastSide} contour completed with ${currentPath.points.length} points`);
    }
  }, [isDrawing, controls, currentPath, mode, onContourComplete]);

  // Event listeners
  useEffect(() => {
    const canvas = gl.domElement;
    
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    
    // Set cursor based on mode
    if (mode !== 'none') {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = 'default';
    }
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.style.cursor = 'default';
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, gl, mode]);

  return null;
};