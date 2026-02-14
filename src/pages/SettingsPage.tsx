import { Settings, User, CreditCard, Database, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Profile</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input placeholder="Your name" />
          </div>
          <div className="space-y-2">
            <Label>Base Currency</Label>
            <Input value="GBP" disabled />
          </div>
        </div>
      </section>

      {/* Tax Year */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Tax Year</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tax Year Start</Label>
            <Input value="6 April" disabled />
          </div>
          <div className="space-y-2">
            <Label>ISA Contribution Limit</Label>
            <Input value="£20,000" disabled />
          </div>
        </div>
      </section>

      {/* Data Management */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Data Management</h2>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm">Export All Data</Button>
          <Button variant="destructive" size="sm">Delete All Data</Button>
        </div>
      </section>
    </div>
  );
}
