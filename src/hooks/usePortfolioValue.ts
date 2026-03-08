import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function usePortfolioValue() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["portfolio-value"],
    queryFn: async () => {
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id")
        .eq("is_active", true);

      if (!accounts?.length) return 0;

      const { data: valuations } = await supabase
        .from("valuations")
        .select("account_id, total_value, valuation_date")
        .in("account_id", accounts.map(a => a.id))
        .order("valuation_date", { ascending: false });

      const latest: Record<string, number> = {};
      valuations?.forEach(v => {
        if (!(v.account_id in latest)) {
          latest[v.account_id] = v.total_value;
        }
      });

      return Object.values(latest).reduce((sum, v) => sum + v, 0);
    },
    enabled: !!user,
  });
}
