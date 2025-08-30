import { useState, useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { BreastContour, NippleMarker } from '@/lib/manualMeasurements';

interface InteractiveToolsProps {
  mode: 'leftContour' | 'rightContour' | 'leftNipple' | 'rightNipple' | 'none';
  onContourComplete: (contour: BreastContour) => void;
  onNipplePlaced: (nipple: NippleMarker) => void;
}

interface ContourPoint {
  position: THREE.Vector3;
  mesh: THREE.Mesh;
  isDragging: boolean;
}

export const InteractiveTools = ({ 
  mode, 
  onContourComplete,
  onNipplePlaced 
}: InteractiveToolsProps) => {
  const { camera, raycaster, scene, gl, controls } = useThree();
  const [contourPoints, setContourPoints] = useState<ContourPoint[]>([]);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    pointIndex: number | null;
    offset: THREE.Vector3;
  }>({ isDragging: false, pointIndex: null, offset: new THREE.Vector3() });
  
  const contourGroupRef = useRef<THREE.Group>(null);
  const mouseRef = useRef(new THREE.Vector2());

  // Create initial circle when entering contour mode
  useEffect(() => {
    if (mode === 'leftContour' || mode === 'rightContour') {
      createInitialContour();
    } else {
      clearContour();
    }
  }, [mode]);

  const createInitialContour = useCallback(() => {
    // Find the center of the 3D model to position the initial circle
    const modelCenter = new THREE.Vector3(0, 0, 0);
    const radius = 0.15; // Adjust based on your model scale
    
    // Create 5 points in a circle
    const points: ContourPoint[] = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const x = modelCenter.x + Math.cos(angle) * radius;
      const y = modelCenter.y + Math.sin(angle) * radius * 0.7; // Slightly elliptical
      const z = modelCenter.z + 0.1; // Slightly forward
      
      const position = new THREE.Vector3(x, y, z);
      
      // Create visible handle (much smaller)
      const handleGeometry = new THREE.SphereGeometry(0.008, 12, 12); // Reduced from 0.02 to 0.008
      const handleMaterial = new THREE.MeshStandardMaterial({ 
        color: mode === 'leftContour' ? 0xff69b4 : 0x4169e1,
        transparent: true,
        opacity: 0.9,
        emissive: 0x000000
      });
      const handleMesh = new THREE.Mesh(handleGeometry, handleMaterial);
      handleMesh.position.copy(position);
      handleMesh.name = `contour-handle-${i}`;
      
      scene.add(handleMesh);
      
      points.push({
        position: position.clone(),
        mesh: handleMesh,
        isDragging: false
      });
    }
    
    setContourPoints(points);
    updateContourVisualization(points);
  }, [mode, scene]);

  const updateContourVisualization = useCallback((points: ContourPoint[]) => {
    // Remove existing contour line
    const existingLine = scene.getObjectByName('contour-line');
    if (existingLine) {
      scene.remove(existingLine);
    }

    if (points.length < 3) return;

    // Create line connecting all points
    const linePoints = [...points.map(p => p.position), points[0].position]; // Close the loop
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: mode === 'leftContour' ? 0xff69b4 : 0x4169e1,
      linewidth: 3,
      transparent: true,
      opacity: 0.6
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.name = 'contour-line';
    scene.add(line);
  }, [scene, mode]);

  const clearContour = useCallback(() => {
    // Remove all handles and lines
    contourPoints.forEach(point => {
      scene.remove(point.mesh);
    });
    
    const existingLine = scene.getObjectByName('contour-line');
    if (existingLine) {
      scene.remove(existingLine);
    }
    
    setContourPoints([]);
  }, [contourPoints, scene]);

  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (mode !== 'leftContour' && mode !== 'rightContour') {
      // Handle nipple placement
      if (mode === 'leftNipple' || mode === 'rightNipple') {
        handleNipplePlacement(event);
      }
      return;
    }

    // Calculate mouse position
    const canvas = event.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    // Check if clicking on a handle
    raycaster.setFromCamera(mouseRef.current, camera);
    const handleMeshes = contourPoints.map(p => p.mesh);
    const intersects = raycaster.intersectObjects(handleMeshes);

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object as THREE.Mesh;
      const pointIndex = contourPoints.findIndex(p => p.mesh === clickedMesh);
      
      if (pointIndex !== -1) {
        // COMPLETELY disable OrbitControls during dragging
        if (controls && 'enabled' in controls) {
          (controls as any).enabled = false;
        }
        
        setDragState({
          isDragging: true,
          pointIndex,
          offset: new THREE.Vector3()
        });
        
        // Change handle appearance (make brighter and slightly larger)
        const material = clickedMesh.material as THREE.MeshStandardMaterial;
        material.opacity = 1.0;
        material.emissive.setHex(0x444444); // Add glow effect
        clickedMesh.scale.setScalar(1.5); // Make slightly larger when dragging
        
        // Prevent any event bubbling
        event.stopPropagation();
        event.preventDefault();
      }
    }
  }, [mode, contourPoints, camera, raycaster, controls]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!dragState.isDragging || dragState.pointIndex === null) return;

    const canvas = event.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    // Cast ray to find new position on the model
    raycaster.setFromCamera(mouseRef.current, camera);
    
    // Find intersection with the 3D model
    const meshes: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && 
          !child.name.includes('contour') && 
          !child.name.includes('Nipple') &&
          child.name !== 'BreastMarkers' && 
          child.name !== 'ManualAnnotations') {
        meshes.push(child);
      }
    });

    const intersects = raycaster.intersectObjects(meshes);
    
    if (intersects.length > 0) {
      const newPosition = intersects[0].point.clone();
      
      // Update the point position
      setContourPoints(prev => {
        const updated = [...prev];
        updated[dragState.pointIndex!].position.copy(newPosition);
        updated[dragState.pointIndex!].mesh.position.copy(newPosition);
        return updated;
      });
      
      // Update visualization in real-time
      updateContourVisualization(contourPoints);
    }
  }, [dragState, camera, raycaster, scene, contourPoints, updateContourVisualization]);

  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging && dragState.pointIndex !== null) {
      // Reset handle appearance
      const handle = contourPoints[dragState.pointIndex].mesh;
      const material = handle.material as THREE.MeshStandardMaterial;
      material.opacity = 0.9;
      material.emissive.setHex(0x000000); // Remove glow
      handle.scale.setScalar(1.0); // Reset size
      
      // Re-enable OrbitControls
      if (controls && 'enabled' in controls) {
        (controls as any).enabled = true;
      }
    }
    
    setDragState({ isDragging: false, pointIndex: null, offset: new THREE.Vector3() });
  }, [dragState, contourPoints, controls]);

  const handleNipplePlacement = useCallback((event: MouseEvent) => {
    const canvas = event.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.setFromCamera(mouse, camera);
    
    const meshes: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && 
          !child.name.includes('contour') && 
          !child.name.includes('Nipple') &&
          child.name !== 'BreastMarkers' && 
          child.name !== 'ManualAnnotations') {
        meshes.push(child);
      }
    });

    const intersects = raycaster.intersectObjects(meshes);
    
    if (intersects.length > 0) {
      const point = intersects[0].point.clone();
      
      const nipple: NippleMarker = {
        position: point,
        id: mode === 'leftNipple' ? 'left' : 'right'
      };

      onNipplePlaced(nipple);
    }
  }, [mode, camera, raycaster, scene, onNipplePlaced]);

  const finishContour = useCallback(() => {
    if (contourPoints.length < 3) return;

    const breastSide = mode === 'leftContour' ? 'left' : 'right';
    const vertices = contourPoints.map(p => p.position.clone());

    // Calculate center and radius
    const center = new THREE.Vector3();
    vertices.forEach(v => center.add(v));
    center.divideScalar(vertices.length);

    const radius = vertices.reduce((max, vertex) => {
      return Math.max(max, vertex.distanceTo(center));
    }, 0);

    const contour: BreastContour = {
      id: breastSide,
      vertices,
      center,
      radius
    };

    onContourComplete(contour);
    clearContour();
  }, [contourPoints, mode, onContourComplete, clearContour]);

  // Simplified event listeners 
  useEffect(() => {
    const canvas = gl.domElement;
    
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, gl]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if ((mode === 'leftContour' || mode === 'rightContour') && event.key === 'Enter') {
        finishContour();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [mode, finishContour]);

  return null;
};