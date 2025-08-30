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
    // Find the actual model dimensions to size the contour appropriately
    const modelBounds = new THREE.Box3();
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && 
          !child.name.includes('contour') && 
          !child.name.includes('Nipple') &&
          child.name !== 'BreastMarkers' && 
          child.name !== 'ManualAnnotations') {
        modelBounds.expandByObject(child);
      }
    });
    
    const modelSize = modelBounds.getSize(new THREE.Vector3());
    const modelCenter = modelBounds.getCenter(new THREE.Vector3());
    
    // Calculate breast-appropriate sizing
    const breastRadius = Math.min(modelSize.x, modelSize.y) * 0.15; // 15% of model size
    const pointSize = breastRadius * 0.05; // Points are 5% of breast radius
    
    // Position based on which breast we're contouring
    const xOffset = mode === 'leftContour' ? -modelSize.x * 0.15 : modelSize.x * 0.15;
    const breastCenter = new THREE.Vector3(
      modelCenter.x + xOffset,
      modelCenter.y + modelSize.y * 0.1, // Slightly above center
      modelCenter.z + modelSize.z * 0.3  // Forward on the chest
    );
    
    // Create 4 points in an ellipse (more natural breast shape)
    const points: ContourPoint[] = [];
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const x = breastCenter.x + Math.cos(angle) * breastRadius;
      const y = breastCenter.y + Math.sin(angle) * breastRadius * 0.8; // Elliptical
      const z = breastCenter.z;
      
      const position = new THREE.Vector3(x, y, z);
      
      // Create tiny, visible handle
      const handleGeometry = new THREE.SphereGeometry(pointSize, 8, 8);
      const handleMaterial = new THREE.MeshStandardMaterial({ 
        color: mode === 'leftContour' ? 0xff1493 : 0x1e90ff, // Deep pink vs deep blue
        transparent: true,
        opacity: 0.8,
        emissive: 0x000000,
        metalness: 0.1,
        roughness: 0.3
      });
      const handleMesh = new THREE.Mesh(handleGeometry, handleMaterial);
      handleMesh.position.copy(position);
      handleMesh.name = `contour-handle-${i}`;
      
      // Make handles always visible on top
      handleMesh.renderOrder = 999;
      handleMesh.material.depthTest = false;
      
      scene.add(handleMesh);
      
      points.push({
        position: position.clone(),
        mesh: handleMesh,
        isDragging: false
      });
    }
    
    setContourPoints(points);
    updateContourVisualization(points);
    
    console.log(`Created ${mode} contour with ${points.length} points, size: ${pointSize.toFixed(4)}`);
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
        console.log('Starting drag of point', pointIndex);
        
        // COMPLETELY disable OrbitControls during dragging
        if (controls && 'enabled' in controls) {
          (controls as any).enabled = false;
          console.log('OrbitControls disabled');
        }
        
        // Disable all pointer events on canvas for camera controls
        const canvas = gl.domElement;
        canvas.style.pointerEvents = 'none';
        setTimeout(() => canvas.style.pointerEvents = 'auto', 10);
        
        setDragState({
          isDragging: true,
          pointIndex,
          offset: new THREE.Vector3()
        });
        
        // Visual feedback - make point brighter and slightly larger
        const material = clickedMesh.material as THREE.MeshStandardMaterial;
        material.opacity = 1.0;
        material.emissive.setHex(0x666666);
        clickedMesh.scale.setScalar(2.0); // Double size when dragging
        
        // Stop all event propagation
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    }
  }, [mode, contourPoints, camera, raycaster, controls, gl]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!dragState.isDragging || dragState.pointIndex === null) return;

    // Prevent any camera movement
    event.stopImmediatePropagation();
    event.preventDefault();

    const canvas = event.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.setFromCamera(mouseRef.current, camera);
    
    // Find intersection with the 3D model (excluding our own handles)
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
      
      // Update the point position immediately
      const updatedPoints = [...contourPoints];
      updatedPoints[dragState.pointIndex].position.copy(newPosition);
      updatedPoints[dragState.pointIndex].mesh.position.copy(newPosition);
      setContourPoints(updatedPoints);
      
      // Update visualization line
      updateContourVisualization(updatedPoints);
    }
  }, [dragState, camera, raycaster, scene, contourPoints, updateContourVisualization]);

  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging && dragState.pointIndex !== null) {
      console.log('Ending drag of point', dragState.pointIndex);
      
      // Reset handle appearance
      const handle = contourPoints[dragState.pointIndex].mesh;
      const material = handle.material as THREE.MeshStandardMaterial;
      material.opacity = 0.8;
      material.emissive.setHex(0x000000);
      handle.scale.setScalar(1.0);
      
      // Re-enable OrbitControls
      if (controls && 'enabled' in controls) {
        (controls as any).enabled = true;
        console.log('OrbitControls re-enabled');
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

  // High-priority event listeners to prevent camera movement
  useEffect(() => {
    const canvas = gl.domElement;
    
    const handleMouseDownCapture = (e: MouseEvent) => {
      if (dragState.isDragging) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
      handleMouseDown(e);
    };
    
    const handleMouseMoveCapture = (e: MouseEvent) => {
      if (dragState.isDragging) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
      handleMouseMove(e);
    };
    
    const handleMouseUpCapture = (e: MouseEvent) => {
      if (dragState.isDragging) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
      handleMouseUp();
    };
    
    // Use capture phase to intercept events before OrbitControls
    canvas.addEventListener('mousedown', handleMouseDownCapture, { capture: true, passive: false });
    canvas.addEventListener('mousemove', handleMouseMoveCapture, { capture: true, passive: false });
    canvas.addEventListener('mouseup', handleMouseUpCapture, { capture: true, passive: false });
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDownCapture, { capture: true });
      canvas.removeEventListener('mousemove', handleMouseMoveCapture, { capture: true });
      canvas.removeEventListener('mouseup', handleMouseUpCapture, { capture: true });
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, gl, dragState.isDragging]);

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