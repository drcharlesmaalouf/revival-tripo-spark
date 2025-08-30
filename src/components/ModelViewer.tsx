import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ModelViewerProps {
  modelUrl?: string;
}

export const ModelViewer = ({ modelUrl }: ModelViewerProps) => {
  const { toast } = useToast();

  const downloadModel = async () => {
    if (!modelUrl) {
      toast({
        variant: "destructive",
        title: "No Model Available",
        description: "Please generate a model first.",
      });
      return;
    }

    try {
      const response = await fetch(modelUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `tripo-model-${Date.now()}.glb`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Started",
        description: "Your 3D model is being downloaded.",
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Failed to download the model. Please try again.",
      });
    }
  };

  return (
    <div className="w-full h-96 bg-gradient-to-br from-muted to-accent/10 rounded-xl border border-border flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-4xl">🎯</div>
        <div>
          <h3 className="font-semibold">3D Viewer</h3>
          {modelUrl ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Model ready for download</p>
              <button 
                onClick={downloadModel}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Download Model
              </button>
              <p className="text-xs text-muted-foreground break-all max-w-md">
                URL: {modelUrl}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Generate a model to see it here
            </p>
          )}
        </div>
      </div>
    </div>
  );
};