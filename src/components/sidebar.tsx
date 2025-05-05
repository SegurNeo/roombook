import { Home, Users, Calendar, Settings, Bell, BarChart3, CreditCard, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
// import { Button } from "@/components/ui/button"; // Removed unused import
import { Separator } from "@/components/ui/separator";
import { ProfileMenu } from "@/components/profile-menu";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { NavLink } from "react-router-dom";

interface SidebarProps { }

export function Sidebar({ }: SidebarProps) {
  const [orgName, setOrgName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchOrgName = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single();

        if (!profile?.organization_id) return;

        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', profile.organization_id)
          .single();

        if (org) setOrgName(org.name);
      } catch (error) {
        console.error('Error fetching organization:', error);
      }
    };

    fetchOrgName();

    const channel = supabase
      .channel('org_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'organizations'
        },
        (payload) => {
          if (payload.new && 'name' in payload.new) {
            setIsLoading(true);
            setOrgName(payload.new.name as string);
            setTimeout(() => setIsLoading(false), 500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const mySpaceItems = [
    { id: 'notifications', path: '/notifications', label: 'Notifications', icon: Bell },
    { id: 'report', path: '/report', label: 'Report', icon: BarChart3 },
  ];

  const menuItems = [
    { id: 'assets', path: '/assets', label: 'Assets', icon: Home },
    { id: 'customers', path: '/customers', label: 'Customers', icon: Users },
    { id: 'bookings', path: '/bookings', label: 'Bookings', icon: Calendar },
    { id: 'rent-check', path: '/rent-check', label: 'Rent Check', icon: CreditCard },
    { id: 'team', path: '/team', label: 'Team', icon: UserPlus },
  ];

  const bottomItems = [
    { id: 'settings', path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="w-64 border-r bg-card">
      <div className="flex h-full flex-col">
        {orgName && (
          <div className="px-6 py-5 border-b">
            <div className="flex items-center space-x-2">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              <h2 className="text-lg font-semibold truncate" title={orgName}>
                {orgName}
              </h2>
            </div>
          </div>
        )}
        <div className="space-y-4 py-4 flex-1 overflow-y-auto">
          <div className="px-3 py-2">
            <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
              My Space
            </h2>
            <div className="space-y-1">
              {mySpaceItems.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      "w-full justify-start flex items-center px-4 py-2 rounded-md text-sm font-medium",
                      isActive
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )
                  }
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="px-3 py-2">
            <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
              Management
            </h2>
            <div className="space-y-1">
              {menuItems.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      "w-full justify-start flex items-center px-4 py-2 rounded-md text-sm font-medium",
                      isActive
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )
                  }
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
        <div>
          <Separator />
          <div className="p-3 space-y-1">
            {bottomItems.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "w-full justify-start flex items-center px-4 py-2 rounded-md text-sm font-medium",
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
            <ProfileMenu />
          </div>
        </div>
      </div>
    </div>
  );
}