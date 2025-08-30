import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MeasurementInputProps {
  onDistanceSubmit: (distance: number) => void;
  currentDistance?: number | null;
}

export const MeasurementInput = ({ 
  onDistanceSubmit, 
  currentDistance 
}: MeasurementInputProps) => {
  const [distance, setDistance] = useState<string>(
    currentDistance?.toString() || ''
  );
  const [error, setError] = useState<string>('');

  const handleSubmit = () => {
    const numericDistance = parseFloat(distance);
    
    if (isNaN(numericDistance) || numericDistance <= 0) {
      setError('Please enter a valid positive number');
      return;
    }
    
    if (numericDistance < 5 || numericDistance > 50) {
      setError('Distance should be between 5-50 cm');
      return;
    }

    setError('');
    onDistanceSubmit(numericDistance);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-sm">Nipple-to-Nipple Distance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="distance" className="text-xs">
            Distance (cm)
          </Label>
          <Input
            id="distance"
            type="number"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g. 18.5"
            className="text-sm"
            min="5"
            max="50"
            step="0.1"
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
        
        <Button 
          onClick={handleSubmit} 
          size="sm" 
          className="w-full"
          disabled={!distance.trim()}
        >
          Set Distance
        </Button>
        
        <p className="text-xs text-muted-foreground">
          Enter the actual nipple-to-nipple distance to calibrate all measurements
        </p>
      </CardContent>
    </Card>
  );
};