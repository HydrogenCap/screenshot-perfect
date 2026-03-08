import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} — Portfolio Tracker`;
    return () => { document.title = "Portfolio Tracker"; };
  }, [title]);
}
