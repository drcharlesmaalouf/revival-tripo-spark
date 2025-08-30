import * as THREE from 'three';
import { BreastLandmarks } from './breastDetection';
import { BreastRegion } from './meshAnalysis';

export interface AugmentationParameters {
  implantSize: number; // In cc (e.g., 300, 400, 500)
  implantType: 'round' | 'teardrop';
  projectionLevel: 'low' | 'moderate' | 'high';
  placementLevel: 'subglandular' | 'submuscular';
}

export class MeshManipulator {
  
  static simulateBreastAugmentation(
    originalMesh: THREE.Mesh,
    landmarks: BreastLandmarks,
    augmentationParams: AugmentationParameters
  ): THREE.Mesh {
    console.log('Starting breast augmentation simulation...');
    
    // Clone the original mesh
    const augmentedMesh = originalMesh.clone();
    const geometry = augmentedMesh.geometry.clone();
    const positions = geometry.attributes.position;
    
    // Calculate implant dimensions based on size
    const implantDimensions = this.calculateImplantDimensions(augmentationParams.implantSize);
    
    // Apply deformation to each breast region
    if (landmarks.leftBreastRegion && landmarks.leftNipple) {
      this.deformBreastRegion(
        positions,
        landmarks.leftBreastRegion,
        landmarks.leftNipple,
        implantDimensions,
        augmentationParams
      );
    }
    
    if (landmarks.rightBreastRegion && landmarks.rightNipple) {
      this.deformBreastRegion(
        positions,
        landmarks.rightBreastRegion,
        landmarks.rightNipple,
        implantDimensions,
        augmentationParams
      );
    }
    
    // Update geometry
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    
    augmentedMesh.geometry = geometry;
    
    console.log('Breast augmentation simulation complete');
    return augmentedMesh;
  }

  private static calculateImplantDimensions(sizeCC: number): {
    width: number;
    height: number; 
    projection: number;
  } {
    // Convert implant size from CC to approximate dimensions
    // These are rough approximations based on typical implant dimensions
    const baseRadius = Math.pow(sizeCC / 523.6, 1/3); // Sphere volume formula approximation
    
    return {
      width: baseRadius * 0.8,
      height: baseRadius * 0.9,
      projection: baseRadius * 0.6
    };
  }

  private static deformBreastRegion(
    positions: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
    breastRegion: BreastRegion,
    nipplePosition: THREE.Vector3,
    implantDimensions: { width: number; height: number; projection: number },
    augmentationParams: AugmentationParameters
  ): void {
    
    const projectionMultiplier = this.getProjectionMultiplier(augmentationParams.projectionLevel);
    const actualProjection = implantDimensions.projection * projectionMultiplier;
    
    // Create influence sphere around the breast region
    const influenceRadius = Math.max(implantDimensions.width, implantDimensions.height) * 1.2;
    
    breastRegion.vertices.forEach(vertex => {
      const distance = vertex.position.distanceTo(nipplePosition);
      
      if (distance < influenceRadius) {
        // Calculate influence factor (stronger closer to nipple)
        const influenceFactor = Math.pow(1 - (distance / influenceRadius), 2);
        
        // Calculate deformation vector
        const deformationVector = this.calculateDeformationVector(
          vertex.position,
          nipplePosition,
          implantDimensions,
          augmentationParams,
          influenceFactor
        );
        
        // Apply deformation
        const newPosition = vertex.position.clone().add(deformationVector);
        
        // Update position in buffer
        if (positions instanceof THREE.BufferAttribute) {
          positions.setXYZ(vertex.index, newPosition.x, newPosition.y, newPosition.z);
        }
      }
    });
  }

  private static getProjectionMultiplier(projectionLevel: string): number {
    switch (projectionLevel) {
      case 'low': return 0.7;
      case 'moderate': return 1.0;
      case 'high': return 1.3;
      default: return 1.0;
    }
  }

  private static calculateDeformationVector(
    vertexPosition: THREE.Vector3,
    nipplePosition: THREE.Vector3,
    implantDimensions: { width: number; height: number; projection: number },
    augmentationParams: AugmentationParameters,
    influenceFactor: number
  ): THREE.Vector3 {
    
    // Vector from vertex to nipple
    const toNipple = nipplePosition.clone().sub(vertexPosition);
    const distance = toNipple.length();
    
    if (distance === 0) {
      // At nipple position, push forward
      return new THREE.Vector3(0, 0, implantDimensions.projection * influenceFactor);
    }
    
    // Normalize direction
    const direction = toNipple.normalize();
    
    // Calculate radial and forward components
    let forwardDeformation = 0;
    let radialExpansion = 0;
    
    if (augmentationParams.implantType === 'round') {
      // Round implant - more uniform expansion
      forwardDeformation = implantDimensions.projection * influenceFactor * 0.8;
      radialExpansion = implantDimensions.width * influenceFactor * 0.3;
    } else {
      // Teardrop implant - more projection at bottom
      const verticalFactor = Math.max(0, -direction.y); // Lower = more projection
      forwardDeformation = implantDimensions.projection * influenceFactor * (0.5 + verticalFactor * 0.5);
      radialExpansion = implantDimensions.width * influenceFactor * 0.25;
    }
    
    // Combine forward push and radial expansion
    const forwardVector = new THREE.Vector3(0, 0, forwardDeformation);
    const radialVector = direction.clone().multiplyScalar(-radialExpansion);
    radialVector.z = 0; // Keep radial expansion in XY plane
    
    return forwardVector.add(radialVector);
  }

  static createImplantVisualization(
    nipplePosition: THREE.Vector3,
    implantSize: number,
    implantType: 'round' | 'teardrop'
  ): THREE.Mesh {
    
    const dimensions = this.calculateImplantDimensions(implantSize);
    let geometry: THREE.BufferGeometry;
    
    if (implantType === 'round') {
      geometry = new THREE.SphereGeometry(dimensions.width * 0.5, 16, 16);
    } else {
      // Teardrop - use a modified sphere
      geometry = new THREE.SphereGeometry(dimensions.width * 0.5, 16, 16);
      // Could be enhanced with custom teardrop geometry
    }
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    
    const implantMesh = new THREE.Mesh(geometry, material);
    
    // Position slightly behind nipple
    const implantPosition = nipplePosition.clone();
    implantPosition.z -= dimensions.projection * 0.3;
    implantMesh.position.copy(implantPosition);
    
    return implantMesh;
  }
}