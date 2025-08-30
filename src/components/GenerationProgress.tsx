import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, CheckCircle2, AlertCircle, X } from "lucide-react";

interface GenerationProgressProps {
  isGenerating: boolean;
  progress: number;
  taskId?: string;
  error?: string;
  onComplete?: (modelUrl: string) => void;
  onCancel?: () => void;
}

export const GenerationProgress = ({ 
  isGenerating, 
  progress, 
  taskId, 
  error,
  onComplete,
  onCancel
}: GenerationProgressProps) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [stage, setStage] = useState<'uploading' | 'processing' | 'finalizing' | 'complete' | 'error'>('uploading');

  useEffect(() => {
    if (isGenerating) {
      setDisplayProgress(progress);
      
      if (progress < 30) {
        setStage('uploading');
      } else if (progress < 80) {
        setStage('processing');
      } else if (progress < 100) {
        setStage('finalizing');
      } else {
        setStage('complete');
      }
    }
    
    if (error) {
      setStage('error');
    }
  }, [isGenerating, progress, error]);

  const getStageText = () => {
    switch (stage) {
      case 'uploading':
        return 'Uploading image...';
      case 'processing':
        return 'Analyzing and generating 3D model...';
      case 'finalizing':
        return 'Finalizing model...';
      case 'complete':
        return 'Model generation complete!';
      case 'error':
        return 'Generation failed';
      default:
        return 'Preparing...';
    }
  };

  const getStageIcon = () => {
    switch (stage) {
      case 'complete':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    }
  };

  if (!isGenerating && !error) {
    return null;
  }

  return (
    <Card className="w-full max-w-md mx-auto p-6 bg-gradient-to-br from-card to-accent/5 border border-border shadow-lg">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {getStageIcon()}
          <div className="flex-1">
            <h3 className="font-medium text-foreground">{getStageText()}</h3>
            {taskId && (
              <p className="text-xs text-muted-foreground">Task ID: {taskId}</p>
            )}
          </div>
          <Sparkles className="h-5 w-5 text-primary opacity-60" />
        </div>

        {stage !== 'error' && (
          <div className="space-y-2">
            <Progress 
              value={displayProgress} 
              className="w-full h-2 bg-muted" 
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{Math.round(displayProgress)}%</span>
              <span>
                {stage === 'complete' ? 'Done' : `${Math.round(displayProgress)}/100`}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {isGenerating && onCancel && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="w-full"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel Generation
          </Button>
        )}

        <div className="text-xs text-muted-foreground text-center">
          {stage === 'complete' 
            ? "Your 3D model is ready! Check the viewer below."
            : stage === 'error' 
              ? "Please try again or check your API key."
              : "This may take a few minutes depending on image complexity."
          }
        </div>
      </div>
    </Card>
  );
};