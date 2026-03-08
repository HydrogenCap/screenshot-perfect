import {
  LayoutDashboard,
  Wallet,
  Receipt,
  Upload,
  BookOpen,
  FileText,
  Settings,
  TrendingUp,
  PoundSterling,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioValue } from "@/hooks/usePortfolioValue";
import { formatCurrency } from "@/lib/format";

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Accounts", url: "/accounts", icon: Wallet },
  { title: "Transactions", url: "/transactions", icon: Receipt },
  { title: "Import CSV", url: "/import", icon: Upload },
  { title: "Instruments", url: "/instruments", icon: BookOpen },
  { title: "CGT Report", url: "/cgt-report", icon: FileText },
];

const secondaryNav = [
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { data: portfolioValue, isLoading } = usePortfolioValue();

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-4 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <PoundSterling className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-sidebar-foreground tracking-tight">
              PortfolioTracker
            </span>
            <span className="text-[11px] text-sidebar-muted">
              Personal Finance
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] font-semibold uppercase tracking-widest px-4">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] font-semibold uppercase tracking-widest px-4">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent px-3 py-2">
          <TrendingUp className="h-4 w-4 text-gain" />
          <div className="flex flex-col">
            <span className="text-[11px] text-sidebar-muted">Portfolio</span>
            {isLoading ? (
              <Skeleton className="h-5 w-24 bg-sidebar-accent" />
            ) : (
              <span className="text-sm font-semibold text-sidebar-foreground">
                {formatCurrency(portfolioValue || 0)}
              </span>
            )}
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
