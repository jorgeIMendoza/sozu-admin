import { useQuery } from "@tanstack/react-query";
import { Building, ChevronsUpDown, Check } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LS_KEY = "sozu.crm.orgId";

type Org = { id: string; name: string; slug: string };

export function CrmOrgSwitcher({ className }: { className?: string }) {
  const { user } = useAuth();

  const { data: orgs = [] } = useQuery<Org[]>({
    queryKey: ["crm-orgs-list", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Try user_organizations with joined org data
      const { data: uo } = await (supabase as any)
        .from("user_organizations")
        .select("organization_id, organizations(id, name, slug)")
        .eq("user_id", user!.id);
      if (uo?.length) {
        return uo.map((r: any) => r.organizations).filter(Boolean) as Org[];
      }
      // Fallback for super admin: all orgs
      const { data: all } = await (supabase as any)
        .from("organizations")
        .select("id, name, slug")
        .eq("active", true)
        .order("name");
      return (all ?? []) as Org[];
    },
  });

  const storedId = localStorage.getItem(LS_KEY);
  const currentOrg = orgs.find(o => o.id === storedId) ?? orgs[0] ?? null;

  function switchOrg(org: Org) {
    if (org.id === currentOrg?.id) return;
    localStorage.setItem(LS_KEY, org.id);
    window.location.reload();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("gap-2 font-medium max-w-[220px] justify-start", className)}>
          <Building className="h-4 w-4 shrink-0" />
          <span className="truncate">{currentOrg?.name ?? "Organización"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel>Organizaciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Sin organizaciones</div>
        )}
        {orgs.map(org => (
          <DropdownMenuItem key={org.id} onClick={() => switchOrg(org)}>
            <span className="flex-1 truncate">{org.name}</span>
            {currentOrg?.id === org.id && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
