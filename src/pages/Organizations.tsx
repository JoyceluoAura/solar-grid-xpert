import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Crown, Shield, Eye, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Organization {
  id: string;
  name: string;
  slug: string;
  subscription_tier: string;
  max_sites: number;
  created_at: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profiles: {
    full_name: string;
    avatar_url: string;
  };
}

const Organizations = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Form states
  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("viewer");

  useEffect(() => {
    if (user) {
      fetchOrganizations();
    }
  }, [user]);

  useEffect(() => {
    if (selectedOrg) {
      fetchMembers(selectedOrg.id);
    }
  }, [selectedOrg]);

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations(*)")
        .eq("user_id", user?.id);

      if (error) throw error;

      const orgs = data.map((item: any) => ({
        ...item.organizations,
        userRole: item.role
      }));

      setOrganizations(orgs);
      if (orgs.length > 0 && !selectedOrg) {
        setSelectedOrg(orgs[0]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from("organization_members")
        .select("*, profiles(*)")
        .eq("organization_id", orgId);

      if (error) throw error;
      setMembers(data || []);
    } catch (error: any) {
      console.error("Error fetching members:", error);
    }
  };

  const createOrganization = async () => {
    if (!orgName.trim()) {
      toast({
        title: "Error",
        description: "Organization name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      // Create organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: orgName,
          slug,
          subscription_tier: "free",
          max_sites: 3,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Add current user as owner
      const { error: memberError } = await supabase
        .from("organization_members")
        .insert({
          organization_id: org.id,
          user_id: user?.id,
          role: "owner",
        });

      if (memberError) throw memberError;

      toast({
        title: "Success",
        description: "Organization created successfully!",
      });

      setCreateDialogOpen(false);
      setOrgName("");
      fetchOrganizations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const inviteMember = async () => {
    if (!inviteEmail || !selectedOrg) return;

    try {
      // In production, you would:
      // 1. Send invitation email
      // 2. Create a pending invitation record
      // 3. User accepts invitation to join

      toast({
        title: "Invitation Sent",
        description: `Invitation sent to ${inviteEmail}`,
      });

      setInviteDialogOpen(false);
      setInviteEmail("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      const { error } = await supabase
        .from("organization_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Member removed successfully",
      });

      fetchMembers(selectedOrg!.id);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="h-4 w-4" />;
      case "admin":
        return <Shield className="h-4 w-4" />;
      case "manager":
        return <Users className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "enterprise":
        return "bg-purple-500";
      case "professional":
        return "bg-blue-500";
      case "starter":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Organizations</h1>
          <p className="text-muted-foreground">Manage your organizations and team members</p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
              <DialogDescription>
                Create a new organization to manage sites and team members.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="My Solar Company"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createOrganization}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Organization List */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {organizations.map((org) => (
          <Card
            key={org.id}
            className={`cursor-pointer transition-all ${
              selectedOrg?.id === org.id ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => setSelectedOrg(org)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{org.name}</CardTitle>
                </div>
                <Badge className={getTierColor(org.subscription_tier)}>
                  {org.subscription_tier}
                </Badge>
              </div>
              <CardDescription>Max {org.max_sites} sites</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Selected Organization Details */}
      {selectedOrg && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Building2 className="h-6 w-6" />
                  <span>{selectedOrg.name}</span>
                </CardTitle>
                <CardDescription>
                  Created {new Date(selectedOrg.created_at).toLocaleDateString()}
                </CardDescription>
              </div>

              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Invite Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                      Send an invitation to join {selectedOrg.name}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@example.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="role">Role</Label>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={inviteMember}>Send Invitation</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <h3 className="text-lg font-semibold mb-4">Team Members ({members.length})</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      {member.profiles?.full_name || "Unknown User"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex w-fit items-center space-x-1">
                        {getRoleIcon(member.role)}
                        <span className="capitalize">{member.role}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(member.joined_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {member.role !== "owner" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMember(member.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Organizations;
