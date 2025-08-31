import * as THREE from 'three';
import { BreastContour, NippleMarker, CalculatedMeasurements } from './manualMeasurements';

export interface AugmentationParameters {
  // Size and projection
  sizeMultiplier: number; // 0.5 to 3.0
  projectionMultiplier: number; // 0.5 to 2.5
  
  // Shape characteristics
  upperPoleFullness: number; // 0.5 to 1.5
  lowerPoleFullness: number; // 0.5 to 1.5
  
  // Position adjustments
  heightAdjustment: number; // -0.2 to 0.2
  medialAdjustment: number; // -0.2 to 0.2
  
  // Implant characteristics
  implantType: 'round' | 'teardrop' | 'gummy';
  implantProfile: 'low' | 'moderate' | 'high' | 'ultra-high';
}

export interface AugmentationResult {
  originalVolume: number;
  augmentedVolume: number;
  volumeIncrease: number;
  newCupSize: string;
  projectionIncrease: number;
}

export class BreastAugmentationSimulator {
  
  /**
   * Calculate the expected results of breast augmentation
   */
  static calculateAugmentationResults(
    measurements: CalculatedMeasurements,
    params: AugmentationParameters,
    side: 'left' | 'right'
  ): AugmentationResult {
    
    const diameter = side === 'left' ? measurements.leftBreastDiameter : measurements.rightBreastDiameter;
    const projection = side === 'left' ? measurements.projectionLeft : measurements.projectionRight;
    
    // Calculate original volume using ellipsoid approximation
    const originalRadius = diameter / 2;
    const originalVolume = (4/3) * Math.PI * originalRadius * originalRadius * projection;
    
    // Calculate augmented dimensions
    const newRadius = originalRadius * params.sizeMultiplier;
    const newProjection = projection * params.projectionMultiplier;
    const shapeMultiplier = (params.upperPoleFullness + params.lowerPoleFullness) / 2;
    
    // Calculate augmented volume
    const augmentedVolume = (4/3) * Math.PI * newRadius * newRadius * newProjection * shapeMultiplier;
    
    const volumeIncrease = augmentedVolume - originalVolume;
    const projectionIncrease = newProjection - projection;
    const newCupSize = this.calculateCupSize(augmentedVolume);
    
    return {
      originalVolume: Math.round(originalVolume),
      augmentedVolume: Math.round(augmentedVolume),
      volumeIncrease: Math.round(volumeIncrease),
      newCupSize,
      projectionIncrease: Math.round(projectionIncrease * 10) / 10
    };
  }
  
  /**
   * Create a visual representation of the augmented breast
   */
  static createAugmentedBreastMesh(
    contour: BreastContour,
    nipple: NippleMarker,
    params: AugmentationParameters,
    side: 'left' | 'right'
  ): THREE.Mesh {
    
    // Base geometry from contour
    let geometry: THREE.BufferGeometry;
    
    if (params.implantType === 'round') {
      geometry = new THREE.SphereGeometry(contour.radius * params.sizeMultiplier, 20, 16);
    } else if (params.implantType === 'teardrop') {
      geometry = this.createTeardropGeometry(contour.radius * params.sizeMultiplier, params);
    } else {
      geometry = this.createGummyBearGeometry(contour.radius * params.sizeMultiplier, params);
    }
    
    // Apply shape modifications
    this.applyShapeModifications(geometry, params);
    
    // Create material based on implant profile
    const material = this.createBreastMaterial(params.implantProfile, side);
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position the mesh
    const position = contour.center.clone();
    position.y += params.heightAdjustment * 0.1;
    position.x += params.medialAdjustment * 0.1 * (side === 'left' ? 1 : -1);
    position.z += (params.projectionMultiplier - 1) * 0.05;
    
    mesh.position.copy(position);
    mesh.name = `${side}-augmented-breast`;
    
    return mesh;
  }
  
  /**
   * Create implant visualization mesh
   */
  static createImplantVisualization(
    nipple: NippleMarker,
    params: AugmentationParameters,
    side: 'left' | 'right'
  ): THREE.Mesh {
    
    const baseSize = 0.04; // Base implant size
    const scaledSize = baseSize * params.sizeMultiplier;
    
    let geometry: THREE.BufferGeometry;
    
    switch (params.implantType) {
      case 'round':
        geometry = new THREE.SphereGeometry(scaledSize, 16, 12);
        break;
      case 'teardrop':
        geometry = this.createTeardropImplantGeometry(scaledSize);
        break;
      case 'gummy':
        geometry = this.createGummyBearImplantGeometry(scaledSize);
        break;
    }
    
    // Apply profile-specific modifications
    this.applyProfileModifications(geometry, params.implantProfile);
    
    const material = new THREE.MeshStandardMaterial({
      color: 0xe6f3ff,
      transparent: true,
      opacity: 0.5,
      metalness: 0.1,
      roughness: 0.2,
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position behind nipple
    const position = nipple.position.clone();
    position.z -= 0.03;
    position.y += params.heightAdjustment * 0.1;
    position.x += params.medialAdjustment * 0.1 * (side === 'left' ? 1 : -1);
    
    mesh.position.copy(position);
    mesh.name = `${side}-implant-visualization`;
    
    return mesh;
  }
  
  private static createTeardropGeometry(radius: number, params: AugmentationParameters): THREE.BufferGeometry {
    const geometry = new THREE.SphereGeometry(radius, 20, 16);
    const positions = geometry.attributes.position;
    
    // Modify to create teardrop shape
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      // More fullness in lower pole
      if (y < 0) {
        const factor = 1 + (params.lowerPoleFullness - 1) * Math.abs(y) / radius;
        positions.setY(i, y * factor);
        positions.setZ(i, z * factor);
      }
      
      // Less fullness in upper pole
      if (y > 0) {
        const factor = 1 + (params.upperPoleFullness - 1) * y / radius;
        positions.setY(i, y * factor);
      }
    }
    
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }
  
  private static createGummyBearGeometry(radius: number, params: AugmentationParameters): THREE.BufferGeometry {
    const geometry = new THREE.SphereGeometry(radius, 20, 16);
    const positions = geometry.attributes.position;
    
    // Gummy bear implants have more stable shape
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      // More anatomical shaping
      const distanceFromCenter = Math.sqrt(x*x + y*y);
      const shapeFactor = 1 - (distanceFromCenter / radius) * 0.2;
      
      positions.setZ(i, z * shapeFactor * params.projectionMultiplier);
    }
    
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }
  
  private static createTeardropImplantGeometry(size: number): THREE.BufferGeometry {
    const geometry = new THREE.SphereGeometry(size, 16, 12);
    const positions = geometry.attributes.position;
    
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      
      // Teardrop shape - more volume in lower portion
      if (y < 0) {
        positions.setY(i, y * 1.3);
      } else {
        positions.setY(i, y * 0.8);
      }
    }
    
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }
  
  private static createGummyBearImplantGeometry(size: number): THREE.BufferGeometry {
    const geometry = new THREE.SphereGeometry(size, 16, 12);
    const positions = geometry.attributes.position;
    
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      // Gummy bear shape - anatomical form
      if (y < 0) {
        positions.setY(i, y * 1.2);
        positions.setZ(i, z * 1.1);
      }
    }
    
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }
  
  private static applyShapeModifications(geometry: THREE.BufferGeometry, params: AugmentationParameters): void {
    const positions = geometry.attributes.position;
    
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      // Apply upper and lower pole adjustments
      if (y > 0) {
        positions.setY(i, y * params.upperPoleFullness);
      } else {
        positions.setY(i, y * params.lowerPoleFullness);
      }
      
      // Apply projection
      positions.setZ(i, z * params.projectionMultiplier);
    }
    
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  }
  
  private static applyProfileModifications(geometry: THREE.BufferGeometry, profile: string): void {
    const positions = geometry.attributes.position;
    let profileMultiplier = 1.0;
    
    switch (profile) {
      case 'low':
        profileMultiplier = 0.8;
        break;
      case 'moderate':
        profileMultiplier = 1.0;
        break;
      case 'high':
        profileMultiplier = 1.3;
        break;
      case 'ultra-high':
        profileMultiplier = 1.6;
        break;
    }
    
    for (let i = 0; i < positions.count; i++) {
      const z = positions.getZ(i);
      positions.setZ(i, z * profileMultiplier);
    }
    
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  }
  
  private static createBreastMaterial(profile: string, side: 'left' | 'right'): THREE.Material {
    const baseColor = side === 'left' ? 0xff69b4 : 0x4169e1;
    
    let opacity = 0.6;
    let metalness = 0.1;
    let roughness = 0.3;
    
    // Adjust material properties based on profile
    switch (profile) {
      case 'low':
        opacity = 0.5;
        roughness = 0.4;
        break;
      case 'high':
      case 'ultra-high':
        opacity = 0.7;
        metalness = 0.2;
        roughness = 0.2;
        break;
    }
    
    return new THREE.MeshStandardMaterial({
      color: baseColor,
      transparent: true,
      opacity,
      metalness,
      roughness,
      side: THREE.DoubleSide
    });
  }
  
  private static calculateCupSize(volume: number): string {
    if (volume < 150) return 'A';
    if (volume < 250) return 'B';
    if (volume < 350) return 'C';
    if (volume < 450) return 'D';
    if (volume < 550) return 'DD';
    if (volume < 650) return 'E';
    if (volume < 750) return 'F';
    if (volume < 850) return 'G';
    return 'H+';
  }
  
  /**
   * Generate surgical planning report
   */
  static generateSurgicalReport(
    measurements: CalculatedMeasurements,
    leftParams: AugmentationParameters,
    rightParams: AugmentationParameters
  ): string {
    const leftResult = this.calculateAugmentationResults(measurements, leftParams, 'left');
    const rightResult = this.calculateAugmentationResults(measurements, rightParams, 'right');
    
    return `
BREAST AUGMENTATION SIMULATION REPORT
=====================================

PATIENT MEASUREMENTS:
- Nipple-to-nipple distance: ${measurements.nippleToNippleDistance.toFixed(1)} cm
- Current symmetry ratio: ${measurements.symmetryRatio.toFixed(1)}%

LEFT BREAST:
- Current volume: ${leftResult.originalVolume} cm³
- Projected volume: ${leftResult.augmentedVolume} cm³
- Volume increase: +${leftResult.volumeIncrease} cm³
- Projected cup size: ${leftResult.newCupSize}
- Projection increase: +${leftResult.projectionIncrease} cm

RIGHT BREAST:
- Current volume: ${rightResult.originalVolume} cm³
- Projected volume: ${rightResult.augmentedVolume} cm³
- Volume increase: +${rightResult.volumeIncrease} cm³
- Projected cup size: ${rightResult.newCupSize}
- Projection increase: +${rightResult.projectionIncrease} cm

IMPLANT SPECIFICATIONS:
- Type: ${leftParams.implantType}
- Profile: ${leftParams.implantProfile}
- Estimated implant size: ${Math.round(leftResult.volumeIncrease)} cc

SYMMETRY ANALYSIS:
- Post-augmentation asymmetry: ${Math.abs(leftResult.augmentedVolume - rightResult.augmentedVolume) / Math.max(leftResult.augmentedVolume, rightResult.augmentedVolume) * 100}%

Generated on: ${new Date().toLocaleDateString()}
    `.trim();
  }
}