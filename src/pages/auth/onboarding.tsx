import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Loader2, Building2, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { InviteTeam } from "./invite-team";

const roles = [
  {
    id: "property_manager",
    title: "Property Manager",
    description: "I manage properties for owners and handle day-to-day operations",
    icon: Building2,
  },
  {
    id: "landlord",
    title: "Landlord",
    description: "I own properties and rent them out to tenants",
    icon: Building2,
  },
  {
    id: "investor",
    title: "Investor",
    description: "I invest in properties for returns and portfolio growth",
    icon: Building2,
  },
];

const teamSizes = [
  { value: "solo", label: "Just myself" },
  { value: "small", label: "1-5 people" },
  { value: "medium", label: "5-15 people" },
  { value: "large", label: "15+ people" },
];

export function Onboarding() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [teamSize, setTeamSize] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInviteTeam, setShowInviteTeam] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!selectedRole || !teamSize || !orgName.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      if (!user) {
        navigate("/auth/login");
        return;
      }

      const { error } = await supabase.rpc('create_organization_and_update_profile', {
        org_name: orgName.trim(),
        org_role: selectedRole,
        org_team_size: teamSize,
      });

      if (error) throw error;

      setShowInviteTeam(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save your preferences. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  if (showInviteTeam) {
    return (
      <InviteTeam 
        onSkip={() => {
          toast({
            title: "Welcome aboard!",
            description: "Your profile has been set up successfully.",
          });
          navigate("/");
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to PropertyHub</h1>
          <p className="text-muted-foreground">
            Let's personalize your experience. Tell us a bit about yourself.
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">What best describes your role?</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {roles.map((role) => (
                <Card
                  key={role.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedRole === role.id ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => setSelectedRole(role.id)}
                >
                  <CardHeader className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <role.icon className="h-4 w-4" />
                      <CardTitle className="text-lg">{role.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{role.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                placeholder="Enter your organization name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label>How big is your team?</Label>
              <Select value={teamSize || ""} onValueChange={setTeamSize}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select team size" />
                </SelectTrigger>
                <SelectContent>
                  {teamSizes.map((size) => (
                    <SelectItem key={size.value} value={size.value}>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                        {size.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={!selectedRole || !teamSize || !orgName.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up your account...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}