import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ruler, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ScaleInputProps {
  onScaleSet: (nippleDistance: number) => void;
  currentScale?: number;
}

export const ScaleInput = ({ onScaleSet, currentScale }: ScaleInputProps) => {
  const [nippleDistance, setNippleDistance] = useState(currentScale ? (currentScale * 100).toFixed(1) : '');
  const [isEditing, setIsEditing] = useState(!currentScale);
  const { toast } = useToast();

  const handleSave = () => {
    const distance = parseFloat(nippleDistance);
    
    if (isNaN(distance) || distance < 10 || distance > 30) {
      toast({
        variant: "destructive",
        title: "Invalid Distance",
        description: "Please enter a realistic nipple-to-nipple distance (10-30cm).",
      });
      return;
    }

    onScaleSet(distance / 100); // Convert cm to meters
    setIsEditing(false);
    
    toast({
      title: "Scale Set",
      description: `Using ${distance}cm as reference scale.`,
    });
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-card to-accent/5 border border-border">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Scale Reference</h3>
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="nipple-distance" className="text-xs">
                Nipple-to-nipple distance (cm)
              </Label>
              <Input
                id="nipple-distance"
                type="number"
                placeholder="e.g., 18.5"
                value={nippleDistance}
                onChange={(e) => setNippleDistance(e.target.value)}
                className="text-sm"
                min="10"
                max="30"
                step="0.1"
              />
            </div>
            <Button
              onClick={handleSave}
              size="sm"
              className="w-full"
              disabled={!nippleDistance}
            >
              <Save className="h-3 w-3 mr-1" />
              Set Scale
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Reference: <span className="font-mono text-primary">{nippleDistance}cm</span>
            </div>
            <Button
              onClick={handleEdit}
              variant="outline"
              size="sm"
              className="w-full text-xs"
            >
              Update Scale
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Enter the patient's actual nipple-to-nipple distance for accurate scaling
        </div>
      </div>
    </Card>
  );
};