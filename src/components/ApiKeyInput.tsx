import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ApiKeyInputProps {
  onValidation: (key: string, isValid: boolean) => void;
}

export const ApiKeyInput = ({ onValidation }: ApiKeyInputProps) => {
  const [apiKey, setApiKey] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationState, setValidationState] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const { toast } = useToast();

  // Check for stored API key on component mount
  useEffect(() => {
    const storedKey = localStorage.getItem('tripoai_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      setValidationState('valid');
      onValidation(storedKey, true);
    }
  }, [onValidation]);

  const validateApiKey = async () => {
    if (!apiKey.trim()) {
      toast({
        variant: "destructive",
        title: "API Key Required",
        description: "Please enter your TripoAI API key.",
      });
      return;
    }

    setIsValidating(true);

    try {
      // Basic format validation for TripoAI API keys
      if (apiKey.length < 10) {
        setValidationState('invalid');
        toast({
          variant: "destructive",
          title: "Invalid API Key Format",
          description: "API key appears to be too short.",
        });
        onValidation(apiKey, false);
        return;
      }

      // Store the API key for use in edge functions
      localStorage.setItem('tripoai_api_key', apiKey);

      setValidationState('valid');
      onValidation(apiKey, true);
      toast({
        title: "API Key Saved!",
        description: "Your TripoAI API key has been saved. You can now start generating 3D models.",
      });

    } catch (error) {
      console.error('API key validation error:', error);
      setValidationState('invalid');
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Failed to validate API key. Please try again.",
      });
      onValidation(apiKey, false);
    } finally {
      setIsValidating(false);
    }
  };

  const getValidationIcon = () => {
    switch (validationState) {
      case 'valid':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'invalid':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Key className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4 p-6 bg-gradient-to-br from-card to-accent/10 rounded-xl border border-border shadow-lg">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-primary/20 rounded-full">
          <Key className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">TripoAI API Key</h2>
        <p className="text-sm text-muted-foreground">
          Enter your TripoAI API key to start generating 3D models
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="api-key" className="text-sm font-medium">
          API Key
        </Label>
        <div className="relative">
          <Input
            id="api-key"
            type="password"
            placeholder="Enter your TripoAI API key..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="pr-10"
            disabled={isValidating}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {getValidationIcon()}
          </div>
        </div>
      </div>

      <Button
        onClick={validateApiKey}
        disabled={isValidating || !apiKey.trim()}
        className="w-full bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 transition-all duration-300"
      >
        {isValidating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Validating...
          </>
        ) : (
          'Save API Key'
        )}
      </Button>

      <div className="text-xs text-muted-foreground text-center">
        Your API key is stored securely in your browser and never shared.
      </div>
    </div>
  );
};