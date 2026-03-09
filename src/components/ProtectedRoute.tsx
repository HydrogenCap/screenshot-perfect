import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  const { data: onboardingComplete, isLoading: checkingOnboarding } = useQuery({
    queryKey: ["onboarding-status", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("onboarding_complete")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data as any)?.onboarding_complete === true;
    },
    enabled: !!user,
  });

  if (loading || (user && checkingOnboarding)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If onboarding not complete, redirect to /onboarding (unless already there)
  if (!onboardingComplete && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // If onboarding complete but user is on /onboarding, redirect to dashboard
  if (onboardingComplete && location.pathname === "/onboarding") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
