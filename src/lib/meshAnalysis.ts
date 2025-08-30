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
    let mainMesh: THREE.Mesh | null = null;
    let maxVertices = 0;

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const positions = child.geometry.attributes.position;
        if (positions && positions.count > maxVertices) {
          maxVertices = positions.count;
          mainMesh = child;
        }
      }
    });

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

    // Simplified curvature calculation
    // In a real implementation, you'd use more sophisticated methods
    let totalCurvature = 0;
    const normal = vertex.normal;

    for (const neighbor of neighbors) {
      const edge = neighbor.position.clone().sub(vertex.position);
      const projection = edge.clone().projectOnVector(normal);
      const tangent = edge.clone().sub(projection);
      
      if (tangent.length() > 0) {
        const curvature = projection.length() / (tangent.length() * tangent.length());
        totalCurvature += curvature;
      }
    }

    const meanCurvature = totalCurvature / neighbors.length;
    
    return {
      meanCurvature,
      gaussianCurvature: meanCurvature * meanCurvature, // Simplified
      principalCurvatures: [meanCurvature * 1.5, meanCurvature * 0.5]
    };
  }

  static findNeighbors(vertexIndex: number, geometry: THREE.BufferGeometry, radius: number = 0.05): number[] {
    const positions = geometry.attributes.position;
    const targetPos = new THREE.Vector3(
      positions.getX(vertexIndex),
      positions.getY(vertexIndex),
      positions.getZ(vertexIndex)
    );

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

  static createCurvatureMap(vertices: MeshVertex[], geometry: THREE.BufferGeometry): Map<number, CurvatureData> {
    const curvatureMap = new Map<number, CurvatureData>();
    
    console.log(`Calculating curvature for ${vertices.length} vertices...`);
    
    for (const vertex of vertices) {
      const neighborIndices = this.findNeighbors(vertex.index, geometry);
      const neighbors = neighborIndices.map(idx => vertices[idx]).filter(Boolean);
      
      const curvature = this.calculateCurvature(vertex, neighbors);
      curvatureMap.set(vertex.index, curvature);
    }

    return curvatureMap;
  }
}