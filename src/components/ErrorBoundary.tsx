import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="rounded-xl border bg-card p-8 max-w-md text-center space-y-4">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            {import.meta.env.DEV && this.state.error && (
              <p className="text-sm text-muted-foreground font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
