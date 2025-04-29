import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

interface NewAssetRoomsProps {
  onBack: () => void;
  onComplete: (rooms: Array<{
    id: string;
    name: string;
    capacity: "single" | "double";
    location: "exterior" | "interior";
    bathroom: "ensuite" | "shared";
    description?: string;
    photos: File[];
  }>) => void;
  totalRooms: number;
}

interface Room {
  id: string;
  name: string;
  capacity: "single" | "double";
  location: "exterior" | "interior";
  bathroom: "ensuite" | "shared";
  description: string;
  photos: File[];
}

export function NewAssetRooms({ onBack, onComplete, totalRooms }: NewAssetRoomsProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const { toast } = useToast();

  const isCompleteDisabled = useMemo(() => {
    // Check if we have all required rooms
    if (rooms.length < totalRooms) return true;

    // Check if all rooms have required fields filled
    return rooms.some(room => !room.name);
  }, [rooms, totalRooms]);

  const addRoom = () => {
    if (rooms.length >= totalRooms) {
      toast({
        title: "Maximum rooms reached",
        description: `You can only add up to ${totalRooms} rooms`,
        variant: "destructive"
      });
      return;
    }

    const newRoom: Room = {
      id: Date.now().toString(),
      name: "",
      capacity: "single",
      location: "interior",
      bathroom: "shared",
      description: "",
      photos: []
    };
    setRooms([...rooms, newRoom]);
  };

  const updateRoom = (id: string, field: keyof Room, value: any) => {
    setRooms(rooms.map(room => 
      room.id === id ? { ...room, [field]: value } : room
    ));
  };

  const handlePhotosChange = (id: string, files: FileList | null) => {
    if (!files) return;

    const newFiles = Array.from(files);
    if (newFiles.length > 5) {
      toast({
        title: "Too many photos",
        description: "You can only upload up to 5 photos per room",
        variant: "destructive"
      });
      return;
    }

    updateRoom(id, "photos", newFiles);
  };

  const removeRoom = (id: string) => {
    setRooms(rooms.filter(room => room.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(rooms);
  };

  const progress = (rooms.length / totalRooms) * 100;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to general information
      </Button>
      
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Room Configuration</h2>
        <Button onClick={addRoom} disabled={rooms.length >= totalRooms}>
          <Plus className="h-4 w-4 mr-2" />
          Add Room
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Room Progress</span>
          <span>{rooms.length} of {totalRooms} rooms added</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {rooms.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No rooms added yet. Click the "Add Room" button to start.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {rooms.map((room) => (
              <div 
                key={room.id} 
                className="border rounded-lg p-6 space-y-6 relative"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4"
                  onClick={() => removeRoom(room.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`name-${room.id}`}>Room Name</Label>
                    <Input
                      id={`name-${room.id}`}
                      value={room.name}
                      onChange={(e) => updateRoom(room.id, "name", e.target.value)}
                      placeholder="e.g., Master Bedroom"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Capacity</Label>
                    <RadioGroup
                      value={room.capacity}
                      onValueChange={(value) => 
                        updateRoom(room.id, "capacity", value)
                      }
                      className="flex space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="single" id={`single-${room.id}`} />
                        <Label htmlFor={`single-${room.id}`}>Single</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="double" id={`double-${room.id}`} />
                        <Label htmlFor={`double-${room.id}`}>Double</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label>Location</Label>
                    <RadioGroup
                      value={room.location}
                      onValueChange={(value) => 
                        updateRoom(room.id, "location", value)
                      }
                      className="flex space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="exterior" id={`exterior-${room.id}`} />
                        <Label htmlFor={`exterior-${room.id}`}>Exterior</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="interior" id={`interior-${room.id}`} />
                        <Label htmlFor={`interior-${room.id}`}>Interior</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label>Bathroom</Label>
                    <RadioGroup
                      value={room.bathroom}
                      onValueChange={(value) => 
                        updateRoom(room.id, "bathroom", value)
                      }
                      className="flex space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ensuite" id={`ensuite-${room.id}`} />
                        <Label htmlFor={`ensuite-${room.id}`}>En-suite</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="shared" id={`shared-${room.id}`} />
                        <Label htmlFor={`shared-${room.id}`}>Shared</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`description-${room.id}`}>Description (Optional)</Label>
                    <Textarea
                      id={`description-${room.id}`}
                      value={room.description}
                      onChange={(e) => updateRoom(room.id, "description", e.target.value)}
                      placeholder="Describe the room's features, condition, and any special characteristics"
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`photos-${room.id}`}>Room Photos</Label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      <Input
                        id={`photos-${room.id}`}
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handlePhotosChange(room.id, e.target.files)}
                      />
                      <Label
                        htmlFor={`photos-${room.id}`}
                        className="cursor-pointer flex flex-col items-center space-y-2"
                      >
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Click to upload photos (max 5)
                        </span>
                      </Label>
                      {room.photos.length > 0 && (
                        <div className="mt-4 text-sm text-muted-foreground">
                          {room.photos.length} photos selected
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end space-x-4">
          <Button variant="outline" type="button" onClick={onBack}>
            Back
          </Button>
          <Button type="submit" disabled={isCompleteDisabled}>
            Complete
          </Button>
        </div>
      </form>
    </div>
  );
}