import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BreastMeasurements, BreastMeasurementAnalyzer } from '@/lib/breastMeasurements';
import { Ruler, Target, Maximize2 } from 'lucide-react';

interface MeasurementDisplayProps {
  measurements: BreastMeasurements;
  modelScale?: number;
}

export const MeasurementDisplay = ({ measurements, modelScale = 10 }: MeasurementDisplayProps) => {
  const realWorldMeasurements = BreastMeasurementAnalyzer.toRealWorldScale(measurements, modelScale);
  const format = BreastMeasurementAnalyzer.formatMeasurement;

  return (
    <Card className="p-4 bg-gradient-to-br from-card to-accent/5 border border-border">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Ruler className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Breast Measurements</h3>
          <Badge variant="outline" className="text-xs">
            Cup Size: {realWorldMeasurements.averageBreastSize}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {/* Primary Measurements */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="font-medium">Key Measurements</span>
            </div>
            <div className="pl-6 space-y-1 text-muted-foreground">
              <div className="flex justify-between">
                <span>Nipple-to-nipple:</span>
                <span className="font-mono">{format(realWorldMeasurements.nippleToNippleDistance)}</span>
              </div>
              <div className="flex justify-between">
                <span>Inframammary width:</span>
                <span className="font-mono">{format(realWorldMeasurements.inframammaryFoldWidth)}</span>
              </div>
              <div className="flex justify-between">
                <span>Chest wall width:</span>
                <span className="font-mono">{format(realWorldMeasurements.chestWallWidth)}</span>
              </div>
            </div>
          </div>

          {/* Breast Dimensions */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Maximize2 className="h-4 w-4 text-primary" />
              <span className="font-medium">Breast Dimensions</span>
            </div>
            <div className="pl-6 space-y-1 text-muted-foreground">
              <div className="text-xs font-medium text-primary">Left Breast</div>
              <div className="flex justify-between text-xs">
                <span>Width:</span>
                <span className="font-mono">{format(realWorldMeasurements.leftBreastWidth)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Height:</span>
                <span className="font-mono">{format(realWorldMeasurements.leftBreastHeight)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Projection:</span>
                <span className="font-mono">{format(realWorldMeasurements.leftBreastProjection)}</span>
              </div>
              
              <div className="text-xs font-medium text-primary pt-1">Right Breast</div>
              <div className="flex justify-between text-xs">
                <span>Width:</span>
                <span className="font-mono">{format(realWorldMeasurements.rightBreastWidth)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Height:</span>
                <span className="font-mono">{format(realWorldMeasurements.rightBreastHeight)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Projection:</span>
                <span className="font-mono">{format(realWorldMeasurements.rightBreastProjection)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground border-t pt-2">
          <div className="flex justify-between">
            <span>Scale Reference:</span>
            <span>Nipple-to-nipple distance</span>
          </div>
          <div className="flex justify-between">
            <span>Current Cup Size:</span>
            <span className="font-semibold text-primary">{realWorldMeasurements.averageBreastSize} Cup</span>
          </div>
        </div>
      </div>
    </Card>
  );
};