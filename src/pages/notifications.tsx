import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, MessageSquare, Calendar, Settings } from "lucide-react";

export function Notifications() {
  const notifications = [
    {
      id: 1,
      title: "New Message",
      description: "You have a new message from John Doe",
      icon: MessageSquare,
      time: "5 minutes ago"
    },
    {
      id: 2,
      title: "Booking Update",
      description: "Booking #1234 has been confirmed",
      icon: Calendar,
      time: "1 hour ago"
    },
    {
      id: 3,
      title: "System Update",
      description: "New features have been added to the platform",
      icon: Settings,
      time: "2 hours ago"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Notifications</h2>
        <div className="flex items-center space-x-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {notifications.length} new notifications
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {notifications.map((notification) => (
          <Card key={notification.id} className="hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <CardTitle className="text-base font-medium">
                {notification.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <notification.icon className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm">{notification.description}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {notification.time}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}