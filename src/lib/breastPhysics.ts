import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BreastContour, NippleMarker } from './manualMeasurements';

export interface PhysicsParameters {
  implantSize: number; // Volume in cc
  implantType: 'round' | 'teardrop' | 'gummy';
  implantProfile: 'low' | 'moderate' | 'high' | 'ultra-high';
  tissueElasticity: number; // 0.1 to 1.0
  skinTension: number; // 0.1 to 1.0
  gravityEffect: number; // 0.0 to 1.0
  implantPosition: 'subglandular' | 'submuscular';
}

export interface BreastPhysicsState {
  originalVolume: number;
  currentVolume: number;
  deformationField: Float32Array;
  velocityField: Float32Array;
  pressureField: Float32Array;
}

export class BreastPhysicsEngine {
  private world: CANNON.World;
  private breastBodies: Map<string, CANNON.Body> = new Map();
  private implantBodies: Map<string, CANNON.Body> = new Map();
  private softBodyConstraints: Map<string, CANNON.Constraint[]> = new Map();
  private timeStep = 1/60;
  private running = false;

  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    (this.world.solver as any).iterations = 10;
    
    // Add contact material for breast-implant interaction
    const breastMaterial = new CANNON.Material('breast');
    const implantMaterial = new CANNON.Material('implant');
    
    const breastImplantContact = new CANNON.ContactMaterial(
      breastMaterial,
      implantMaterial,
      {
        friction: 0.3,
        restitution: 0.1,
        contactEquationStiffness: 1e6,
        contactEquationRelaxation: 3
      }
    );
    
    this.world.addContactMaterial(breastImplantContact);
  }

  /**
   * Create soft body physics for breast tissue
   */
  createBreastSoftBody(
    contour: BreastContour,
    nipple: NippleMarker,
    side: 'left' | 'right',
    params: PhysicsParameters
  ): { body: CANNON.Body; mesh: THREE.Mesh; state: BreastPhysicsState } {
    
    // Generate breast mesh from contour
    const breastMesh = this.generateBreastMesh(contour, nipple);
    const geometry = breastMesh.geometry;
    
    // Create physics body
    const shape = this.createSoftBodyShape(geometry, params.tissueElasticity);
    const body = new CANNON.Body({ mass: 1 });
    body.addShape(shape);
    body.position.copy(contour.center as any);
    body.material = new CANNON.Material('breast');
    
    // Add to world
    this.world.addBody(body);
    this.breastBodies.set(side, body);
    
    // Create soft body constraints for deformation
    const constraints = this.createSoftBodyConstraints(body, params);
    this.softBodyConstraints.set(side, constraints);
    
    // Initialize physics state
    const state: BreastPhysicsState = {
      originalVolume: this.calculateMeshVolume(geometry),
      currentVolume: this.calculateMeshVolume(geometry),
      deformationField: new Float32Array(geometry.attributes.position.count * 3),
      velocityField: new Float32Array(geometry.attributes.position.count * 3),
      pressureField: new Float32Array(geometry.attributes.position.count)
    };
    
    return { body, mesh: breastMesh, state };
  }

  /**
   * Add implant with physics simulation
   */
  addImplant(
    position: THREE.Vector3,
    side: 'left' | 'right',
    params: PhysicsParameters
  ): { body: CANNON.Body; mesh: THREE.Mesh } {
    
    const implantGeometry = this.createImplantGeometry(params);
    const implantMesh = new THREE.Mesh(
      implantGeometry,
      new THREE.MeshStandardMaterial({
        color: 0xe6f3ff,
        transparent: true,
        opacity: 0.7,
        metalness: 0.2,
        roughness: 0.3
      })
    );
    
    // Create physics body for implant
    const implantShape = this.createImplantPhysicsShape(params);
    const implantBody = new CANNON.Body({ mass: this.calculateImplantMass(params.implantSize) });
    implantBody.addShape(implantShape);
    implantBody.position.copy(position as any);
    implantBody.material = new CANNON.Material('implant');
    
    // Apply position based on implant placement
    if (params.implantPosition === 'submuscular') {
      implantBody.position.z -= 0.02; // Place behind muscle
    }
    
    this.world.addBody(implantBody);
    this.implantBodies.set(side, implantBody);
    
    return { body: implantBody, mesh: implantMesh };
  }

  /**
   * Start physics simulation
   */
  startSimulation(onUpdate: (states: Map<string, BreastPhysicsState>) => void): void {
    this.running = true;
    
    const simulate = () => {
      if (!this.running) return;
      
      // Step physics simulation
      this.world.step(this.timeStep);
      
      // Update soft body deformations
      const states = new Map<string, BreastPhysicsState>();
      
      for (const [side, body] of this.breastBodies) {
        const state = this.updateBreastDeformation(side, body);
        states.set(side, state);
      }
      
      // Apply implant pressure forces
      this.applyImplantForces();
      
      // Callback with updated states
      onUpdate(states);
      
      requestAnimationFrame(simulate);
    };
    
    simulate();
  }

  /**
   * Stop physics simulation
   */
  stopSimulation(): void {
    this.running = false;
  }

  /**
   * Update implant parameters in real-time
   */
  updateImplantParameters(side: 'left' | 'right', params: PhysicsParameters): void {
    const implantBody = this.implantBodies.get(side);
    if (!implantBody) return;
    
    // Update implant shape and mass
    implantBody.shapes = [];
    const newShape = this.createImplantPhysicsShape(params);
    implantBody.addShape(newShape);
    implantBody.mass = this.calculateImplantMass(params.implantSize);
    implantBody.updateMassProperties();
    
    // Update soft body constraints
    const breastBody = this.breastBodies.get(side);
    if (breastBody) {
      const oldConstraints = this.softBodyConstraints.get(side) || [];
      oldConstraints.forEach(constraint => this.world.removeConstraint(constraint));
      
      const newConstraints = this.createSoftBodyConstraints(breastBody, params);
      this.softBodyConstraints.set(side, newConstraints);
    }
  }

  /**
   * Calculate real-time breast volume
   */
  calculateCurrentVolume(geometry: THREE.BufferGeometry): number {
    const positions = geometry.attributes.position.array;
    const indices = geometry.index?.array;
    
    if (!indices) return 0;
    
    let volume = 0;
    
    // Calculate volume using divergence theorem
    for (let i = 0; i < indices.length; i += 3) {
      const i1 = indices[i] * 3;
      const i2 = indices[i + 1] * 3;
      const i3 = indices[i + 2] * 3;
      
      const v1 = new THREE.Vector3(positions[i1], positions[i1 + 1], positions[i1 + 2]);
      const v2 = new THREE.Vector3(positions[i2], positions[i2 + 1], positions[i2 + 2]);
      const v3 = new THREE.Vector3(positions[i3], positions[i3 + 1], positions[i3 + 2]);
      
      // Calculate signed volume of tetrahedron
      const cross = new THREE.Vector3().crossVectors(v2, v3);
      volume += v1.dot(cross) / 6;
    }
    
    return Math.abs(volume) * 1000000; // Convert to cm³
  }

  private generateBreastMesh(contour: BreastContour, nipple: NippleMarker): THREE.Mesh {
    // Create breast geometry from contour points
    const geometry = new THREE.BufferGeometry();
    
    // Generate vertices from contour
    const vertices: number[] = [];
    const indices: number[] = [];
    
    // Create base from contour vertices
    contour.vertices.forEach((point, i) => {
      vertices.push(point.x, point.y, point.z);
    });
    
    // Add nipple as apex
    vertices.push(nipple.position.x, nipple.position.y, nipple.position.z);
    const nippleIndex = contour.vertices.length;
    
    // Create triangular faces
    for (let i = 0; i < contour.vertices.length; i++) {
      const next = (i + 1) % contour.vertices.length;
      
      // Base triangle
      indices.push(i, next, nippleIndex);
    }
    
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshStandardMaterial({
      color: 0xffb6c1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    
    return new THREE.Mesh(geometry, material);
  }

  private createSoftBodyShape(geometry: THREE.BufferGeometry, elasticity: number): CANNON.Box {
    // Simplified as box shape for now - in real implementation would use ConvexPolyhedron
    const positionAttribute = geometry.attributes.position;
    const box = geometry.boundingBox || new THREE.Box3().setFromBufferAttribute(positionAttribute as THREE.BufferAttribute);
    const size = box.getSize(new THREE.Vector3());
    
    return new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2));
  }

  private createSoftBodyConstraints(body: CANNON.Body, params: PhysicsParameters): CANNON.Constraint[] {
    const constraints: CANNON.Constraint[] = [];
    
    // Create spring constraints for soft body behavior
    const stiffness = params.tissueElasticity * 1000;
    const damping = params.skinTension * 10;
    
    // Add constraints to simulate tissue elasticity
    // This is simplified - real implementation would create mesh of constraints
    
    return constraints;
  }

  private createImplantGeometry(params: PhysicsParameters): THREE.BufferGeometry {
    const volume = params.implantSize; // cc
    const radius = Math.pow(volume * 3 / (4 * Math.PI), 1/3) / 100; // Convert to meters
    
    let geometry: THREE.BufferGeometry;
    
    switch (params.implantType) {
      case 'round':
        geometry = new THREE.SphereGeometry(radius, 16, 16);
        break;
      case 'teardrop':
        geometry = new THREE.SphereGeometry(radius, 16, 16);
        // Modify for teardrop shape
        this.modifyGeometryForTeardrop(geometry);
        break;
      case 'gummy':
        geometry = new THREE.SphereGeometry(radius, 16, 16);
        // Modify for anatomical shape
        this.modifyGeometryForGummy(geometry);
        break;
      default:
        geometry = new THREE.SphereGeometry(radius, 16, 16);
    }
    
    // Apply profile modifications
    this.applyProfileModifications(geometry, params.implantProfile);
    
    return geometry;
  }

  private createImplantPhysicsShape(params: PhysicsParameters): CANNON.Sphere {
    const volume = params.implantSize; // cc
    const radius = Math.pow(volume * 3 / (4 * Math.PI), 1/3) / 100; // Convert to meters
    
    return new CANNON.Sphere(radius);
  }

  private calculateImplantMass(volumeCC: number): number {
    // Silicone density is approximately 0.97 g/cm³
    return (volumeCC * 0.97) / 1000; // Convert to kg
  }

  private updateBreastDeformation(side: string, body: CANNON.Body): BreastPhysicsState {
    // Calculate current deformation state
    const breastMesh = this.breastBodies.get(side);
    if (!breastMesh) {
      return {
        originalVolume: 0,
        currentVolume: 0,
        deformationField: new Float32Array(0),
        velocityField: new Float32Array(0),
        pressureField: new Float32Array(0)
      };
    }
    
    // This would be implemented with actual mesh deformation calculations
    return {
      originalVolume: 0,
      currentVolume: 0,
      deformationField: new Float32Array(0),
      velocityField: new Float32Array(0),
      pressureField: new Float32Array(0)
    };
  }

  private applyImplantForces(): void {
    // Apply forces between implants and breast tissue
    for (const [side, implantBody] of this.implantBodies) {
      const breastBody = this.breastBodies.get(side);
      if (!breastBody) continue;
      
      // Calculate pressure forces
      const distance = implantBody.position.distanceTo(breastBody.position);
      if (distance < 0.1) { // Within influence range
        const direction = new CANNON.Vec3();
        breastBody.position.vsub(implantBody.position, direction);
        direction.normalize();
        
        // Apply expansion force to breast tissue
        const force = direction.scale(implantBody.mass * 100);
        breastBody.applyForce(force, breastBody.position);
      }
    }
  }

  private modifyGeometryForTeardrop(geometry: THREE.BufferGeometry): void {
    const positions = geometry.attributes.position;
    
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      
      if (y < 0) {
        // More volume in lower portion
        positions.setY(i, y * 1.3);
      } else {
        // Less volume in upper portion
        positions.setY(i, y * 0.8);
      }
    }
    
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  private modifyGeometryForGummy(geometry: THREE.BufferGeometry): void {
    const positions = geometry.attributes.position;
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      // Anatomical shaping
      const distanceFromCenter = Math.sqrt(x*x + y*y);
      const radius = Math.sqrt(x*x + y*y + z*z);
      const shapeFactor = 1 - (distanceFromCenter / radius) * 0.2;
      
      positions.setZ(i, z * shapeFactor);
    }
    
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  private applyProfileModifications(geometry: THREE.BufferGeometry, profile: string): void {
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

  private calculateMeshVolume(geometry: THREE.BufferGeometry): number {
    return this.calculateCurrentVolume(geometry);
  }

  /**
   * Clean up physics world
   */
  dispose(): void {
    this.running = false;
    
    // Remove all bodies
    for (const body of this.breastBodies.values()) {
      this.world.removeBody(body);
    }
    for (const body of this.implantBodies.values()) {
      this.world.removeBody(body);
    }
    
    // Remove all constraints
    for (const constraints of this.softBodyConstraints.values()) {
      constraints.forEach(constraint => this.world.removeConstraint(constraint));
    }
    
    this.breastBodies.clear();
    this.implantBodies.clear();
    this.softBodyConstraints.clear();
  }
}