import { useRef } from 'react';
import { Mesh } from 'three';
import * as THREE from 'three';

interface ImplantMeshProps {
  position: THREE.Vector3;
  side: 'left' | 'right';
  visible?: boolean;
}

// Fixed implant sizing based on real measurements
// If nipple-to-nipple is 21cm and implant circumference is 12cm:
// - Implant diameter = 12cm / π = ~3.8cm  
// - Making implant much smaller to be proportional to body
const IMPLANT_SPECS = {
  diameter: 0.038, // 3.8cm diameter - correctly sized 
  projection: 0.02, // 2cm projection - realistic
  volume: 300 // cc
};

export const ImplantMesh = ({ position, side, visible = true }: ImplantMeshProps) => {
  const meshRef = useRef<Mesh>(null);

  // Create implant geometry - much smaller, realistic size
  const implantGeometry = new THREE.SphereGeometry(
    IMPLANT_SPECS.diameter / 2, // radius - now correctly sized
    16, // width segments - reduced for performance
    12  // height segments - reduced for performance
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