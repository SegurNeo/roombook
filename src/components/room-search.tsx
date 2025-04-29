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

interface RoomSearchProps {
  onSelect: (room: any) => void;
}

export function RoomSearch({ onSelect }: RoomSearchProps) {
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rooms')
        .select(`
          id,
          name,
          capacity,
          location,
          bathroom,
          assets (
            id,
            name
          )
        `)
        .order('name', { ascending: true });

      if (error) throw error;
      setRooms(data || []);
    } catch (error: any) {
      console.error('Error fetching rooms:', error.message);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredRooms = rooms.filter(room => {
    if (!search) return true;
    const searchValue = search.toLowerCase();
    const roomName = room.name.toLowerCase();
    const assetName = room.assets?.name?.toLowerCase() || '';
    return roomName.includes(searchValue) || assetName.includes(searchValue);
  });

  const handleSelect = (currentValue: string) => {
    const room = rooms.find(r => 
      `${r.name} (${r.assets?.name || 'Unknown Asset'})`.toLowerCase() === currentValue.toLowerCase()
    );
    if (room) {
      const roomWithAssetName = {
        ...room,
        asset_name: room.assets?.name || 'Unknown Asset'
      };
      setSelectedRoom(roomWithAssetName);
      onSelect(roomWithAssetName);
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
          className="w-full justify-between"
        >
          {selectedRoom ? (
            `${selectedRoom.name} (${selectedRoom.assets?.name || 'Unknown Asset'})`
          ) : (
            "Select room..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search rooms..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading..." : "No room found."}
            </CommandEmpty>
            <CommandGroup>
              {filteredRooms.map((room) => {
                const value = `${room.name} (${room.assets?.name || 'Unknown Asset'})`;
                return (
                  <CommandItem
                    key={room.id}
                    value={value}
                    onSelect={handleSelect}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedRoom?.id === room.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{room.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {room.assets?.name || 'Unknown Asset'} • {room.capacity} room • {room.bathroom} bathroom
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}