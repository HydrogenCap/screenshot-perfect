import { BookOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Instruments() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Instruments</h1>
        <p className="text-sm text-muted-foreground">
          All securities, funds and assets in your portfolio
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name, ticker or ISIN..." className="pl-9" />
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-20">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <BookOpen className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">No instruments yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Import transactions or add instruments manually to get started.
        </p>
      </div>
    </div>
  );
}
