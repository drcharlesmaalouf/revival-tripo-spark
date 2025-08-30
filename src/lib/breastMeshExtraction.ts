import * as THREE from 'three';
import { BreastContour, NippleMarker } from './manualMeasurements';

export interface ExtractedBreastMesh {
  id: 'left' | 'right';
  originalMesh: THREE.Mesh;
  wireframeMesh: THREE.Mesh;
  volume: number; // in cm3
  centroid: THREE.Vector3;
  boundingBox: THREE.Box3;
}

export interface BreastVolumeCalculation {
  leftVolume: number;
  rightVolume: number;
  totalVolume: number;
  asymmetryRatio: number;
}

export class BreastMeshExtractor {
  /**
   * Extract breast regions from the main 3D model based on user annotations
   */
  static extractBreastMeshes(
    originalScene: THREE.Group,
    leftContour: BreastContour,
    rightContour: BreastContour,
    leftNipple: NippleMarker,
    rightNipple: NippleMarker
  ): { left: ExtractedBreastMesh; right: ExtractedBreastMesh } | null {
    
    // Find the main body mesh
    let bodyMesh: THREE.Mesh | null = null;
    originalScene.traverse((child) => {
      if (child instanceof THREE.Mesh && !child.name.includes('contour') && 
          !child.name.includes('nipple') && !child.name.includes('drawing')) {
        bodyMesh = child;
      }
    });

    if (!bodyMesh || !bodyMesh.geometry) {
      console.error('No body mesh found for extraction');
      return null;
    }

    const leftMesh = this.extractSingleBreast(bodyMesh, leftContour, leftNipple, 'left');
    const rightMesh = this.extractSingleBreast(bodyMesh, rightContour, rightNipple, 'right');

    if (!leftMesh || !rightMesh) {
      return null;
    }

    return { left: leftMesh, right: rightMesh };
  }

  /**
   * Extract a single breast mesh from the body
   */
  private static extractSingleBreast(
    bodyMesh: THREE.Mesh,
    contour: BreastContour,
    nipple: NippleMarker,
    side: 'left' | 'right'
  ): ExtractedBreastMesh | null {
    
    const geometry = bodyMesh.geometry;
    const positionAttribute = geometry.getAttribute('position');
    
    if (!positionAttribute) {
      console.error('No position attribute found');
      return null;
    }

    // Create a region of interest around the breast
    const breastCenter = contour.center;
    const breastRadius = contour.radius * 1.5; // Expand slightly for capture
    
    // Extract vertices within the breast region
    const extractedVertices: number[] = [];
    const extractedIndices: number[] = [];
    const vertexMap = new Map<number, number>();
    let newVertexIndex = 0;

    // First pass: identify vertices within breast region
    for (let i = 0; i < positionAttribute.count; i++) {
      const vertex = new THREE.Vector3(
        positionAttribute.getX(i),
        positionAttribute.getY(i),
        positionAttribute.getZ(i)
      );

      // Check if vertex is within breast region
      const distanceToCenter = vertex.distanceTo(breastCenter);
      const isInContour = this.isPointInBreastRegion(vertex, contour, nipple);
      
      if (distanceToCenter <= breastRadius && isInContour) {
        extractedVertices.push(vertex.x, vertex.y, vertex.z);
        vertexMap.set(i, newVertexIndex);
        newVertexIndex++;
      }
    }

    // Second pass: extract faces that have all vertices in the region
    const indexAttribute = geometry.getIndex();
    if (indexAttribute) {
      for (let i = 0; i < indexAttribute.count; i += 3) {
        const a = indexAttribute.getX(i);
        const b = indexAttribute.getX(i + 1);
        const c = indexAttribute.getX(i + 2);

        if (vertexMap.has(a) && vertexMap.has(b) && vertexMap.has(c)) {
          extractedIndices.push(
            vertexMap.get(a)!,
            vertexMap.get(b)!,
            vertexMap.get(c)!
          );
        }
      }
    }

    if (extractedVertices.length === 0) {
      console.error(`No vertices extracted for ${side} breast`);
      return null;
    }

    // Create new geometry for the extracted breast
    const breastGeometry = new THREE.BufferGeometry();
    breastGeometry.setAttribute('position', new THREE.Float32BufferAttribute(extractedVertices, 3));
    
    if (extractedIndices.length > 0) {
      breastGeometry.setIndex(extractedIndices);
    }

    breastGeometry.computeVertexNormals();

    // Create original solid mesh
    const originalMaterial = new THREE.MeshStandardMaterial({
      color: side === 'left' ? 0xff1493 : 0x1e90ff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    const originalMesh = new THREE.Mesh(breastGeometry, originalMaterial);
    originalMesh.name = `${side}-breast-original`;

    // Create wireframe mesh
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: side === 'left' ? 0xff69b4 : 0x4169e1,
      wireframe: true,
      transparent: true,
      opacity: 0.8
    });
    const wireframeMesh = new THREE.Mesh(breastGeometry.clone(), wireframeMaterial);
    wireframeMesh.name = `${side}-breast-wireframe`;

    // Calculate volume
    const volume = this.calculateMeshVolume(breastGeometry);
    
    // Calculate centroid and bounding box
    breastGeometry.computeBoundingBox();
    const boundingBox = breastGeometry.boundingBox!;
    const centroid = new THREE.Vector3();
    boundingBox.getCenter(centroid);

    return {
      id: side,
      originalMesh,
      wireframeMesh,
      volume,
      centroid,
      boundingBox
    };
  }

  /**
   * Check if a point is within the breast region based on contour
   */
  private static isPointInBreastRegion(
    point: THREE.Vector3,
    contour: BreastContour,
    nipple: NippleMarker
  ): boolean {
    // Simple distance-based check for now
    // In a more sophisticated version, we could use the actual contour polygon
    const distanceToCenter = point.distanceTo(contour.center);
    const distanceToNipple = point.distanceTo(nipple.position);
    
    // Point is in region if it's within the contour radius or close to nipple
    return distanceToCenter <= contour.radius || distanceToNipple <= 0.02;
  }

  /**
   * Calculate volume of a mesh using divergence theorem
   */
  private static calculateMeshVolume(geometry: THREE.BufferGeometry): number {
    const positionAttribute = geometry.getAttribute('position');
    const indexAttribute = geometry.getIndex();
    
    if (!positionAttribute || !indexAttribute) {
      return 0;
    }

    let volume = 0;
    
    // Use divergence theorem: V = (1/3) * Σ(face_area * dot(centroid, normal))
    for (let i = 0; i < indexAttribute.count; i += 3) {
      const a = indexAttribute.getX(i);
      const b = indexAttribute.getX(i + 1);
      const c = indexAttribute.getX(i + 2);

      const v1 = new THREE.Vector3(
        positionAttribute.getX(a),
        positionAttribute.getY(a),
        positionAttribute.getZ(a)
      );
      const v2 = new THREE.Vector3(
        positionAttribute.getX(b),
        positionAttribute.getY(b),
        positionAttribute.getZ(b)
      );
      const v3 = new THREE.Vector3(
        positionAttribute.getX(c),
        positionAttribute.getY(c),
        positionAttribute.getZ(c)
      );

      // Calculate triangle centroid
      const centroid = new THREE.Vector3()
        .addVectors(v1, v2)
        .add(v3)
        .divideScalar(3);

      // Calculate triangle normal (cross product)
      const edge1 = new THREE.Vector3().subVectors(v2, v1);
      const edge2 = new THREE.Vector3().subVectors(v3, v1);
      const normal = new THREE.Vector3().crossVectors(edge1, edge2);

      // Add to volume calculation
      volume += centroid.dot(normal);
    }

    // Convert to positive volume in cubic units
    return Math.abs(volume) / 6;
  }

  /**
   * Calculate breast volumes in cm3 based on measurements
   */
  static calculateBreastVolumes(
    leftDiameter: number,  // cm
    rightDiameter: number, // cm
    leftProjection: number, // cm
    rightProjection: number, // cm
    extractedMeshes?: { left: ExtractedBreastMesh; right: ExtractedBreastMesh }
  ): BreastVolumeCalculation {
    
    let leftVolume: number;
    let rightVolume: number;

    if (extractedMeshes) {
      // Use actual mesh volume (convert from model units to cm3)
      // Assuming model units are in meters, scale by 1000000 (100^3)
      leftVolume = extractedMeshes.left.volume * 1000000;
      rightVolume = extractedMeshes.right.volume * 1000000;
    } else {
      // Estimate using hemisphere formula: V = (2/3) * π * r^3
      // Where r is derived from diameter/2, and height is projection
      const leftRadius = leftDiameter / 2;
      const rightRadius = rightDiameter / 2;
      
      // Use ellipsoid formula for more accuracy: V = (4/3) * π * a * b * c
      // where a = b = radius, c = projection
      leftVolume = (4/3) * Math.PI * leftRadius * leftRadius * leftProjection;
      rightVolume = (4/3) * Math.PI * rightRadius * rightRadius * rightProjection;
    }

    const totalVolume = leftVolume + rightVolume;
    const asymmetryRatio = Math.abs(leftVolume - rightVolume) / Math.max(leftVolume, rightVolume) * 100;

    return {
      leftVolume: Math.round(leftVolume),
      rightVolume: Math.round(rightVolume),
      totalVolume: Math.round(totalVolume),
      asymmetryRatio: Math.round(asymmetryRatio * 10) / 10
    };
  }

  /**
   * Create manipulation controls for breast augmentation simulation
   */
  static createManipulationControls(extractedMesh: ExtractedBreastMesh): THREE.Group {
    const controlGroup = new THREE.Group();
    controlGroup.name = `${extractedMesh.id}-controls`;

    // Create scaling handles
    const handleGeometry = new THREE.SphereGeometry(0.005, 8, 8);
    const handleMaterial = new THREE.MeshBasicMaterial({
      color: extractedMesh.id === 'left' ? 0xff69b4 : 0x4169e1,
      transparent: true,
      opacity: 0.8
    });

    // Add handles at key positions for scaling
    const positions = [
      extractedMesh.centroid.clone().add(new THREE.Vector3(0, 0.05, 0)), // top
      extractedMesh.centroid.clone().add(new THREE.Vector3(0, -0.05, 0)), // bottom
      extractedMesh.centroid.clone().add(new THREE.Vector3(0.05, 0, 0)), // right
      extractedMesh.centroid.clone().add(new THREE.Vector3(-0.05, 0, 0)), // left
      extractedMesh.centroid.clone().add(new THREE.Vector3(0, 0, 0.05)), // front
    ];

    positions.forEach((position, index) => {
      const handle = new THREE.Mesh(handleGeometry, handleMaterial.clone());
      handle.position.copy(position);
      handle.name = `handle-${index}`;
      handle.userData = { type: 'manipulator', axis: index };
      controlGroup.add(handle);
    });

    return controlGroup;
  }
}