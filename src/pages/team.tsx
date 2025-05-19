import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Check, X, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface TeamMember {
  id: string;
  full_name: string;
  role_type: string;
}

interface TeamInvite {
  id: string;
  email: string;
  role_type: string;
  status: string;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
}

// Restore color constants
const roleColors = {
  superadmin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  admin: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  viewer: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  expired: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export function Team() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showEditOrg, setShowEditOrg] = useState(false);
  const [showDeleteMember, setShowDeleteMember] = useState(false);
  const [showDeleteInvite, setShowDeleteInvite] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
  const [inviteToDelete, setInviteToDelete] = useState<TeamInvite | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("viewer");
  const [newOrgName, setNewOrgName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [replacementUserId, setReplacementUserId] = useState<string | null>(null);
  const [showReplacementDialog, setShowReplacementDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTeamAndOrg();
  }, []);

  const fetchTeamAndOrg = async () => {
    try {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      setCurrentUserId(user?.id || null);

      // Get current user's role and organization
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role_type, organization_id')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;
      setCurrentUserRole(profile.role_type);

      // Get organization details
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single();

      if (orgError) throw orgError;
      setOrganization(org);
      setNewOrgName(org.name);

      // Get team members with real-time subscription
      const teamMembersSubscription = supabase
        .channel('team-members')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `organization_id=eq.${profile.organization_id}`
        }, () => {
          // Refresh team members when changes occur
          fetchTeamMembers(profile.organization_id);
        })
        .subscribe();

      // Initial fetch of team members
      await fetchTeamMembers(profile.organization_id);

      // Get team invites
      const { data: invites, error: invitesError } = await supabase
        .from('team_invites')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .in('status', ['pending', 'sent', 'expired'])
        .order('created_at', { ascending: false });

      if (invitesError) throw invitesError;
      setTeamInvites(invites || []);

      // Cleanup subscription on component unmount
      return () => {
        teamMembersSubscription.unsubscribe();
      };

    } catch (error: any) {
      console.error('Error fetching team:', error);
      toast({
        title: "Error fetching team",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async (organizationId: string) => {
    const { data: members, error: membersError } = await supabase
      .from('profiles')
      .select('id, full_name, role_type')
      .eq('organization_id', organizationId);

    if (membersError) {
      console.error('Error fetching team members:', membersError);
      return;
    }

    setTeamMembers(members || []);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.rpc('send_team_invites', {
        invites: [{
          email: inviteEmail.trim(),
          role: inviteRole
        }]
      });

      if (error) throw error;

      toast({
        title: "Invitation sent",
        description: `An invitation has been sent to ${inviteEmail}`,
      });

      setShowInvite(false);
      setInviteEmail("");
      setInviteRole("viewer");
      fetchTeamAndOrg(); // Refresh the list
    } catch (error: any) {
      toast({
        title: "Error sending invitation",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateOrganization = async () => {
    if (!newOrgName.trim() || !organization) {
      toast({
        title: "Invalid name",
        description: "Please enter a valid organization name",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('organizations')
        .update({ name: newOrgName.trim() })
        .eq('id', organization.id);

      if (error) throw error;

      toast({
        title: "Organization updated",
        description: "The organization name has been updated successfully",
      });

      setOrganization({ ...organization, name: newOrgName.trim() });
      setShowEditOrg(false);
    } catch (error: any) {
      toast({
        title: "Error updating organization",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('team_invites')
        .update({ status: 'cancelled' })
        .eq('id', inviteId);

      if (error) throw error;

      toast({
        title: "Invite cancelled",
        description: "The team invitation has been cancelled",
      });

      fetchTeamAndOrg(); // Refresh the list
    } catch (error: any) {
      toast({
        title: "Error cancelling invite",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteInvite = async () => {
    if (!inviteToDelete) return;

    setIsSubmitting(true);
    // Log the ID being targeted for deletion
    console.log(`Attempting to delete invite with ID: ${inviteToDelete.id}`);

    try {
      const { error } = await supabase
        .from('team_invites')
        .delete()
        .eq('id', inviteToDelete.id);

      // Log the error object, whether it's null or has content
      console.log('Supabase delete response error:', error);

      if (error) throw error;

      toast({
        title: "Invite deleted",
        description: "The team invitation has been deleted",
      });

      // Log before refreshing
      console.log('Invite deleted successfully, calling fetchTeamAndOrg...');
      setShowDeleteInvite(false);
      setInviteToDelete(null);
      fetchTeamAndOrg(); // Refresh the list
    } catch (error: any) {
      // Log the caught error
      console.error('Error caught during invite deletion:', error);
      toast({
        title: "Error deleting invite",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      // Log when submission state changes
      console.log('Setting isSubmitting to false.');
      setIsSubmitting(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;

    // Prevent deleting yourself
    if (memberToDelete.id === currentUserId) {
      toast({
        title: "Cannot delete yourself",
        description: "You cannot delete your own account",
        variant: "destructive"
      });
      setShowDeleteMember(false);
      setMemberToDelete(null);
      return;
    }

    // Last superadmin check is now handled by the backend function,
    // but we can keep it client-side too for immediate feedback.
    if (memberToDelete.role_type === 'superadmin') {
      const superadmins = teamMembers.filter(m => m.role_type === 'superadmin');
      if (superadmins.length <= 1) {
        toast({
          title: "Cannot delete last superadmin",
          description: "There must be at least one superadmin in the organization",
          variant: "destructive"
        });
        setShowDeleteMember(false);
        setMemberToDelete(null);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Call the RPC function without replacement ID first
      const { error } = await supabase.rpc('remove_team_member', {
        member_id_to_remove: memberToDelete.id
      });

      if (error) {
        // Check if the error indicates replacement is needed
        if (error.message.includes('Replacement user required')) {
          toast({
             title: "Reassignment Required",
             description: `${memberToDelete.full_name} has created items. Please select a replacement owner.`,
             variant: "default",
             duration: 7000
          });
          setShowReplacementDialog(true);
        } else {
          throw error;
        }
      } else {
        toast({
          title: "Member removed",
          description: `Successfully removed ${memberToDelete.full_name} from the organization.`,
        });
        setMemberToDelete(null);
        fetchTeamAndOrg();
      }
    } catch (error: any) {
      console.error("Error removing member:", error);
      toast({
        title: "Error removing member",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive"
      });
      setMemberToDelete(null);
    } finally {
      setShowDeleteMember(false);
      setIsSubmitting(false);
    }
  };

  const handleReplaceAndDelete = async () => {
    if (!memberToDelete || !replacementUserId) return;

    setIsSubmitting(true);

    try {
      // Call the RPC function *with* the replacement ID
      const { error } = await supabase.rpc('remove_team_member', {
        member_id_to_remove: memberToDelete.id,
        replacement_user_id: replacementUserId
      });

      if (error) throw error;

      toast({
        title: "Member Removed and Replaced",
        description: `${memberToDelete.full_name} has been removed and their items reassigned.`,
      });

      setShowReplacementDialog(false);
      setReplacementUserId(null);
      setMemberToDelete(null);
      fetchTeamAndOrg();

    } catch (error: any) {
      console.error("Error replacing and removing member:", error);
      toast({
        title: "Error replacing member",
        description: error.message || "Failed to reassign items and remove member.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canManageTeam = currentUserRole === 'superadmin' || currentUserRole === 'admin';
  const canDeleteMembers = currentUserRole === 'superadmin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-lg font-medium">Loading team...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Team</h2>
          <p className="text-muted-foreground">
            Manage your team members and organization settings
          </p>
        </div>
        {canManageTeam && (
          <Button onClick={() => setShowInvite(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

      <div className="space-y-6">
        <Card className="shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Organization</CardTitle>
                <CardDescription>Your organization details and settings</CardDescription>
              </div>
              {canManageTeam && (
                <Button variant="outline" size="sm" onClick={() => setShowEditOrg(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <dl>
              <div className="grid grid-cols-12">
                <dt className="col-span-3 text-sm font-medium text-muted-foreground">
                  Name
                </dt>
                <dd className="col-span-9 text-sm">
                  {organization?.name}
                </dd>
              </div>
              <div className="grid grid-cols-12 mt-4">
                <dt className="col-span-3 text-sm font-medium text-muted-foreground">
                  Team Size
                </dt>
                <dd className="col-span-9 text-sm">
                  {teamMembers.length} members
                  {teamInvites.filter(invite => invite.status === 'pending').length > 0 && (
                    <span className="text-muted-foreground">
                      {" "}({teamInvites.filter(invite => invite.status === 'pending').length} pending invites)
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                {(canManageTeam || canDeleteMembers) && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>
                          {member.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{member.full_name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className={roleColors[member.role_type as keyof typeof roleColors]}
                    >
                      {member.role_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">Active</Badge>
                  </TableCell>
                  {(canManageTeam || canDeleteMembers) && (
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {canDeleteMembers && member.id !== currentUserId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setMemberToDelete(member);
                              setShowDeleteMember(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {teamInvites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>
                          {invite.email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{invite.email}</div>
                        <div className="text-sm text-muted-foreground">
                          Invited {new Date(invite.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className={roleColors[invite.role_type as keyof typeof roleColors]}
                    >
                      {invite.role_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary"
                      className={statusColors[invite.status as keyof typeof statusColors]}
                    >
                      {invite.status}
                    </Badge>
                  </TableCell>
                  {canManageTeam && (
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {invite.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelInvite(invite.id)}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setInviteToDelete(invite);
                            setShowDeleteInvite(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Send Invite
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditOrg} onOpenChange={setShowEditOrg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Enter organization name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditOrg(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateOrganization} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteMember} onOpenChange={setShowDeleteMember}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {memberToDelete?.full_name} from the organization? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteMember(false);
                setMemberToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteMember}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Member
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReplacementDialog} onOpenChange={setShowReplacementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace Member</DialogTitle>
            <DialogDescription>
              {memberToDelete?.full_name} has created items that need to be reassigned before deletion.
              Please select a team member to take ownership of these items.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Replacement User</Label>
              <RadioGroup
                value={replacementUserId || ""}
                onValueChange={setReplacementUserId}
                className="space-y-2"
              >
                {teamMembers
                  .filter(member => 
                    member.id !== memberToDelete?.id && 
                    ['superadmin', 'admin'].includes(member.role_type)
                  )
                  .map(member => (
                    <div key={member.id} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted">
                      <RadioGroupItem value={member.id} id={member.id} />
                      <Label htmlFor={member.id} className="flex items-center space-x-2 cursor-pointer">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {member.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{member.full_name}</div>
                          <div className="text-sm text-muted-foreground">{member.role_type}</div>
                        </div>
                      </Label>
                    </div>
                  ))}
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowReplacementDialog(false);
                setReplacementUserId(null);
                setMemberToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReplaceAndDelete}
              disabled={isSubmitting || !replacementUserId}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Replacing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Replace and Remove
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteInvite} onOpenChange={setShowDeleteInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invitation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the invitation sent to {inviteToDelete?.email}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteInvite(false);
                setInviteToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteInvite}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Invite
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}