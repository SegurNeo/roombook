import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";

interface Asset {
  id: string;
  name: string;
}

interface Room {
  id: string;
  name: string;
  capacity: number;
  location: string;
  bathroom: string;
  assets: Asset | Asset[] | null;
  asset_name?: string;
}

interface RoomSearchProps {
  onSelect: (room: Room | null) => void;
}

export function RoomSearch({ onSelect }: RoomSearchProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

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
          assets ( * )
        `)
        .order('name', { ascending: true });

      if (error) throw error;

      const processedRooms = (data || []).map(room => {
        let assetName = 'Unknown Asset';
        const firstAsset = Array.isArray(room.assets) ? room.assets[0] : room.assets;
        if (firstAsset && typeof firstAsset === 'object' && 'name' in firstAsset) {
          assetName = (firstAsset as Asset).name;
        }
        return {
          ...room,
          asset_name: assetName
        };
      });
      setRooms(processedRooms as Room[]);
    } catch (error: any) {
      console.error('Error fetching rooms:', error.message);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (roomId: string) => {
    const selectedRoomObject = rooms.find(r => r.id === roomId) || null;
    setSelectedValue(roomId);
    onSelect(selectedRoomObject);
  };

  const selectedRoomForDisplay = selectedValue
    ? rooms.find(room => room.id === selectedValue)
    : null;

  return (
    <Select
      value={selectedValue || ""}
      onValueChange={handleValueChange}
      disabled={loading}
    >
      <SelectTrigger className="w-full justify-between">
        <SelectValue placeholder={loading ? "Loading rooms..." : "Select room..."}>
          {selectedRoomForDisplay
            ? `${selectedRoomForDisplay.name} (${selectedRoomForDisplay.asset_name || 'Unknown Asset'})`
            : (loading ? "Loading rooms..." : "Select room...")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {rooms.length === 0 && !loading && (
          <div className="p-4 text-sm text-muted-foreground">No rooms found.</div>
        )}
        {rooms.map((room) => (
          <SelectItem key={room.id} value={room.id}>
            <div className="flex flex-col">
              <span>{room.name}</span>
              <span className="text-xs opacity-75">({room.asset_name || 'Unknown Asset'})</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}