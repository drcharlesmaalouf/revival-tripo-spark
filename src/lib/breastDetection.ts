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
    
    console.log('Mesh bounds:', { 
      center: center.toArray(), 
      size: size.toArray(),
      minPoint: boundingBox.min.toArray(),
      maxPoint: boundingBox.max.toArray()
    });
    
    // Debug: Check vertex distribution
    console.log('Sample vertex positions:');
    for (let i = 0; i < Math.min(10, vertices.length); i += Math.floor(vertices.length / 10)) {
      const v = vertices[i];
      console.log(`Vertex ${i}: pos=${v.position.toArray()}, normal=${v.normal.toArray()}`);
    }
    
    // Filter vertices in chest region based on geometry (very lenient initially)
    const chestVertices = this.filterChestRegion(vertices, center, size);
    console.log(`Found ${chestVertices.length} chest vertices`);
    
    // If no chest vertices found, try with more lenient criteria
    let finalChestVertices = chestVertices;
    if (chestVertices.length === 0) {
      console.log('No chest vertices found, trying more lenient criteria...');
      finalChestVertices = this.filterChestRegionLenient(vertices, center, size);
      console.log(`Found ${finalChestVertices.length} vertices with lenient criteria`);
    }
    
    // Find high curvature regions (potential breast/nipple areas)
    const highCurvatureVertices = this.findHighCurvatureRegions(finalChestVertices, curvatureMap);
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
      
      // Very lenient chest region criteria (cast a wide net first):
      // 1. Any upper body region
      const isUpperBody = relative.y > -size.y * 0.8;
      
      // 2. Front half of the model
      const isForwardHalf = relative.z > -size.z * 0.5;
      
      // 3. Central 80% (exclude far edges)
      const isCentral = Math.abs(relative.x) < size.x * 0.8;
      
      return isUpperBody && isForwardHalf && isCentral;
    });
  }

  private static filterChestRegionLenient(vertices: MeshVertex[], center: THREE.Vector3, size: THREE.Vector3): MeshVertex[] {
    // Extremely lenient - just exclude obvious outliers
    return vertices.filter(vertex => {
      const pos = vertex.position;
      const relative = pos.clone().sub(center);
      
      // Just exclude vertices that are obviously not part of the torso
      const isNotTooFarBelow = relative.y > -size.y * 1.0;
      const isNotTooFarBack = relative.z > -size.z * 0.8;
      const isNotTooFarSide = Math.abs(relative.x) < size.x * 1.0;
      
      return isNotTooFarBelow && isNotTooFarBack && isNotTooFarSide;
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
    // Don't modify the original mesh - just return it as-is
    // We'll add visualization markers separately in the ModelViewer
    return originalMesh.clone();
  }

  static createVisualizationMarkers(landmarks: BreastLandmarks): THREE.Group {
    const markersGroup = new THREE.Group();
    markersGroup.name = 'BreastMarkers';

    // Create nipple markers
    if (landmarks.leftNipple) {
      const leftMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 16, 16), // Much larger sphere
        new THREE.MeshStandardMaterial({ 
          color: 0xff1493, // Deep pink
          emissive: 0xff1493, // Bright emissive
          emissiveIntensity: 0.5,
          transparent: false, // Make solid for visibility
          opacity: 1.0
        })
      );
      leftMarker.position.copy(landmarks.leftNipple);
      leftMarker.name = 'LeftNipple';
      console.log('Created left nipple marker at:', landmarks.leftNipple);
      markersGroup.add(leftMarker);
    }

    if (landmarks.rightNipple) {
      const rightMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 16, 16), // Much larger sphere
        new THREE.MeshStandardMaterial({ 
          color: 0x1e90ff, // Deep sky blue
          emissive: 0x1e90ff, // Bright emissive
          emissiveIntensity: 0.5,
          transparent: false, // Make solid for visibility
          opacity: 1.0
        })
      );
      rightMarker.position.copy(landmarks.rightNipple);
      rightMarker.name = 'RightNipple';
      console.log('Created right nipple marker at:', landmarks.rightNipple);
      markersGroup.add(rightMarker);
    }

    // Create region boundary markers
    if (landmarks.leftBreastRegion) {
      const leftRegionMarkers = this.createRegionMarkers(
        landmarks.leftBreastRegion, 
        0xff69b4 // Hot pink
      );
      leftRegionMarkers.name = 'LeftRegion';
      markersGroup.add(leftRegionMarkers);
    }

    if (landmarks.rightBreastRegion) {
      const rightRegionMarkers = this.createRegionMarkers(
        landmarks.rightBreastRegion, 
        0x4169e1 // Royal blue
      );
      rightRegionMarkers.name = 'RightRegion';
      markersGroup.add(rightRegionMarkers);
    }

    return markersGroup;
  }

  private static createRegionMarkers(region: BreastRegion, color: number): THREE.Group {
    const regionGroup = new THREE.Group();
    
    // Sample a few vertices from the region to show as small markers
    const sampleSize = Math.min(5, region.vertices.length);
    const step = Math.floor(region.vertices.length / sampleSize);
    
    for (let i = 0; i < region.vertices.length; i += step) {
      if (regionGroup.children.length >= sampleSize) break;
      
      const vertex = region.vertices[i];
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8), // Larger region markers
        new THREE.MeshStandardMaterial({ 
          color: color,
          emissive: color,
          emissiveIntensity: 0.3,
          transparent: false,
          opacity: 1.0
        })
      );
      marker.position.copy(vertex.position);
      regionGroup.add(marker);
    }

    return regionGroup;
  }
}