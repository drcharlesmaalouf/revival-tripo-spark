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
    // Calculate adaptive thresholds based on model size
    const sizeScale = Math.max(size.x, size.y, size.z);
    
    return vertices.filter(vertex => {
      const pos = vertex.position;
      const relative = pos.clone().sub(center);
      
      // More adaptive chest region criteria:
      // 1. Upper body region (more generous range)
      const isUpperBody = relative.y > -size.y * 0.6 && relative.y < size.y * 0.6;
      
      // 2. Front-facing area (detect based on normal direction as well)
      const normalDirection = vertex.normal.z; // Assuming Z is forward
      const isForwardFacing = normalDirection > -0.3 && relative.z > -size.z * 0.4;
      
      // 3. Central torso area (exclude arms and outer edges)
      const isCentralTorso = Math.abs(relative.x) < size.x * 0.6;
      
      // 4. Reasonable distance from center
      const distanceFromCenter = relative.length();
      const isReasonableDistance = distanceFromCenter < sizeScale * 1.2;
      
      return isUpperBody && isForwardFacing && isCentralTorso && isReasonableDistance;
    });
  }

  private static findHighCurvatureRegions(
    vertices: MeshVertex[], 
    curvatureMap: Map<number, CurvatureData>
  ): MeshVertex[] {
    if (vertices.length === 0) return [];
    
    // Get all curvature values
    const curvatures = vertices
      .map(v => curvatureMap.get(v.index)?.meanCurvature || 0)
      .filter(c => c > 0)
      .sort((a, b) => b - a);
    
    if (curvatures.length === 0) return [];
    
    // Use multiple threshold strategies
    const strategies = [
      curvatures[Math.floor(curvatures.length * 0.1)] || 0, // Top 10%
      curvatures[Math.floor(curvatures.length * 0.2)] || 0, // Top 20%
      curvatures[Math.floor(curvatures.length * 0.3)] || 0, // Top 30%
    ];
    
    // Try each strategy and return the one with reasonable results
    for (const threshold of strategies) {
      const candidates = vertices.filter(vertex => {
        const curvature = curvatureMap.get(vertex.index);
        return curvature && curvature.meanCurvature > threshold;
      });
      
      // Good candidate set: not too few, not too many
      if (candidates.length >= 20 && candidates.length <= vertices.length * 0.4) {
        console.log(`Using curvature threshold: ${threshold.toFixed(4)}, found ${candidates.length} candidates`);
        return candidates;
      }
    }
    
    // Fallback: use a basic threshold
    const fallbackThreshold = Math.max(...curvatures) * 0.3;
    console.log(`Using fallback threshold: ${fallbackThreshold.toFixed(4)}`);
    
    return vertices.filter(vertex => {
      const curvature = curvatureMap.get(vertex.index);
      return curvature && curvature.meanCurvature > fallbackThreshold;
    });
  }

  private static clusterBreastRegions(
    vertices: MeshVertex[], 
    center: THREE.Vector3
  ): { leftRegion: BreastRegion | null; rightRegion: BreastRegion | null } {
    
    if (vertices.length < 20) {
      console.log('Not enough high-curvature vertices for breast detection');
      return { leftRegion: null, rightRegion: null };
    }
    
    // Separate vertices by side of chest (more robust clustering)
    const leftVertices = vertices.filter(v => v.position.x < center.x);
    const rightVertices = vertices.filter(v => v.position.x > center.x);
    
    // Additional clustering based on spatial proximity
    const clusterVertices = (sideVertices: MeshVertex[]): MeshVertex[] => {
      if (sideVertices.length === 0) return [];
      
      // Find the densest cluster using simple k-means approach
      let bestCluster = sideVertices;
      
      if (sideVertices.length > 50) {
        // Calculate center of mass for this side
        const centerOfMass = new THREE.Vector3();
        sideVertices.forEach(v => centerOfMass.add(v.position));
        centerOfMass.divideScalar(sideVertices.length);
        
        // Keep vertices within reasonable distance from center of mass
        const distances = sideVertices.map(v => v.position.distanceTo(centerOfMass));
        distances.sort((a, b) => a - b);
        const medianDistance = distances[Math.floor(distances.length / 2)];
        const maxDistance = medianDistance * 2.5;
        
        bestCluster = sideVertices.filter(v => 
          v.position.distanceTo(centerOfMass) <= maxDistance
        );
      }
      
      return bestCluster;
    };
    
    const clusterLeft = clusterVertices(leftVertices);
    const clusterRight = clusterVertices(rightVertices);
    
    const createRegion = (regionVertices: MeshVertex[]): BreastRegion | null => {
      if (regionVertices.length < 5) return null;
      
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
      leftRegion: createRegion(clusterLeft),
      rightRegion: createRegion(clusterRight)
    };
  }

  private static findNippleCandidate(
    vertices: MeshVertex[], 
    curvatureMap: Map<number, CurvatureData>
  ): THREE.Vector3 | null {
    if (vertices.length === 0) return null;
    
    // Find multiple candidates and select the most central one with high curvature
    const candidates: { vertex: MeshVertex; curvature: number; centrality: number }[] = [];
    
    // Calculate center of the region
    const regionCenter = new THREE.Vector3();
    vertices.forEach(v => regionCenter.add(v.position));
    regionCenter.divideScalar(vertices.length);
    
    // Score each vertex based on curvature and centrality
    for (const vertex of vertices) {
      const curvature = curvatureMap.get(vertex.index)?.meanCurvature || 0;
      const distanceToCenter = vertex.position.distanceTo(regionCenter);
      const maxDistance = Math.max(...vertices.map(v => v.position.distanceTo(regionCenter)));
      const centrality = maxDistance > 0 ? (1 - distanceToCenter / maxDistance) : 1;
      
      if (curvature > 0) {
        candidates.push({ vertex, curvature, centrality });
      }
    }
    
    if (candidates.length === 0) return null;
    
    // Sort by combined score (curvature * centrality)
    candidates.sort((a, b) => (b.curvature * b.centrality) - (a.curvature * a.centrality));
    
    return candidates[0].vertex.position.clone();
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