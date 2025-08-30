import * as THREE from 'three';

export interface MeshVertex {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  index: number;
}

export interface CurvatureData {
  meanCurvature: number;
  gaussianCurvature: number;
  principalCurvatures: [number, number];
}

export interface BreastRegion {
  vertices: MeshVertex[];
  boundingBox: THREE.Box3;
  center: THREE.Vector3;
  curvatureMap: Map<number, CurvatureData>;
}

export class MeshAnalyzer {
  
  static extractMeshData(scene: THREE.Group): THREE.Mesh | null {
    console.log('=== MESH EXTRACTION DEBUG ===');
    console.log('Scene:', scene);
    
    let mainMesh: THREE.Mesh | null = null;
    let maxVertices = 0;

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const positions = child.geometry.attributes.position;
        console.log('Found mesh child:', child);
        console.log('- Geometry:', child.geometry);
        console.log('- Position count:', positions?.count);
        console.log('- Material:', child.material);
        console.log('- Geometry type:', child.geometry.constructor.name);
        
        if (positions && positions.count > maxVertices) {
          maxVertices = positions.count;
          mainMesh = child;
        }
      }
    });

    if (mainMesh) {
      console.log('Selected main mesh:');
      console.log('- Vertices:', maxVertices);
      console.log('- Geometry integrity check:', mainMesh.geometry.attributes.position ? 'OK' : 'BROKEN');
      console.log('- Index buffer:', mainMesh.geometry.index ? 'Present' : 'Missing');
    }

    return mainMesh;
  }

  static analyzeMeshGeometry(mesh: THREE.Mesh): MeshVertex[] {
    const geometry = mesh.geometry;
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;

    if (!positions || !normals) {
      throw new Error('Mesh missing required position or normal attributes');
    }

    // Ensure normals are computed
    if (!normals) {
      geometry.computeVertexNormals();
    }

    const vertices: MeshVertex[] = [];
    const vertexCount = positions.count;

    for (let i = 0; i < vertexCount; i++) {
      const position = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
      
      const normal = new THREE.Vector3(
        normals.getX(i),
        normals.getY(i),
        normals.getZ(i)
      );

      vertices.push({
        position: position.clone(),
        normal: normal.clone(),
        index: i
      });
    }

    return vertices;
  }

  static calculateCurvature(vertex: MeshVertex, neighbors: MeshVertex[]): CurvatureData {
    if (neighbors.length < 3) {
      return {
        meanCurvature: 0,
        gaussianCurvature: 0,
        principalCurvatures: [0, 0]
      };
    }

    // Improved curvature calculation using mesh geometry
    const normal = vertex.normal.clone().normalize();
    let meanCurvature = 0;
    let curvatureSum = 0;
    let validNeighbors = 0;

    for (const neighbor of neighbors) {
      const edge = neighbor.position.clone().sub(vertex.position);
      const edgeLength = edge.length();
      
      if (edgeLength > 0) {
        // Calculate angle between vertex normal and edge direction
        const normalizedEdge = edge.clone().normalize();
        const dotProduct = normal.dot(normalizedEdge);
        
        // Convert to curvature measure (higher values for more curved surfaces)
        const curvature = Math.abs(1 - Math.abs(dotProduct)) / edgeLength;
        curvatureSum += curvature;
        validNeighbors++;
      }
    }

    if (validNeighbors > 0) {
      meanCurvature = curvatureSum / validNeighbors;
    }
    
    return {
      meanCurvature: meanCurvature * 100, // Scale up for better detection
      gaussianCurvature: meanCurvature * meanCurvature * 10000,
      principalCurvatures: [meanCurvature * 150, meanCurvature * 50]
    };
  }

  static findNeighbors(vertexIndex: number, geometry: THREE.BufferGeometry, adaptiveRadius: number = 0): number[] {
    const positions = geometry.attributes.position;
    const targetPos = new THREE.Vector3(
      positions.getX(vertexIndex),
      positions.getY(vertexIndex),
      positions.getZ(vertexIndex)
    );

    // Calculate adaptive radius based on mesh density if not provided
    let radius = adaptiveRadius;
    if (radius === 0) {
      // Sample a few nearby vertices to estimate mesh density
      let totalDistance = 0;
      let sampleCount = 0;
      const maxSamples = Math.min(50, positions.count);
      
      for (let i = 0; i < maxSamples && sampleCount < 10; i++) {
        if (i === vertexIndex) continue;
        
        const pos = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        );
        
        const distance = targetPos.distanceTo(pos);
        if (distance > 0) {
          totalDistance += distance;
          sampleCount++;
        }
      }
      
      radius = sampleCount > 0 ? (totalDistance / sampleCount) * 2 : 0.1;
    }

    const neighbors: number[] = [];
    
    for (let i = 0; i < positions.count; i++) {
      if (i === vertexIndex) continue;
      
      const pos = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
      
      if (targetPos.distanceTo(pos) <= radius) {
        neighbors.push(i);
      }
    }

    return neighbors;
  }

  static async createCurvatureMap(vertices: MeshVertex[], geometry: THREE.BufferGeometry): Promise<Map<number, CurvatureData>> {
    const curvatureMap = new Map<number, CurvatureData>();
    
    console.log(`Calculating curvature for ${vertices.length} vertices...`);
    
    // For performance, limit analysis but keep all original indices
    const maxVertices = 5000; // Reduce even further
    let verticesToProcess = vertices;
    
    if (vertices.length > maxVertices) {
      // Instead of sampling, just process every Nth vertex but keep original indices
      const step = Math.ceil(vertices.length / maxVertices);
      verticesToProcess = vertices.filter((_, index) => index % step === 0);
      console.log(`Processing every ${step}th vertex: ${verticesToProcess.length} vertices`);
    }
    
    // Use a simpler neighbor finding approach for performance
    const batchSize = 50; // Much smaller batches
    let processed = 0;
    
    for (let i = 0; i < verticesToProcess.length; i += batchSize) {
      const batch = verticesToProcess.slice(i, i + batchSize);
      
      for (const vertex of batch) {
        // Simplified curvature calculation without expensive neighbor search
        const curvature = this.calculateSimpleCurvature(vertex, geometry);
        curvatureMap.set(vertex.index, curvature);
      }
      
      processed += batch.length;
      
      // Yield control less frequently
      if (i % (batchSize * 10) === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
        console.log(`Curvature progress: ${processed}/${verticesToProcess.length} (${Math.round(processed/verticesToProcess.length*100)}%)`);
      }
    }

    return curvatureMap;
  }

  static calculateSimpleCurvature(vertex: MeshVertex, geometry: THREE.BufferGeometry): CurvatureData {
    // Much simpler curvature calculation that doesn't require neighbor search
    const normal = vertex.normal.clone().normalize();
    const position = vertex.position;
    
    // Use normal direction as a proxy for curvature
    // Points with normals pointing outward from center tend to be curved
    const curvature = Math.abs(normal.y) + Math.abs(normal.z * 0.5); // Favor forward-facing and upward normals
    const scaledCurvature = curvature * 50; // Scale for detection
    
    return {
      meanCurvature: scaledCurvature,
      gaussianCurvature: scaledCurvature * scaledCurvature,
      principalCurvatures: [scaledCurvature * 1.5, scaledCurvature * 0.5]
    };
  }

  static sampleVertices(vertices: MeshVertex[], maxCount: number): MeshVertex[] {
    if (vertices.length <= maxCount) return vertices;
    
    const step = Math.floor(vertices.length / maxCount);
    const sampled: MeshVertex[] = [];
    
    for (let i = 0; i < vertices.length; i += step) {
      sampled.push(vertices[i]);
    }
    
    return sampled.slice(0, maxCount);
  }
}