import { useState, useCallback } from "react";
import { Upload, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface LocalModelUploadProps {
  onUpload: (modelUrl: string) => void;
}

export const LocalModelUpload = ({ onUpload }: LocalModelUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const validateFile = (file: File): boolean => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const allowedTypes = ['model/gltf-binary', 'application/octet-stream'];
    const allowedExtensions = ['.glb', '.gltf'];

    const hasValidExtension = allowedExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension && !allowedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload a GLB or GLTF model file.",
      });
      return false;
    }

    if (file.size > maxSize) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Please upload a model smaller than 50MB.",
      });
      return false;
    }

    return true;
  };

  const handleFile = useCallback((file: File) => {
    if (!validateFile(file)) return;

    // Create a blob URL for the local file
    const modelUrl = URL.createObjectURL(file);
    setUploadedFile(file);
    onUpload(modelUrl);
    
    toast({
      title: "Model Loaded!",
      description: "Your 3D model has been loaded successfully.",
    });
  }, [onUpload, toast]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    if (uploadedFile) {
      URL.revokeObjectURL(URL.createObjectURL(uploadedFile));
    }
    setUploadedFile(null);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {!uploadedFile ? (
        <div
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
            dragActive 
              ? "border-primary bg-primary/5 scale-105" 
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="model-upload"
            accept=".glb,.gltf"
            onChange={handleInputChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          
          <div className="space-y-4">
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-primary/20 rounded-full">
              <Package className="h-8 w-8 text-primary" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Upload 3D Model</h3>
              <p className="text-sm text-muted-foreground">
                Drag & drop a GLB/GLTF file here, or click to select
              </p>
              <p className="text-xs text-muted-foreground">
                Supports GLB, GLTF (max 50MB)
              </p>
            </div>
            
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => document.getElementById('model-upload')?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Choose Model
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative group p-6 bg-muted/30 rounded-xl border border-border">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              <div className="flex-1">
                <h4 className="font-medium">{uploadedFile.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFile}
                className="opacity-70 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};