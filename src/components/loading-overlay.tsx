import { Loader2 } from "lucide-react";

interface LoadingOverlayProps {
  loading: boolean;
  message?: string;
}

export function LoadingOverlay({ loading, message = "Loading..." }: LoadingOverlayProps) {
  if (!loading) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-lg font-medium">{message}</p>
      </div>
    </div>
  );
}