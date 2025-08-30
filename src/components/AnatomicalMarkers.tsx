import { useRef } from 'react';
import * as THREE from 'three';
import { AnatomicalLandmarks } from '@/lib/anatomicalAnalysis';

interface AnatomicalMarkersProps {
  landmarks: AnatomicalLandmarks;
  showMarkers?: boolean;
}

export const AnatomicalMarkers = ({ landmarks, showMarkers = true }: AnatomicalMarkersProps) => {
  const markersRef = useRef<THREE.Group>(null);

  if (!showMarkers) return null;

  const MarkerSphere = ({ position, color, label }: { 
    position: THREE.Vector3; 
    color: string; 
    label: string;
  }) => (
    <mesh position={[position.x, position.y, position.z]}>
      <sphereGeometry args={[0.01, 8, 8]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );

  const BoundaryLine = ({ points, color }: { 
    points: THREE.Vector3[]; 
    color: string;
  }) => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    return (
      <primitive object={new THREE.Line(geometry, new THREE.LineBasicMaterial({ color }))} />
    );
  };

  return (
    <group ref={markersRef}>
      {/* Inframammary Fold Markers */}
      <MarkerSphere 
        position={landmarks.leftInframammaryFold} 
        color="#ff0000" 
        label="Left IMF" 
      />
      <MarkerSphere 
        position={landmarks.rightInframammaryFold} 
        color="#ff0000" 
        label="Right IMF" 
      />
      
      {/* Nipple Markers */}
      <MarkerSphere 
        position={landmarks.leftNipple} 
        color="#0000ff" 
        label="Left Nipple" 
      />
      <MarkerSphere 
        position={landmarks.rightNipple} 
        color="#0000ff" 
        label="Right Nipple" 
      />
      
      {/* Chest Wall Markers */}
      {landmarks.chestWall.map((point, index) => (
        <MarkerSphere 
          key={`chest-${index}`}
          position={point} 
          color="#00ff00" 
          label={`Chest Wall ${index}`} 
        />
      ))}
      
      {/* Breast Boundary Lines */}
      <BoundaryLine 
        points={landmarks.breastBoundaries.left} 
        color="#ffff00" 
      />
      <BoundaryLine 
        points={landmarks.breastBoundaries.right} 
        color="#ffff00" 
      />
    </group>
  );
};