import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, Search, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

interface Message {
  id: number;
  from: {
    name: string;
    avatar: string;
  };
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
}

interface Contact {
  id: string;
  name: string;
  avatar: string;
  email: string;
  role: string;
}

export function Inbox() {
  const [messages] = useState<Message[]>([
    {
      id: 1,
      from: {
        name: "John Doe",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=256&h=256&auto=format&fit=crop"
      },
      subject: "Property Inquiry",
      preview: "Hi, I'm interested in booking the downtown apartment...",
      time: "10:30 AM",
      unread: true
    },
    {
      id: 2,
      from: {
        name: "Sarah Smith",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=256&h=256&auto=format&fit=crop"
      },
      subject: "Maintenance Request",
      preview: "The air conditioning unit in room 203 needs attention...",
      time: "Yesterday",
      unread: false
    },
    {
      id: 3,
      from: {
        name: "Mike Johnson",
        avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=256&h=256&auto=format&fit=crop"
      },
      subject: "Booking Confirmation",
      preview: "Your booking for the beach house has been confirmed...",
      time: "2 days ago",
      unread: false
    }
  ]);

  const [contacts] = useState<Contact[]>([
    {
      id: "1",
      name: "John Doe",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=256&h=256&auto=format&fit=crop",
      email: "john.doe@example.com",
      role: "Property Manager"
    },
    {
      id: "2",
      name: "Sarah Smith",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=256&h=256&auto=format&fit=crop",
      email: "sarah.smith@example.com",
      role: "Tenant"
    },
    {
      id: "3",
      name: "Mike Johnson",
      avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=256&h=256&auto=format&fit=crop",
      email: "mike.johnson@example.com",
      role: "Maintenance"
    }
  ]);

  const [showNewMessage, setShowNewMessage] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const filteredContacts = contacts.filter(contact => {
    const search = searchQuery.toLowerCase();
    return (
      contact.name.toLowerCase().includes(search) ||
      contact.email.toLowerCase().includes(search) ||
      contact.role.toLowerCase().includes(search)
    );
  });

  const handleSendMessage = () => {
    if (!selectedContact || !messageContent.trim()) {
      toast({
        title: "Missing information",
        description: "Please select a contact and enter a message",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Message sent",
      description: `Your message has been sent to ${selectedContact.name}`,
    });

    setShowNewMessage(false);
    setSelectedContact(null);
    setMessageContent("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Inbox</h2>
          <p className="text-muted-foreground">
            {messages.filter(m => m.unread).length} unread messages
          </p>
        </div>
        <Button onClick={() => setShowNewMessage(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Message
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {messages.map((message) => (
          <Card 
            key={message.id} 
            className={cn(
              "hover:bg-muted/50 transition-colors cursor-pointer group",
              message.unread && "bg-muted/30"
            )}
          >
            <CardContent className="flex items-center space-x-4 py-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={message.from.avatar} />
                <AvatarFallback>{message.from.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <p className={cn(
                      "font-medium",
                      message.unread && "font-semibold"
                    )}>
                      {message.from.name}
                    </p>
                    {message.unread && (
                      <Badge variant="secondary" className="bg-primary text-primary-foreground">
                        New
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {message.time}
                  </span>
                </div>
                <p className={cn(
                  "text-sm",
                  message.unread ? "font-medium" : "text-muted-foreground"
                )}>
                  {message.subject}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {message.preview}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showNewMessage} onOpenChange={setShowNewMessage}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Command className="rounded-lg border shadow-md">
              <CommandInput 
                placeholder="Search contacts..." 
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandEmpty>No contacts found.</CommandEmpty>
              <CommandGroup className="max-h-[200px] overflow-auto">
                {filteredContacts.map((contact) => (
                  <CommandItem
                    key={contact.id}
                    value={contact.name}
                    onSelect={() => setSelectedContact(contact)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={contact.avatar} />
                        <AvatarFallback>{contact.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <p className="text-sm font-medium">{contact.name}</p>
                        <p className="text-xs text-muted-foreground">{contact.role}</p>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>

            {selectedContact && (
              <div className="flex items-center space-x-2 p-2 rounded-lg bg-muted">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={selectedContact.avatar} />
                  <AvatarFallback>{selectedContact.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="text-sm font-medium">{selectedContact.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedContact.email}</p>
                </div>
              </div>
            )}

            <Textarea
              placeholder="Type your message here..."
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              className="min-h-[150px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewMessage(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendMessage}>
              <Send className="h-4 w-4 mr-2" />
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}