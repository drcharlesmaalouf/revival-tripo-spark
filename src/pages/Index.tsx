import { useState, useEffect } from "react";
import { ApiKeyInput } from "@/components/ApiKeyInput";
import { ImageUpload } from "@/components/ImageUpload";
import { LocalModelUpload } from "@/components/LocalModelUpload";
import { ModelViewer } from "@/components/ModelViewer";
import { GenerationProgress } from "@/components/GenerationProgress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Box, Upload, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GenerationState {
  isGenerating: boolean;
  progress: number;
  taskId?: string;
  modelUrl?: string;
  error?: string;
}

const Index = () => {
  const [apiKey, setApiKey] = useState("");
  const [isApiKeyValid, setIsApiKeyValid] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imageToken, setImageToken] = useState<string | null>(null);
  const [generation, setGeneration] = useState<GenerationState>({
    isGenerating: false,
    progress: 0,
  });
  const { toast } = useToast();

  // Check for stored API key on component mount
  useEffect(() => {
    // Check for stored API key
    const storedKey = localStorage.getItem('tripoai_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      setIsApiKeyValid(true);
    }
  }, []);

  const handleApiKeyValidation = async (key: string, isValid: boolean) => {
    setApiKey(key);
    setIsApiKeyValid(isValid);
  };

  const handleImageUpload = async (file: File) => {
    setUploadedImage(file);

    try {
      // Upload image to TripoAI via edge function
      const formData = new FormData();
      formData.append('image', file);
      formData.append('api_key', apiKey);

      const { data, error } = await supabase.functions.invoke('upload-image', {
        body: formData,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.token) {
        setImageToken(data.token);
        toast({
          title: "Image Uploaded!",
          description: "Your image has been uploaded successfully. Ready to generate 3D model.",
        });
      }
    } catch (error) {
      console.error('Image upload error:', error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
      });
    }
  };

  const handleGenerate3D = async () => {
    if (!imageToken || !apiKey) {
      toast({
        variant: "destructive",
        title: "Missing Requirements",
        description: "Please upload an image and ensure your API key is valid.",
      });
      return;
    }

    setGeneration({
      isGenerating: true,
      progress: 0,
      error: undefined,
    });

    try {
      // Start generation via edge function
      const { data, error } = await supabase.functions.invoke('generate-3d', {
        body: {
          image_token: imageToken,
          api_key: apiKey,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.task_id) {
        setGeneration(prev => ({
          ...prev,
          taskId: data.task_id,
          progress: 10,
        }));

        // Poll for generation status
        pollGenerationStatus(data.task_id);
      }
    } catch (error) {
      console.error('Generation error:', error);
      setGeneration({
        isGenerating: false,
        progress: 0,
        error: error instanceof Error ? error.message : 'Failed to start generation',
      });
    }
  };

  const pollGenerationStatus = async (taskId: string) => {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    const poll = async () => {
      attempts++;
      
      try {
        const { data, error } = await supabase.functions.invoke('check-status', {
          body: {
            task_id: taskId,
            api_key: apiKey,
          },
        });

        if (error) {
          throw new Error(error.message);
        }

        const { status, progress, model_url, error: generationError } = data;

        setGeneration(prev => ({
          ...prev,
          progress: progress || prev.progress + 5,
        }));

        if (status === 'success' && model_url) {
          setGeneration({
            isGenerating: false,
            progress: 100,
            taskId,
            modelUrl: model_url,
          });
          
          toast({
            title: "Model Generated!",
            description: "Your 3D model has been generated successfully.",
          });
          return;
        }

        if (status === 'failed' || generationError) {
          throw new Error(generationError || 'Generation failed');
        }

        if (status === 'running' && attempts < maxAttempts) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else if (attempts >= maxAttempts) {
          throw new Error('Generation timeout - please try again');
        }
      } catch (error) {
        console.error('Status polling error:', error);
        setGeneration({
          isGenerating: false,
          progress: 0,
          taskId,
          error: error instanceof Error ? error.message : 'Status check failed',
        });
      }
    };

    // Initial delay before first poll
    setTimeout(poll, 3000);
  };

  const handleLocalModelUpload = (modelUrl: string) => {
    setGeneration({
      isGenerating: false,
      progress: 100,
      modelUrl,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-primary-glow/20 blur-3xl"></div>
        <div className="relative container mx-auto px-4 py-12 text-center">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Box className="h-10 w-10 text-primary" />
              <h1 className="text-4xl lg:text-6xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                Tripo Sculpt
              </h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Transform any image into stunning 3D models with AI-powered generation. 
              Upload your image and watch it come to life in three dimensions.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-12 space-y-8">
        {/* API Key Section */}
        {!isApiKeyValid && (
          <div className="flex justify-center">
            <ApiKeyInput onValidation={handleApiKeyValidation} />
          </div>
        )}

        {/* Upload and Generation Section */}
        {isApiKeyValid && (
          <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Left Column - Controls */}
            <div className="space-y-6">
              <Card className="p-6 bg-gradient-to-br from-card to-accent/5 border border-border shadow-xl">
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-semibold mb-2">Create 3D Model</h2>
                    <p className="text-muted-foreground">
                      Upload an image to generate a 3D model with AI
                    </p>
                  </div>

                  <ImageUpload onUpload={handleImageUpload} />

                  {uploadedImage && imageToken && (
                    <Button
                      onClick={handleGenerate3D}
                      disabled={generation.isGenerating}
                      className="w-full bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 transition-all duration-300"
                      size="lg"
                    >
                      {generation.isGenerating ? (
                        <>
                          <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate 3D Model
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </Card>

              {/* Local Model Upload */}
              <Card className="p-6 bg-gradient-to-br from-card to-accent/5 border border-border shadow-xl">
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">Upload Local Model</h3>
                    <p className="text-sm text-muted-foreground">
                      Or upload your own GLB/GLTF file to view
                    </p>
                  </div>
                  <LocalModelUpload onUpload={handleLocalModelUpload} />
                </div>
              </Card>

              {/* Generation Progress */}
              {(generation.isGenerating || generation.error) && (
                <GenerationProgress
                  isGenerating={generation.isGenerating}
                  progress={generation.progress}
                  taskId={generation.taskId}
                  error={generation.error}
                />
              )}
            </div>

            {/* Right Column - 3D Viewer */}
            <div className="space-y-6">
              <Card className="p-6 bg-gradient-to-br from-card to-accent/5 border border-border shadow-xl">
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">3D Model Viewer</h3>
                    <p className="text-sm text-muted-foreground">
                      {generation.modelUrl 
                        ? "Interact with your 3D model below" 
                        : "Your generated model will appear here"
                      }
                    </p>
                  </div>
                  <ModelViewer modelUrl={generation.modelUrl} />
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
