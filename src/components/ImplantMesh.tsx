import { useRef } from 'react';
import { Mesh } from 'three';
import * as THREE from 'three';

interface ImplantMeshProps {
  position: THREE.Vector3;
  side: 'left' | 'right';
  visible?: boolean;
}

// Generic 300cc implant: 12cm diameter, 4cm projection (properly scaled for model)
const IMPLANT_SPECS = {
  diameter: 0.12, // 12cm - realistic size relative to human body
  projection: 0.04, // 4cm - realistic projection
  volume: 300 // cc
};

export const ImplantMesh = ({ position, side, visible = true }: ImplantMeshProps) => {
  const meshRef = useRef<Mesh>(null);

  // Create implant geometry - slightly flattened sphere for realistic shape
  const implantGeometry = new THREE.SphereGeometry(
    IMPLANT_SPECS.diameter / 2, // radius
    32, // width segments
    16  // height segments
  );

  // Flatten the bottom slightly and adjust projection
  const positionAttribute = implantGeometry.attributes.position;
  for (let i = 0; i < positionAttribute.count; i++) {
    const y = positionAttribute.getY(i);
    const z = positionAttribute.getZ(i);
    
    // Flatten bottom hemisphere
    if (y < 0) {
      positionAttribute.setY(i, y * 0.3);
    }
    
    // Adjust projection (z-depth)
    positionAttribute.setZ(i, z * (IMPLANT_SPECS.projection / (IMPLANT_SPECS.diameter / 2)));
  }
  
  positionAttribute.needsUpdate = true;
  implantGeometry.computeVertexNormals();

  return (
    <mesh
      ref={meshRef}
      position={[position.x, position.y, position.z]}
      geometry={implantGeometry}
      visible={visible}
    >
      <meshStandardMaterial
        color="#e6f3ff"
        transparent
        opacity={0.6}
        metalness={0.1}
        roughness={0.2}
      />
    </mesh>
  );
};