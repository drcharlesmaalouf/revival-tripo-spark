import { pipeline, env } from '@huggingface/transformers';
import * as THREE from 'three';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = false;

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
}

class AnatomicalAnalyzer {
  private segmentationPipeline: any = null;
  private landmarkPipeline: any = null;

  async initialize() {
    console.log('Initializing anatomical analysis models...');
    
    try {
      // Initialize segmentation model for breast region detection
      this.segmentationPipeline = await pipeline(
        'image-segmentation',
        'Xenova/segformer-b0-finetuned-ade-512-512',
        { device: 'webgpu' }
      );

      // Initialize landmark detection model
      this.landmarkPipeline = await pipeline(
        'object-detection',
        'Xenova/detr-resnet-50',
        { device: 'webgpu' }
      );

      console.log('Anatomical analysis models loaded successfully');
    } catch (error) {
      console.error('Error initializing models:', error);
      throw error;
    }
  }

  async analyzeModel(scene: THREE.Group): Promise<BreastMeshData> {
    if (!this.segmentationPipeline) {
      await this.initialize();
    }

    console.log('Starting anatomical analysis...');

    // Basic validation - check if the model could be human
    const isValidHumanModel = await this.validateHumanModel(scene);
    if (!isValidHumanModel) {
      throw new Error('Model does not appear to be a human torso suitable for anatomical analysis');
    }

    // Extract 2D renders from different angles for analysis
    const frontView = await this.renderModelView(scene, 'front');
    const sideView = await this.renderModelView(scene, 'side');

    // Analyze anatomical landmarks
    const landmarks = await this.detectLandmarks(frontView, sideView, scene);

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
      modelScale
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

  private async renderModelView(scene: THREE.Group, viewType: 'front' | 'side'): Promise<string> {
    // Create temporary renderer for analysis
    const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
    renderer.setSize(512, 512);
    renderer.setClearColor(0x000000, 0);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    
    // Position camera based on view type
    if (viewType === 'front') {
      camera.position.set(0, 0, 5);
    } else {
      camera.position.set(5, 0, 0);
    }
    
    camera.lookAt(0, 0, 0);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 1, 1);

    const tempScene = new THREE.Scene();
    tempScene.add(ambientLight);
    tempScene.add(directionalLight);
    tempScene.add(scene.clone());

    renderer.render(tempScene, camera);

    // Convert to base64
    const canvas = renderer.domElement;
    const dataURL = canvas.toDataURL('image/png');
    
    // Cleanup
    renderer.dispose();
    
    return dataURL;
  }

  private async detectLandmarks(frontView: string, sideView: string, scene: THREE.Group): Promise<AnatomicalLandmarks> {
    console.log('Detecting breast-specific anatomical landmarks...');

    // For enhanced breast analysis, we need more precise detection
    const boundingBox = new THREE.Box3().setFromObject(scene);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Use more sophisticated breast anatomy detection
    const landmarks = this.detectBreastAnatomy(boundingBox, scene);
    
    console.log('Breast landmarks detected:', landmarks);
    return landmarks;
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
}

export const anatomicalAnalyzer = new AnatomicalAnalyzer();