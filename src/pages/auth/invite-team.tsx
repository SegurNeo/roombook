import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InviteTeamProps {
  onSkip: () => void;
}

interface TeamMember {
  email: string;
  role: string;
}

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "viewer", label: "Viewer" },
];

export function InviteTeam({ onSkip }: InviteTeamProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([{ email: "", role: "" }]);
  const navigate = useNavigate();
  const { toast } = useToast();

  const addTeamMember = () => {
    setTeamMembers([...teamMembers, { email: "", role: "" }]);
  };

  const removeTeamMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  const updateTeamMember = (index: number, field: keyof TeamMember, value: string) => {
    const newTeamMembers = [...teamMembers];
    newTeamMembers[index] = { ...newTeamMembers[index], [field]: value };
    setTeamMembers(newTeamMembers);
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async () => {
    const validTeamMembers = teamMembers.filter(member => member.email && member.role);
    
    if (validTeamMembers.length === 0) {
      onSkip();
      return;
    }

    // Validate emails
    const invalidEmails = validTeamMembers.filter(member => !validateEmail(member.email));
    if (invalidEmails.length > 0) {
      toast({
        title: "Invalid email addresses",
        description: "Please check the email addresses and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.rpc('send_team_invites', {
        invites: validTeamMembers
      });

      if (error) throw error;

      toast({
        title: "Invites sent!",
        description: "Team members will receive an email invitation shortly.",
      });

      navigate("/");
    } catch (error: any) {
      console.error('Error sending invites:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send invites. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Invite Your Team</h1>
          <p className="text-muted-foreground">
            Add team members to collaborate with you on PropertyHub
          </p>
        </div>

        <div className="space-y-6">
          {teamMembers.map((member, index) => (
            <div 
              key={index} 
              className="space-y-4 bg-muted p-4 rounded-lg relative border shadow-sm"
            >
              {index > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2"
                  onClick={() => removeTeamMember(index)}
                  disabled={isSubmitting}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
              
              <div className="space-y-2">
                <Label htmlFor={`email-${index}`}>Email Address</Label>
                <Input
                  id={`email-${index}`}
                  type="email"
                  placeholder="colleague@example.com"
                  value={member.email}
                  onChange={(e) => updateTeamMember(index, "email", e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`role-${index}`}>Role</Label>
                <Select
                  value={member.role}
                  onValueChange={(value) => updateTeamMember(index, "role", value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id={`role-${index}`}>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            className="w-full"
            onClick={addTeamMember}
            disabled={isSubmitting}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Team Member
          </Button>

          <div className="flex space-x-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onSkip}
              disabled={isSubmitting}
            >
              Skip for now
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending invites...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {teamMembers.some(member => member.email && member.role) 
                    ? "Send Invites" 
                    : "Continue"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}