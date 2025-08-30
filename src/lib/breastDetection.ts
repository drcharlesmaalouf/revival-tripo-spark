import * as THREE from 'three';
import { MeshVertex, CurvatureData, BreastRegion } from './meshAnalysis';

export interface BreastLandmarks {
  leftNipple: THREE.Vector3 | null;
  rightNipple: THREE.Vector3 | null;
  leftBreastRegion: BreastRegion | null;
  rightBreastRegion: BreastRegion | null;
  chestMidline: THREE.Vector3;
}

export class BreastDetector {
  
  static detectBreastRegions(
    vertices: MeshVertex[], 
    curvatureMap: Map<number, CurvatureData>,
    mesh: THREE.Mesh
  ): BreastLandmarks {
    console.log('Starting breast detection from mesh curvature...');
    
    // Get mesh bounding box for reference
    const boundingBox = new THREE.Box3().setFromObject(mesh);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    
    console.log('Mesh bounds:', { center, size });
    
    // Filter vertices in chest region based on geometry
    const chestVertices = this.filterChestRegion(vertices, center, size);
    console.log(`Found ${chestVertices.length} chest vertices`);
    
    // Find high curvature regions (potential breast/nipple areas)
    const highCurvatureVertices = this.findHighCurvatureRegions(chestVertices, curvatureMap);
    console.log(`Found ${highCurvatureVertices.length} high curvature vertices`);
    
    // Cluster vertices into left and right breast regions
    const { leftRegion, rightRegion } = this.clusterBreastRegions(highCurvatureVertices, center);
    
    // Find nipple candidates (highest curvature in each region)
    const leftNipple = leftRegion ? this.findNippleCandidate(leftRegion.vertices, curvatureMap) : null;
    const rightNipple = rightRegion ? this.findNippleCandidate(rightRegion.vertices, curvatureMap) : null;
    
    console.log('Breast detection results:', {
      leftNipple: leftNipple?.toArray(),
      rightNipple: rightNipple?.toArray(),
      leftRegionSize: leftRegion?.vertices.length || 0,
      rightRegionSize: rightRegion?.vertices.length || 0
    });
    
    return {
      leftNipple,
      rightNipple,
      leftBreastRegion: leftRegion,
      rightBreastRegion: rightRegion,
      chestMidline: center
    };
  }

  private static filterChestRegion(vertices: MeshVertex[], center: THREE.Vector3, size: THREE.Vector3): MeshVertex[] {
    return vertices.filter(vertex => {
      const pos = vertex.position;
      const relative = pos.clone().sub(center);
      
      // Chest region criteria:
      // 1. Upper portion of model (above center)
      const isUpperChest = relative.y > -size.y * 0.3;
      
      // 2. Forward-facing (positive Z direction relative to center)
      const isForward = relative.z > -size.z * 0.2;
      
      // 3. Central chest area (not arms/sides)
      const isCentral = Math.abs(relative.x) < size.x * 0.4;
      
      // 4. Reasonable chest height range
      const isChestHeight = relative.y < size.y * 0.4;
      
      return isUpperChest && isForward && isCentral && isChestHeight;
    });
  }

  private static findHighCurvatureRegions(
    vertices: MeshVertex[], 
    curvatureMap: Map<number, CurvatureData>
  ): MeshVertex[] {
    // Calculate curvature threshold (top 20% of curvature values)
    const curvatures = vertices
      .map(v => curvatureMap.get(v.index)?.meanCurvature || 0)
      .sort((a, b) => b - a);
    
    const threshold = curvatures[Math.floor(curvatures.length * 0.2)] || 0.1;
    
    return vertices.filter(vertex => {
      const curvature = curvatureMap.get(vertex.index);
      return curvature && curvature.meanCurvature > threshold;
    });
  }

  private static clusterBreastRegions(
    vertices: MeshVertex[], 
    center: THREE.Vector3
  ): { leftRegion: BreastRegion | null; rightRegion: BreastRegion | null } {
    
    // Separate vertices by side of chest
    const leftVertices = vertices.filter(v => v.position.x < center.x);
    const rightVertices = vertices.filter(v => v.position.x > center.x);
    
    const createRegion = (regionVertices: MeshVertex[]): BreastRegion | null => {
      if (regionVertices.length < 10) return null;
      
      const boundingBox = new THREE.Box3();
      regionVertices.forEach(v => boundingBox.expandByPoint(v.position));
      
      const regionCenter = boundingBox.getCenter(new THREE.Vector3());
      
      return {
        vertices: regionVertices,
        boundingBox,
        center: regionCenter,
        curvatureMap: new Map() // Will be populated later if needed
      };
    };
    
    return {
      leftRegion: createRegion(leftVertices),
      rightRegion: createRegion(rightVertices)
    };
  }

  private static findNippleCandidate(
    vertices: MeshVertex[], 
    curvatureMap: Map<number, CurvatureData>
  ): THREE.Vector3 | null {
    if (vertices.length === 0) return null;
    
    // Find vertex with highest curvature
    let maxCurvature = -1;
    let nippleVertex: MeshVertex | null = null;
    
    for (const vertex of vertices) {
      const curvature = curvatureMap.get(vertex.index);
      if (curvature && curvature.meanCurvature > maxCurvature) {
        maxCurvature = curvature.meanCurvature;
        nippleVertex = vertex;
      }
    }
    
    return nippleVertex ? nippleVertex.position.clone() : null;
  }

  static createVisualizationMesh(
    originalMesh: THREE.Mesh,
    landmarks: BreastLandmarks
  ): THREE.Mesh {
    // Clone the original mesh
    const visualMesh = originalMesh.clone();
    const geometry = visualMesh.geometry.clone();
    
    // Create color attribute for visualization
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    
    // Default color (light gray)
    for (let i = 0; i < positions.count; i++) {
      colors[i * 3] = 0.8;     // R
      colors[i * 3 + 1] = 0.8; // G
      colors[i * 3 + 2] = 0.8; // B
    }
    
    // Color breast regions
    const colorRegion = (region: BreastRegion | null, color: [number, number, number]) => {
      if (!region) return;
      
      region.vertices.forEach(vertex => {
        const idx = vertex.index;
        colors[idx * 3] = color[0];
        colors[idx * 3 + 1] = color[1];
        colors[idx * 3 + 2] = color[2];
      });
    };
    
    // Color left breast pink, right breast blue
    colorRegion(landmarks.leftBreastRegion, [1.0, 0.7, 0.8]);
    colorRegion(landmarks.rightBreastRegion, [0.7, 0.8, 1.0]);
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Create material with vertex colors
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide
    });
    
    visualMesh.material = material;
    visualMesh.geometry = geometry;
    
    return visualMesh;
  }
}