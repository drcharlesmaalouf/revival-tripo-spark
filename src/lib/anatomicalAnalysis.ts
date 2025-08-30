import * as THREE from 'three';
import { BreastLandmarks, BreastMeasurements, BreastMeasurementAnalyzer } from './breastMeasurements';

export interface AnatomicalLandmarks {
  leftInframammaryFold: THREE.Vector3;
  rightInframammaryFold: THREE.Vector3;
  leftNipple: THREE.Vector3;
  rightNipple: THREE.Vector3;
  chestWall: THREE.Vector3[];
  breastBoundaries: {
    left: THREE.Vector3[];
    right: THREE.Vector3[];
  };
  // Enhanced breast-specific landmarks
  leftBreastApex: THREE.Vector3;
  rightBreastApex: THREE.Vector3;
  midChestPoint: THREE.Vector3;
  measurements: BreastMeasurements;
}

export interface BreastMeshData {
  leftBreastMesh: THREE.Mesh;
  rightBreastMesh: THREE.Mesh;
  landmarks: AnatomicalLandmarks;
  measurements: BreastMeasurements;
  modelScale: number;
  analyzedMesh?: THREE.Mesh; // Mesh with color-coded analysis results
}

interface VertexAnalysis {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  curvature: number;
  isBreastRegion: boolean;
  isNippleCandidate: boolean;
  breastSide?: 'left' | 'right';
}

class AnatomicalAnalyzer {

  async analyzeModel(scene: THREE.Group): Promise<BreastMeshData> {
    console.log('Starting real 3D mesh anatomical analysis...');

    // Basic validation - check if the model could be human
    const isValidHumanModel = await this.validateHumanModel(scene);
    if (!isValidHumanModel) {
      throw new Error('Model does not appear to be a human torso suitable for anatomical analysis');
    }

    // Find the main mesh for analysis
    const mainMesh = this.findMainMesh(scene);
    if (!mainMesh) {
      throw new Error('No analyzable mesh found in the scene');
    }

    // Perform real 3D mesh analysis
    const vertexAnalysis = this.analyzeMeshGeometry(mainMesh);
    
    // Debug the analysis results
    console.log('=== BREAST DETECTION ANALYSIS ===');
    const nippleCandidates = vertexAnalysis.filter(v => v.isNippleCandidate);
    const breastVertices = vertexAnalysis.filter(v => v.isBreastRegion);
    
    console.log('Model mesh info:', {
      totalVertices: vertexAnalysis.length,
      meshPosition: mainMesh.position,
      meshScale: mainMesh.scale,
      boundingBox: new THREE.Box3().setFromObject(mainMesh).getSize(new THREE.Vector3())
    });
    
    console.log('Detection results:', {
      nippleCandidatesFound: nippleCandidates.length,
      breastRegionVertices: breastVertices.length,
      leftBreastVertices: breastVertices.filter(v => v.breastSide === 'left').length,
      rightBreastVertices: breastVertices.filter(v => v.breastSide === 'right').length
    });
    
    // Log first few nipple candidates for debugging
    nippleCandidates.slice(0, 5).forEach((candidate, idx) => {
      console.log(`Nipple candidate ${idx + 1}:`, {
        position: `(${candidate.position.x.toFixed(2)}, ${candidate.position.y.toFixed(2)}, ${candidate.position.z.toFixed(2)})`,
        curvature: candidate.curvature.toFixed(3),
        side: candidate.breastSide
      });
    });

    // Use manual landmarks for now since automatic detection needs work
    const landmarks = this.createManualLandmarks(mainMesh);

    // Create color-coded mesh for visualization (but don't use it as main display)
    const analyzedMesh = this.createColorCodedMesh(mainMesh, vertexAnalysis);

    // Extract breast meshes
    const breastMeshes = await this.extractBreastMeshes(scene, landmarks);
    
    // Calculate comprehensive measurements
    const breastLandmarks: BreastLandmarks = {
      leftNipple: landmarks.leftNipple,
      rightNipple: landmarks.rightNipple,
      leftInframammaryFold: landmarks.leftInframammaryFold,
      rightInframammaryFold: landmarks.rightInframammaryFold,
      leftBreastApex: landmarks.leftBreastApex,
      rightBreastApex: landmarks.rightBreastApex,
      midChestPoint: landmarks.midChestPoint,
      leftBreastBoundary: landmarks.breastBoundaries.left,
      rightBreastBoundary: landmarks.breastBoundaries.right,
    };
    
    const measurements = BreastMeasurementAnalyzer.calculateMeasurements(breastLandmarks);
    const boundingBox = new THREE.Box3().setFromObject(scene);
    const modelScale = this.detectModelScale(boundingBox);

    return {
      leftBreastMesh: breastMeshes.left,
      rightBreastMesh: breastMeshes.right,
      landmarks: { ...landmarks, measurements },
      measurements,
      modelScale,
      analyzedMesh
    };
  }

  private detectModelScale(boundingBox: THREE.Box3): number {
    const size = boundingBox.getSize(new THREE.Vector3());
    // Human torso typically 40-60cm tall
    // If model is much larger, it's likely scaled up
    return size.y > 4 ? 10 : 1;
  }

  private async validateHumanModel(scene: THREE.Group): Promise<boolean> {
    // Basic geometric validation for human torso characteristics
    const boundingBox = new THREE.Box3().setFromObject(scene);
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Check aspect ratios typical of human torso
    const aspectRatioYX = size.y / size.x; // Height to width
    const aspectRatioZX = size.z / size.x; // Depth to width
    
    // Human torso typically has these proportions:
    // - Height should be greater than width (aspect ratio > 1.2)
    // - Depth should be reasonable compared to width (0.3 < ratio < 0.8)
    const hasValidAspectRatio = aspectRatioYX > 1.2 && aspectRatioYX < 3.0;
    const hasValidDepth = aspectRatioZX > 0.3 && aspectRatioZX < 0.8;
    
    // Check if model has reasonable complexity (vertex count)
    let totalVertices = 0;
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const geometry = child.geometry;
        if (geometry.attributes.position) {
          totalVertices += geometry.attributes.position.count;
        }
      }
    });
    
    // Human models typically have at least 1000 vertices for meaningful anatomy
    const hasReasonableComplexity = totalVertices > 1000;
    
    console.log('Model validation:', {
      size,
      aspectRatioYX,
      aspectRatioZX,
      totalVertices,
      hasValidAspectRatio,
      hasValidDepth,
      hasReasonableComplexity
    });
    
    return hasValidAspectRatio && hasValidDepth && hasReasonableComplexity;
  }

  private findMainMesh(scene: THREE.Group): THREE.Mesh | null {
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

    console.log(`Found main mesh with ${maxVertices} vertices`);
    return mainMesh;
  }

  private analyzeMeshGeometry(mesh: THREE.Mesh): VertexAnalysis[] {
    console.log('Analyzing mesh geometry for breast features...');
    
    const geometry = mesh.geometry;
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    
    if (!positions || !normals) {
      throw new Error('Mesh missing required position or normal attributes');
    }

    const vertexAnalysis: VertexAnalysis[] = [];
    const vertexCount = positions.count;
    
    // Get bounding box for reference
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());

    console.log(`Analyzing ${vertexCount} vertices...`);
    console.log('Model center:', center);
    console.log('Model size:', size);

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

      // Calculate curvature based on normal direction and position
      const curvature = this.calculateVertexCurvature(position, normal, i, positions, normals);
      
      // Determine if this vertex is in breast region
      const isBreastRegion = this.isInBreastRegion(position, center, size);
      
      // Check if this could be a nipple (high curvature + forward position + breast region)
      const isNippleCandidate = isBreastRegion && curvature > 0.8 && 
        position.z > center.z + size.z * 0.2; // Forward-most 20%
      
      // Determine breast side
      let breastSide: 'left' | 'right' | undefined;
      if (isBreastRegion) {
        breastSide = position.x < center.x ? 'left' : 'right';
      }

      vertexAnalysis.push({
        position: position.clone(),
        normal: normal.clone(),
        curvature,
        isBreastRegion,
        isNippleCandidate,
        breastSide
      });
    }

    const breastVertices = vertexAnalysis.filter(v => v.isBreastRegion).length;
    const nippleCandidates = vertexAnalysis.filter(v => v.isNippleCandidate).length;
    
    console.log(`Found ${breastVertices} breast region vertices`);
    console.log(`Found ${nippleCandidates} nipple candidates`);

    return vertexAnalysis;
  }

  private calculateVertexCurvature(
    position: THREE.Vector3,
    normal: THREE.Vector3,
    index: number,
    positions: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
    normals: THREE.BufferAttribute | THREE.InterleavedBufferAttribute
  ): number {
    // Simplified curvature calculation based on normal vector direction
    // Higher values indicate more pronounced curvature
    
    // Forward-facing normal indicates convex curvature (breast/nipple)
    const forwardFacing = normal.z > 0 ? normal.z : 0;
    
    // Additional curvature from how much the normal deviates from surrounding normals
    let normalDeviation = 0;
    const sampleRadius = 10; // Check nearby vertices
    let sampledCount = 0;
    
    for (let i = Math.max(0, index - sampleRadius); 
         i < Math.min(positions.count, index + sampleRadius); 
         i++) {
      if (i === index) continue;
      
      const nearbyNormal = new THREE.Vector3(
        normals.getX(i),
        normals.getY(i),
        normals.getZ(i)
      );
      
      normalDeviation += normal.angleTo(nearbyNormal);
      sampledCount++;
    }
    
    if (sampledCount > 0) {
      normalDeviation /= sampledCount;
    }
    
    // Combine forward-facing and deviation for curvature measure
    return forwardFacing * 0.7 + (normalDeviation / Math.PI) * 0.3;
  }

  private isInBreastRegion(position: THREE.Vector3, center: THREE.Vector3, size: THREE.Vector3): boolean {
    // Define breast region based on anatomical positioning
    const relativePos = position.clone().sub(center);
    
    // Breast region criteria:
    // 1. Forward portion of torso (positive Z)
    // 2. Upper chest area (positive Y, but not too high)
    // 3. Left and right sides (not center)
    // 4. Reasonable distance from center
    
    const isForward = relativePos.z > size.z * 0.1; // Forward 10% of model
    const isUpperChest = relativePos.y > -size.y * 0.3 && relativePos.y < size.y * 0.3;
    const isNotCenter = Math.abs(relativePos.x) > size.x * 0.05; // Not in center 10%
    const isReasonableDistance = Math.abs(relativePos.x) < size.x * 0.4; // Within 40% of center
    
    return isForward && isUpperChest && isNotCenter && isReasonableDistance;
  }

  private detectAnatomicalLandmarks(vertexAnalysis: VertexAnalysis[], mesh: THREE.Mesh): AnatomicalLandmarks {
    console.log('Detecting anatomical landmarks from mesh analysis...');
    
    const breastVertices = vertexAnalysis.filter(v => v.isBreastRegion);
    const leftBreastVertices = breastVertices.filter(v => v.breastSide === 'left');
    const rightBreastVertices = breastVertices.filter(v => v.breastSide === 'right');
    
    // Find nipples as highest curvature points in each breast
    const leftNippleCandidates = leftBreastVertices
      .filter(v => v.isNippleCandidate)
      .sort((a, b) => b.curvature - a.curvature);
    
    const rightNippleCandidates = rightBreastVertices
      .filter(v => v.isNippleCandidate)
      .sort((a, b) => b.curvature - a.curvature);
    
    // Get bounding box for reference
    const boundingBox = new THREE.Box3().setFromObject(mesh);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Use detected nipples or fallback to geometric estimation
    const leftNipple = leftNippleCandidates.length > 0 
      ? leftNippleCandidates[0].position
      : this.detectNipplePosition(center, size, 'left');
    
    const rightNipple = rightNippleCandidates.length > 0 
      ? rightNippleCandidates[0].position
      : this.detectNipplePosition(center, size, 'right');
    
    console.log('Detected nipples:', { 
      left: leftNipple, 
      right: rightNipple,
      leftCandidates: leftNippleCandidates.length,
      rightCandidates: rightNippleCandidates.length
    });
    
    // Generate breast boundaries from actual detected breast vertices
    const leftBoundary = this.generateBreastBoundaryFromVertices(leftBreastVertices);
    const rightBoundary = this.generateBreastBoundaryFromVertices(rightBreastVertices);
    
    const landmarks: AnatomicalLandmarks = {
      leftNipple,
      rightNipple,
      leftInframammaryFold: this.detectInframammaryFold(center, size, 'left'),
      rightInframammaryFold: this.detectInframammaryFold(center, size, 'right'),
      leftBreastApex: this.findBreastApex(leftBreastVertices),
      rightBreastApex: this.findBreastApex(rightBreastVertices),
      midChestPoint: new THREE.Vector3(center.x, center.y, center.z - size.z * 0.2),
      chestWall: [
        new THREE.Vector3(center.x, center.y, center.z - size.z * 0.2),
        new THREE.Vector3(center.x - size.x * 0.3, center.y, center.z - size.z * 0.2),
        new THREE.Vector3(center.x + size.x * 0.3, center.y, center.z - size.z * 0.2)
      ],
      breastBoundaries: {
        left: leftBoundary,
        right: rightBoundary
      },
      measurements: {} as BreastMeasurements
    };
    
    return landmarks;
  }

  private generateBreastBoundaryFromVertices(breastVertices: VertexAnalysis[]): THREE.Vector3[] {
    if (breastVertices.length === 0) return [];
    
    // Find the convex hull or boundary points of breast vertices
    const positions = breastVertices.map(v => v.position);
    
    // Sort by angle around the centroid to create a boundary
    const centroid = positions.reduce((sum, pos) => sum.add(pos), new THREE.Vector3()).divideScalar(positions.length);
    
    const sortedPositions = positions.sort((a, b) => {
      const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
      const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x);
      return angleA - angleB;
    });
    
    // Sample boundary points
    const boundaryPoints = [];
    const step = Math.max(1, Math.floor(sortedPositions.length / 16)); // Sample ~16 points
    
    for (let i = 0; i < sortedPositions.length; i += step) {
      boundaryPoints.push(sortedPositions[i]);
    }
    
    return boundaryPoints;
  }

  private findBreastApex(breastVertices: VertexAnalysis[]): THREE.Vector3 {
    if (breastVertices.length === 0) {
      return new THREE.Vector3(0, 0, 0);
    }
    
    // Find the most forward-projecting point (highest Z value)
    const apexVertex = breastVertices.reduce((max, vertex) => 
      vertex.position.z > max.position.z ? vertex : max
    );
    
    return apexVertex.position;
  }

  private createColorCodedMesh(originalMesh: THREE.Mesh, vertexAnalysis: VertexAnalysis[]): THREE.Mesh {
    console.log('Creating color-coded mesh for visualization...');
    
    // Clone the geometry properly to preserve structure
    const geometry = originalMesh.geometry.clone();
    const vertexCount = geometry.attributes.position.count;
    
    console.log('Mesh analysis:', {
      vertexCount,
      analysisLength: vertexAnalysis.length,
      hasNormals: !!geometry.attributes.normal,
      hasUVs: !!geometry.attributes.uv
    });
    
    // Ensure we have matching analysis data
    if (vertexAnalysis.length !== vertexCount) {
      console.warn('Vertex count mismatch! Expected:', vertexCount, 'Got:', vertexAnalysis.length);
      
      // Pad analysis with safe defaults if needed
      while (vertexAnalysis.length < vertexCount) {
        vertexAnalysis.push({
          position: new THREE.Vector3(),
          normal: new THREE.Vector3(0, 0, 1),
          curvature: 0,
          isBreastRegion: false,
          isNippleCandidate: false,
          breastSide: undefined
        });
      }
    }
    
    // Create color attribute for vertices
    const colors = new Float32Array(vertexCount * 3);
    
    for (let i = 0; i < vertexCount; i++) {
      const analysis = vertexAnalysis[i];
      let r = 0.7, g = 0.7, b = 0.7; // Default gray
      
      if (analysis && analysis.isNippleCandidate) {
        // Nipples in bright red
        r = 1.0; g = 0.0; b = 0.0;
      } else if (analysis && analysis.isBreastRegion) {
        // Breast regions in different colors
        if (analysis.breastSide === 'left') {
          r = 1.0; g = 0.6; b = 0.8; // Light pink for left
        } else {
          r = 0.8; g = 0.6; b = 1.0; // Light purple for right
        }
      }
      
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Create material that preserves the mesh structure
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: false,
      wireframe: false
    });
    
    // Create the mesh with exact same transforms
    const colorCodedMesh = new THREE.Mesh(geometry, material);
    colorCodedMesh.position.copy(originalMesh.position);
    colorCodedMesh.rotation.copy(originalMesh.rotation);
    colorCodedMesh.scale.copy(originalMesh.scale);
    colorCodedMesh.matrixAutoUpdate = originalMesh.matrixAutoUpdate;
    
    console.log('Color-coded mesh created successfully with', vertexCount, 'vertices');
    console.log('Mesh details:', {
      hasColors: !!geometry.attributes.color,
      position: colorCodedMesh.position,
      scale: colorCodedMesh.scale
    });
    
    return colorCodedMesh;
  }

  private detectBreastAnatomy(boundingBox: THREE.Box3, scene: THREE.Group): AnatomicalLandmarks {
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Detect if this is a female torso by analyzing geometry
    const isLikelyFemaleTorso = this.analyzeBreastGeometry(scene);
    
    if (!isLikelyFemaleTorso) {
      console.warn('Model may not have clear breast anatomy');
    }

    // Enhanced breast-specific landmark detection
    const landmarks: AnatomicalLandmarks = {
      // More accurate nipple detection - look for forward-most breast points
      leftNipple: this.detectNipplePosition(center, size, 'left'),
      rightNipple: this.detectNipplePosition(center, size, 'right'),
      
      // Inframammary fold - lower curve of breast
      leftInframammaryFold: this.detectInframammaryFold(center, size, 'left'),
      rightInframammaryFold: this.detectInframammaryFold(center, size, 'right'),
      
      // Breast apex - highest projection point
      leftBreastApex: this.detectBreastApex(center, size, 'left'),
      rightBreastApex: this.detectBreastApex(center, size, 'right'),
      
      // Chest wall reference
      midChestPoint: new THREE.Vector3(center.x, center.y, center.z - size.z * 0.2),
      
      // Chest wall reference points
      chestWall: [
        new THREE.Vector3(center.x, center.y, center.z - size.z * 0.2),
        new THREE.Vector3(center.x - size.x * 0.3, center.y, center.z - size.z * 0.2),
        new THREE.Vector3(center.x + size.x * 0.3, center.y, center.z - size.z * 0.2)
      ],
      
      // More accurate breast boundaries
      breastBoundaries: {
        left: this.generateBreastBoundary(center, size, 'left'),
        right: this.generateBreastBoundary(center, size, 'right')
      },
      
      // Placeholder for measurements (calculated later)
      measurements: {} as BreastMeasurements
    };

    console.log('Enhanced breast landmarks detected:', landmarks);
    return landmarks;
  }

  private analyzeBreastGeometry(scene: THREE.Group): boolean {
    // Analyze mesh geometry to detect breast-like features
    let hasBreastLikeGeometry = false;
    
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const positions = child.geometry.attributes.position;
        if (positions) {
          // Look for forward-protruding geometry that could be breasts
          // This is a simplified heuristic
          hasBreastLikeGeometry = true;
        }
      }
    });
    
    return hasBreastLikeGeometry;
  }

  private detectNipplePosition(center: THREE.Vector3, size: THREE.Vector3, side: 'left' | 'right'): THREE.Vector3 {
    const sideMultiplier = side === 'left' ? -1 : 1;
    
    // More anatomically accurate nipple positioning
    return new THREE.Vector3(
      center.x + (sideMultiplier * size.x * 0.12), // Slightly wider apart
      center.y - size.y * 0.05, // Slightly below center
      center.z + size.z * 0.35   // Forward projection point
    );
  }

  private detectInframammaryFold(center: THREE.Vector3, size: THREE.Vector3, side: 'left' | 'right'): THREE.Vector3 {
    const sideMultiplier = side === 'left' ? -1 : 1;
    
    return new THREE.Vector3(
      center.x + (sideMultiplier * size.x * 0.15),
      center.y - size.y * 0.25, // Lower than nipple
      center.z + size.z * 0.25   // Less forward than nipple
    );
  }

  private detectBreastApex(center: THREE.Vector3, size: THREE.Vector3, side: 'left' | 'right'): THREE.Vector3 {
    const sideMultiplier = side === 'left' ? -1 : 1;
    
    // Breast apex is the most forward-projecting point
    return new THREE.Vector3(
      center.x + (sideMultiplier * size.x * 0.10),
      center.y - size.y * 0.02, // Slightly above nipple
      center.z + size.z * 0.4    // Maximum forward projection
    );
  }

  private generateBreastBoundary(center: THREE.Vector3, size: THREE.Vector3, side: 'left' | 'right'): THREE.Vector3[] {
    const boundary: THREE.Vector3[] = [];
    const sideMultiplier = side === 'left' ? -1 : 1;
    const baseX = center.x + (sideMultiplier * size.x * 0.15);

    // Generate circular boundary points for breast region
    const radius = size.x * 0.12;
    const segments = 16;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = baseX + Math.cos(angle) * radius;
      const y = center.y - size.y * 0.05 + Math.sin(angle) * radius * 0.8; // Slightly oval
      const z = center.z + size.z * 0.35;

      boundary.push(new THREE.Vector3(x, y, z));
    }

    return boundary;
  }

  private async extractBreastMeshes(scene: THREE.Group, landmarks: AnatomicalLandmarks): Promise<{ left: THREE.Mesh, right: THREE.Mesh }> {
    console.log('Extracting breast meshes...');

    // Find the main mesh in the scene
    let mainMesh: THREE.Mesh | null = null;
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        mainMesh = child;
      }
    });

    if (!mainMesh) {
      throw new Error('No mesh found in the scene');
    }

    // Create breast regions based on landmarks
    const leftBreastMesh = this.createBreastMesh(mainMesh, landmarks.breastBoundaries.left, 'left');
    const rightBreastMesh = this.createBreastMesh(mainMesh, landmarks.breastBoundaries.right, 'right');

    return { left: leftBreastMesh, right: rightBreastMesh };
  }

  private createBreastMesh(originalMesh: THREE.Mesh, boundary: THREE.Vector3[], side: 'left' | 'right'): THREE.Mesh {
    // Create a simplified breast mesh for now
    // In production, this would involve complex mesh segmentation
    
    const geometry = new THREE.SphereGeometry(0.12, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffc0cb,
      transparent: true,
      opacity: 0.7
    });

    const mesh = new THREE.Mesh(geometry, material);
    
    // Position based on landmarks
    const centerX = boundary.reduce((sum, point) => sum + point.x, 0) / boundary.length;
    const centerY = boundary.reduce((sum, point) => sum + point.y, 0) / boundary.length;
    const centerZ = boundary.reduce((sum, point) => sum + point.z, 0) / boundary.length;
    
    mesh.position.set(centerX, centerY, centerZ);
    mesh.userData = { side, isBreastMesh: true };

    return mesh;
  }

  // Method to get implant position at inframammary fold
  getImplantPosition(landmarks: AnatomicalLandmarks, side: 'left' | 'right'): THREE.Vector3 {
    const foldPosition = side === 'left' 
      ? landmarks.leftInframammaryFold 
      : landmarks.rightInframammaryFold;

    // Position implant in front of chest, at the inframammary fold (scaled for model)
    return new THREE.Vector3(
      foldPosition.x,
      foldPosition.y + 0.02, // Slightly above fold
      foldPosition.z + 0.05  // Slightly forward from chest wall
    );
  }

  // Temporary manual landmark detection - more conservative approach
  private createManualLandmarks(mesh: THREE.Mesh): AnatomicalLandmarks {
    const boundingBox = new THREE.Box3().setFromObject(mesh);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    
    console.log('Manual landmark creation:', { center, size });
    
    // More conservative nipple positioning - closer to center
    const nippleHeight = center.y + size.y * 0.1; // Slightly above center
    const nippleForward = center.z + size.z * 0.3; // Not too far forward
    const nippleSpacing = size.x * 0.15; // Closer spacing
    
    const landmarks: AnatomicalLandmarks = {
      leftNipple: new THREE.Vector3(center.x - nippleSpacing, nippleHeight, nippleForward),
      rightNipple: new THREE.Vector3(center.x + nippleSpacing, nippleHeight, nippleForward),
      
      leftInframammaryFold: new THREE.Vector3(center.x - nippleSpacing, center.y - size.y * 0.1, center.z),
      rightInframammaryFold: new THREE.Vector3(center.x + nippleSpacing, center.y - size.y * 0.1, center.z),
      
      leftBreastApex: new THREE.Vector3(center.x - nippleSpacing, nippleHeight, nippleForward),
      rightBreastApex: new THREE.Vector3(center.x + nippleSpacing, nippleHeight, nippleForward),
      
      midChestPoint: new THREE.Vector3(center.x, center.y, center.z - size.z * 0.1),
      
      chestWall: [
        new THREE.Vector3(center.x, center.y, center.z - size.z * 0.1),
        new THREE.Vector3(center.x - size.x * 0.2, center.y, center.z - size.z * 0.1),
        new THREE.Vector3(center.x + size.x * 0.2, center.y, center.z - size.z * 0.1)
      ],
      
      breastBoundaries: {
        left: this.generateBreastBoundary(center, size, 'left'),
        right: this.generateBreastBoundary(center, size, 'right')
      },
      
      measurements: {} as BreastMeasurements
    };
    
    console.log('Created manual landmarks:', landmarks);
    return landmarks;
  }
}


export const anatomicalAnalyzer = new AnatomicalAnalyzer();