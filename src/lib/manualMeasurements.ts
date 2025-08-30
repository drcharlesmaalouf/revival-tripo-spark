import * as THREE from 'three';

export interface NippleMarker {
  position: THREE.Vector3;
  id: 'left' | 'right';
}

export interface BreastContour {
  id: 'left' | 'right';
  vertices: THREE.Vector3[];
  center: THREE.Vector3;
  radius: number;
}

export interface ManualMeasurements {
  leftContour: BreastContour | null;
  rightContour: BreastContour | null;
  leftNipple: NippleMarker | null;
  rightNipple: NippleMarker | null;
  nippleToNippleDistance: number | null; // User-entered measurement in cm
}

export interface CalculatedMeasurements {
  nippleToNippleDistance: number;
  leftBreastDiameter: number;
  rightBreastDiameter: number;
  leftBreastCircumference: number;
  rightBreastCircumference: number;
  projectionLeft: number;
  projectionRight: number;
  symmetryRatio: number;
}

export class ManualMeasurementCalculator {
  
  static calculateBreastDiameter(contour: BreastContour): number {
    if (contour.vertices.length < 3) return 0;
    
    // Find the maximum distance between any two vertices
    let maxDistance = 0;
    for (let i = 0; i < contour.vertices.length; i++) {
      for (let j = i + 1; j < contour.vertices.length; j++) {
        const distance = contour.vertices[i].distanceTo(contour.vertices[j]);
        maxDistance = Math.max(maxDistance, distance);
      }
    }
    
    return maxDistance * 100; // Convert to cm (assuming model units are in meters)
  }
  
  static calculateBreastCircumference(contour: BreastContour): number {
    if (contour.vertices.length < 3) return 0;
    
    let circumference = 0;
    for (let i = 0; i < contour.vertices.length; i++) {
      const nextIndex = (i + 1) % contour.vertices.length;
      circumference += contour.vertices[i].distanceTo(contour.vertices[nextIndex]);
    }
    
    return circumference * 100; // Convert to cm
  }
  
  static calculateProjection(contour: BreastContour, nipple: NippleMarker): number {
    if (!contour || !nipple) return 0;
    
    // Calculate how far the nipple projects from the chest wall
    // This is approximated as the distance from nipple to the contour center
    const projectionDistance = nipple.position.distanceTo(contour.center);
    return projectionDistance * 100; // Convert to cm
  }
  
  static calculateSymmetryRatio(leftDiameter: number, rightDiameter: number): number {
    if (leftDiameter === 0 || rightDiameter === 0) return 0;
    
    const smaller = Math.min(leftDiameter, rightDiameter);
    const larger = Math.max(leftDiameter, rightDiameter);
    
    return (smaller / larger) * 100; // Return as percentage
  }
  
  static calculateAllMeasurements(annotations: ManualMeasurements): CalculatedMeasurements | null {
    if (!annotations.leftContour || !annotations.rightContour || 
        !annotations.leftNipple || !annotations.rightNipple ||
        !annotations.nippleToNippleDistance) {
      return null;
    }
    
    const leftDiameter = this.calculateBreastDiameter(annotations.leftContour);
    const rightDiameter = this.calculateBreastDiameter(annotations.rightContour);
    const leftCircumference = this.calculateBreastCircumference(annotations.leftContour);
    const rightCircumference = this.calculateBreastCircumference(annotations.rightContour);
    const projectionLeft = this.calculateProjection(annotations.leftContour, annotations.leftNipple);
    const projectionRight = this.calculateProjection(annotations.rightContour, annotations.rightNipple);
    const symmetryRatio = this.calculateSymmetryRatio(leftDiameter, rightDiameter);
    
    return {
      nippleToNippleDistance: annotations.nippleToNippleDistance,
      leftBreastDiameter: leftDiameter,
      rightBreastDiameter: rightDiameter,
      leftBreastCircumference: leftCircumference,
      rightBreastCircumference: rightCircumference,
      projectionLeft,
      projectionRight,
      symmetryRatio
    };
  }
  
  static createContourVisualization(contour: BreastContour, color: number): THREE.Group {
    const group = new THREE.Group();
    group.name = `${contour.id}BreastContour`;
    
    // Create line connecting all vertices
    const points = [...contour.vertices, contour.vertices[0]]; // Close the loop
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
      color: color,
      linewidth: 3,
      transparent: true,
      opacity: 0.8
    });
    const line = new THREE.Line(geometry, material);
    group.add(line);
    
    // Create vertex markers
    contour.vertices.forEach((vertex, index) => {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 8, 8),
        new THREE.MeshBasicMaterial({ 
          color: color,
          transparent: true,
          opacity: 0.9
        })
      );
      marker.position.copy(vertex);
      marker.name = `vertex-${index}`;
      group.add(marker);
    });
    
    return group;
  }
  
  static createNippleVisualization(nipple: NippleMarker): THREE.Mesh {
    const color = nipple.id === 'left' ? 0xff1493 : 0x1e90ff; // Pink for left, blue for right
    
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 16, 16),
      new THREE.MeshStandardMaterial({ 
        color: color,
        emissive: color,
        emissiveIntensity: 0.3
      })
    );
    marker.position.copy(nipple.position);
    marker.name = `${nipple.id}Nipple`;
    
    return marker;
  }
}