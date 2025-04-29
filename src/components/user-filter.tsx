import { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/lib/supabase";

interface UserFilterProps {
  onSelect: (userId: string | null) => void;
  selectedUserId?: string | null;
}

interface User {
  id: string;
  full_name: string;
}

export function UserFilter({ onSelect, selectedUserId }: UserFilterProps) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      const user = users.find(u => u.id === selectedUserId);
      if (user) {
        setSelectedUser(user);
      }
    }
  }, [selectedUserId, users]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');

      if (error) throw error;
      setUsers(profiles || []);
    } catch (error: any) {
      console.error('Error fetching users:', error.message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    if (!search) return true;
    return user.full_name.toLowerCase().includes(search.toLowerCase());
  });

  const handleSelect = (currentValue: string) => {
    if (currentValue === 'all') {
      setSelectedUser(null);
      onSelect(null);
      setOpen(false);
      return;
    }

    const user = users.find(u => u.full_name.toLowerCase() === currentValue.toLowerCase());
    if (user) {
      setSelectedUser(user);
      onSelect(user.id);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between"
        >
          {selectedUser ? selectedUser.full_name : "Filter by user"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search users..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading..." : "No users found."}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all"
                onSelect={handleSelect}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !selectedUser ? "opacity-100" : "opacity-0"
                  )}
                />
                <span>All users</span>
              </CommandItem>
              {filteredUsers.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.full_name}
                  onSelect={handleSelect}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedUser?.id === user.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span>{user.full_name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}