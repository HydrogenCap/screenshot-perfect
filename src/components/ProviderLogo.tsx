import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Map of normalised provider name substrings → their public domain.
 * Used to derive a favicon URL when no logo_url is stored.
 */
const PROVIDER_DOMAINS: Array<[RegExp, string]> = [
  [/vanguard/i, "vanguard.co.uk"],
  [/hargreaves\s*lansdown|^hl$/i, "hl.co.uk"],
  [/aj\s*bell/i, "ajbell.co.uk"],
  [/fidelity/i, "fidelity.co.uk"],
  [/interactive\s*investor|^ii$/i, "ii.co.uk"],
  [/trading\s*212/i, "trading212.com"],
  [/freetrade/i, "freetrade.io"],
  [/invest\s*engine/i, "investengine.com"],
  [/moneybox/i, "moneyboxapp.com"],
  [/^chip$/i, "chip.co.uk"],
  [/nutmeg/i, "nutmeg.com"],
  [/wealthify/i, "wealthify.com"],
  [/coinbase/i, "coinbase.com"],
  [/binance/i, "binance.com"],
  [/revolut/i, "revolut.com"],
  [/monzo/i, "monzo.com"],
  [/starling/i, "starlingbank.com"],
  [/barclays/i, "barclays.co.uk"],
  [/lloyds/i, "lloydsbank.com"],
  [/^hsbc/i, "hsbc.co.uk"],
  [/natwest/i, "natwest.com"],
  [/nationwide/i, "nationwide.co.uk"],
  [/halifax/i, "halifax.co.uk"],
  [/santander/i, "santander.co.uk"],
  [/first\s*direct/i, "firstdirect.com"],
  [/charles\s*schwab/i, "schwab.com"],
  [/lightyear/i, "lightyear.com"],
  [/etoro/i, "etoro.com"],
  [/degiro/i, "degiro.co.uk"],
  [/saxo/i, "home.saxo"],
  [/ig\s*(group|index|markets)?/i, "ig.com"],
  [/plus500/i, "plus500.com"],
  [/moneyfarm/i, "moneyfarm.com"],
  [/plum/i, "withplum.com"],
  [/octopus/i, "octopusenergy.com"],
];

function getDomain(name: string): string | null {
  for (const [pattern, domain] of PROVIDER_DOMAINS) {
    if (pattern.test(name)) return domain;
  }
  return null;
}

/** Deterministic color from string (stays stable across re-renders) */
function nameToColor(name: string): string {
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-green-500", "bg-amber-500",
    "bg-rose-500", "bg-cyan-500", "bg-pink-500", "bg-orange-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface ProviderLogoProps {
  name: string;
  logoUrl?: string | null;
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function ProviderLogo({ name, logoUrl, size = "sm", className }: ProviderLogoProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const sizeClasses = {
    xs: "h-5 w-5 text-[9px]",
    sm: "h-7 w-7 text-[11px]",
    md: "h-9 w-9 text-sm",
  };

  const domain = getDomain(name);
  const src = logoUrl
    ? logoUrl
    : domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    : null;

  const showFallback = !src || imgFailed;

  return (
    <div
      className={cn(
        "rounded-md flex items-center justify-center shrink-0 overflow-hidden",
        sizeClasses[size],
        showFallback && cn(nameToColor(name), "text-white font-semibold"),
        !showFallback && "bg-muted",
        className
      )}
    >
      {showFallback ? (
        initials(name)
      ) : (
        <img
          src={src!}
          alt={name}
          className="h-full w-full object-contain p-0.5"
          onError={() => setImgFailed(true)}
        />
      )}
    </div>
  );
}
