import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function Profile() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Profile</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Update your personal information and contact details</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Manage your password and security settings</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}