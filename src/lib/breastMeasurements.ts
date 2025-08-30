import * as THREE from 'three';

export interface BreastMeasurements {
  nippleToNippleDistance: number;
  leftBreastWidth: number;
  rightBreastWidth: number;
  leftBreastHeight: number;
  rightBreastHeight: number;
  leftBreastProjection: number;
  rightBreastProjection: number;
  inframammaryFoldWidth: number;
  chestWallWidth: number;
  averageBreastSize: 'A' | 'B' | 'C' | 'D' | 'DD' | 'E' | 'F';
}

export interface BreastLandmarks {
  leftNipple: THREE.Vector3;
  rightNipple: THREE.Vector3;
  leftInframammaryFold: THREE.Vector3;
  rightInframammaryFold: THREE.Vector3;
  leftBreastApex: THREE.Vector3;
  rightBreastApex: THREE.Vector3;
  midChestPoint: THREE.Vector3;
  leftBreastBoundary: THREE.Vector3[];
  rightBreastBoundary: THREE.Vector3[];
}

export class BreastMeasurementAnalyzer {
  
  // Calculate comprehensive breast measurements
  static calculateMeasurements(landmarks: BreastLandmarks): BreastMeasurements {
    const nippleDistance = landmarks.leftNipple.distanceTo(landmarks.rightNipple);
    
    // Calculate breast dimensions
    const leftBreastWidth = this.calculateBreastWidth(landmarks.leftBreastBoundary);
    const rightBreastWidth = this.calculateBreastWidth(landmarks.rightBreastBoundary);
    
    const leftBreastHeight = this.calculateBreastHeight(landmarks.leftNipple, landmarks.leftInframammaryFold);
    const rightBreastHeight = this.calculateBreastHeight(landmarks.rightNipple, landmarks.rightInframammaryFold);
    
    const leftProjection = this.calculateProjection(landmarks.leftBreastApex, landmarks.midChestPoint);
    const rightProjection = this.calculateProjection(landmarks.rightBreastApex, landmarks.midChestPoint);
    
    const inframammaryWidth = landmarks.leftInframammaryFold.distanceTo(landmarks.rightInframammaryFold);
    
    // Estimate cup size based on measurements
    const avgProjection = (leftProjection + rightProjection) / 2;
    const cupSize = this.estimateCupSize(avgProjection, nippleDistance);
    
    return {
      nippleToNippleDistance: nippleDistance,
      leftBreastWidth,
      rightBreastWidth,
      leftBreastHeight,
      rightBreastHeight,
      leftBreastProjection: leftProjection,
      rightBreastProjection: rightProjection,
      inframammaryFoldWidth: inframammaryWidth,
      chestWallWidth: nippleDistance * 1.5, // Estimated
      averageBreastSize: cupSize
    };
  }
  
  private static calculateBreastWidth(boundary: THREE.Vector3[]): number {
    if (boundary.length < 2) return 0;
    
    let maxDistance = 0;
    for (let i = 0; i < boundary.length; i++) {
      for (let j = i + 1; j < boundary.length; j++) {
        const distance = boundary[i].distanceTo(boundary[j]);
        maxDistance = Math.max(maxDistance, distance);
      }
    }
    return maxDistance;
  }
  
  private static calculateBreastHeight(nipple: THREE.Vector3, fold: THREE.Vector3): number {
    return Math.abs(nipple.y - fold.y);
  }
  
  private static calculateProjection(apex: THREE.Vector3, chestPoint: THREE.Vector3): number {
    return Math.abs(apex.z - chestPoint.z);
  }
  
  private static estimateCupSize(projection: number, nippleDistance: number): BreastMeasurements['averageBreastSize'] {
    // Scale-aware cup size estimation
    const scale = nippleDistance > 1 ? 10 : 1; // Detect if model is scaled up
    const scaledProjection = projection / scale;
    
    if (scaledProjection < 0.02) return 'A';      // < 2cm
    if (scaledProjection < 0.035) return 'B';     // 2-3.5cm
    if (scaledProjection < 0.05) return 'C';      // 3.5-5cm
    if (scaledProjection < 0.065) return 'D';     // 5-6.5cm
    if (scaledProjection < 0.08) return 'DD';     // 6.5-8cm
    if (scaledProjection < 0.095) return 'E';     // 8-9.5cm
    return 'F';                                   // > 9.5cm
  }
  
  // Convert measurements to real-world scale (accounting for model scaling)
  static toRealWorldScale(measurements: BreastMeasurements, modelScale: number = 1): BreastMeasurements {
    const scale = 1 / modelScale;
    
    return {
      ...measurements,
      nippleToNippleDistance: measurements.nippleToNippleDistance * scale,
      leftBreastWidth: measurements.leftBreastWidth * scale,
      rightBreastWidth: measurements.rightBreastWidth * scale,
      leftBreastHeight: measurements.leftBreastHeight * scale,
      rightBreastHeight: measurements.rightBreastHeight * scale,
      leftBreastProjection: measurements.leftBreastProjection * scale,
      rightBreastProjection: measurements.rightBreastProjection * scale,
      inframammaryFoldWidth: measurements.inframammaryFoldWidth * scale,
      chestWallWidth: measurements.chestWallWidth * scale,
    };
  }
  
  // Format measurements for display
  static formatMeasurement(value: number, unit: 'cm' | 'mm' = 'cm'): string {
    const scaledValue = unit === 'cm' ? value * 100 : value * 1000;
    return `${scaledValue.toFixed(1)}${unit}`;
  }
}