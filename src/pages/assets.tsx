import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Filter, Settings2, Calendar, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssetsTable } from "@/components/assets-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { UserFilter } from "@/components/user-filter";

interface AssetsProps {
  onNewAsset: () => void;
}

interface Asset {
  id: string;
  name: string;
  occupancy: number;
  revenue: number;
  avgStay: number;
  totalBookings: number;
  user?: {
    name?: string;
  };
}

export interface ColumnOption {
  id: string;
  label: string;
  required?: boolean;
}

const columnOptions: ColumnOption[] = [
  { id: "name", label: "Asset name", required: true },
  { id: "occupancy", label: "Occupancy %" },
  { id: "revenue", label: "Revenue €" },
  { id: "avgStay", label: "Avg. stay" },
  { id: "totalBookings", label: "Total bookings" },
  { id: "user", label: "User" },
  { id: "location", label: "Location" },
  { id: "type", label: "Property Type" },
  { id: "status", label: "Status" },
  { id: "lastBooking", label: "Last Booking" },
  { id: "nextBooking", label: "Next Booking" },
  { id: "rating", label: "Rating" }
];

const roomColumnOptions: ColumnOption[] = [
  { id: "roomName", label: "Room name", required: true },
  { id: "assetName", label: "Asset name", required: true },
  { id: "capacity", label: "Capacity" },
  { id: "location", label: "Location" },
  { id: "bathroom", label: "Bathroom" },
  { id: "occupancy", label: "Occupancy %" },
  { id: "revenue", label: "Revenue €" },
  { id: "avgStay", label: "Avg. stay" },
  { id: "totalBookings", label: "Total bookings" },
  { id: "status", label: "Status" },
  { id: "nextBooking", label: "Next Booking" },
];

export function Assets({ onNewAsset }: AssetsProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [timePeriod, setTimePeriod] = useState("month");
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });
  const [tempDateRange, setTempDateRange] = useState(dateRange);
  const [activeTab, setActiveTab] = useState("entry");
  const [viewMode, setViewMode] = useState<"assets" | "rooms">("assets");
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    columnOptions.filter(col => col.required || ["occupancy", "revenue", "avgStay", "totalBookings", "user"].includes(col.id)).map(col => col.id)
  );
  const [selectedRoomColumns, setSelectedRoomColumns] = useState<string[]>(
    roomColumnOptions.filter(col => col.required || ["capacity", "location", "bathroom", "occupancy", "revenue"].includes(col.id)).map(col => col.id)
  );
  const [assets, setAssets] = useState<Asset[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [columnSelectorTab, setColumnSelectorTab] = useState<"assets" | "rooms">("assets");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const currentColumnOptions = columnSelectorTab === "assets" ? columnOptions : roomColumnOptions;
  const currentSelectedColumns = columnSelectorTab === "assets" ? selectedColumns : selectedRoomColumns;
  const setCurrentSelectedColumns = columnSelectorTab === "assets" ? setSelectedColumns : setSelectedRoomColumns;

  // Intermediate function for Tabs onValueChange
  const handleTabChange = (value: string) => {
    setColumnSelectorTab(value as "assets" | "rooms");
  };

  useEffect(() => {
    fetchData();
  }, [viewMode, selectedUserId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (viewMode === "assets") {
        let query = supabase
          .from('assets')
          .select(`
            id,
            name,
            address,
            bathrooms,
            photos,
            purchase_price,
            purchase_date,
            management_model,
            monthly_rent,
            management_percentage,
            amenities,
            created_by,
            created_at,
            profiles!assets_created_by_fkey (
              id,
              full_name
            )
          `);

        if (selectedUserId) {
          query = query.eq('created_by', selectedUserId);
        }

        const { data: assetsData, error: assetsError } = await query;

        if (assetsError) throw assetsError;

        const transformedAssets = assetsData.map(asset => ({
          id: asset.id,
          name: asset.name,
          occupancy: Math.floor(Math.random() * 100),
          revenue: asset.monthly_rent || 0,
          avgStay: 0,
          totalBookings: 0,
          user: {
            name: (asset.profiles as any)?.full_name || 'Unknown',
            image: `https://api.dicebear.com/7.x/initials/svg?seed=${(asset.profiles as any)?.full_name || 'Unknown'}`
          }
        }));

        setAssets(transformedAssets);
      } else {
        let query = supabase
          .from('rooms')
          .select(`
            id,
            name,
            capacity,
            location,
            bathroom,
            description,
            photos,
            asset_id,
            created_by,
            assets (
              id,
              name
            ),
            profiles!rooms_created_by_fkey (
              id,
              full_name
            )
          `);

        if (selectedUserId) {
          query = query.eq('created_by', selectedUserId);
        }

        const { data: roomsData, error: roomsError } = await query;

        if (roomsError) throw roomsError;

        const transformedRooms = roomsData.map(room => ({
          id: room.id,
          name: room.name,
          assetName: (room.assets as any)?.name,
          capacity: room.capacity,
          location: room.location,
          bathroom: room.bathroom,
          occupancy: Math.floor(Math.random() * 100),
          revenue: Math.floor(Math.random() * 5000),
          avgStay: Number((Math.random() * 5 + 1).toFixed(1)),
          totalBookings: Math.floor(Math.random() * 50),
          status: Math.random() > 0.5 ? "Available" : "Occupied",
          nextBooking: Math.random() > 0.5 ? format(new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000), "PP") : "-",
          user: {
            name: (room.profiles as any)?.full_name || 'Unknown',
            image: `https://api.dicebear.com/7.x/initials/svg?seed=${(room.profiles as any)?.full_name || 'Unknown'}`
          }
        }));

        setRooms(transformedRooms);
      }
    } catch (error: any) {
      toast({
        title: "Error fetching data",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleColumnToggle = (columnId: string) => {
    setCurrentSelectedColumns(current => {
      const isSelected = current.includes(columnId);
      const column = currentColumnOptions.find(col => col.id === columnId);
      
      if (column?.required) return current;
      
      if (isSelected) {
        return current.filter(id => id !== columnId);
      } else {
        if (current.length >= 10) {
          toast({
            title: "Maximum columns reached",
            description: "You can only select up to 10 columns at a time.",
            variant: "destructive"
          });
          return current;
        }
        return [...current, columnId];
      }
    });
  };

  const handleTimePeriodChange = (value: string) => {
    if (value === "custom") {
      setTempDateRange(dateRange);
      setShowDatePicker(true);
      setActiveTab("entry");
    } else {
      setTimePeriod(value);
      setDateRange({ from: undefined, to: undefined });
    }
  };

  const handleDatePickerClose = () => {
    setShowDatePicker(false);
    setTempDateRange(dateRange);
    setActiveTab("entry");
  };

  const handleApplyDateRange = () => {
    if (tempDateRange.from && tempDateRange.to) {
      setDateRange(tempDateRange);
      setShowDatePicker(false);
      setActiveTab("entry");
    }
  };

  const getSelectedDateRange = () => {
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`;
    }
    return "Custom range";
  };

  const handleDelete = () => {
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-lg font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Assets</h2>
        <Button onClick={onNewAsset}>
          <Plus className="mr-2 h-4 w-4" /> Add asset
        </Button>
      </div>

      <div className="flex justify-between items-center space-x-4">
        <div className="flex items-center space-x-4">
          <Select value={dateRange.from ? "custom" : timePeriod} onValueChange={handleTimePeriodChange}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue>
                {dateRange.from ? getSelectedDateRange() : "Time period"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center space-x-2 border rounded-lg px-3 py-2">
            <span className={`text-sm font-medium ${viewMode === "rooms" ? "text-muted-foreground" : "text-primary"}`}>
              Assets
            </span>
            <Switch
              checked={viewMode === "rooms"}
              onCheckedChange={(checked) => setViewMode(checked ? "rooms" : "assets")}
              className="data-[state=checked]:bg-primary mx-2"
            />
            <span className={`text-sm font-medium ${viewMode === "assets" ? "text-muted-foreground" : "text-primary"}`}>
              Rooms
            </span>
          </div>

          <UserFilter
            selectedUserId={selectedUserId}
            onSelect={setSelectedUserId}
          />
        </div>

        <div className="flex space-x-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Import/Export
          </Button>
          <Button variant="outline" onClick={() => {
            setColumnSelectorTab(viewMode);
            setShowColumnSelector(true);
          }}>
            <Settings2 className="mr-2 h-4 w-4" /> Edit columns
          </Button>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-muted/50 p-4 rounded-lg space-y-4">
          <h3 className="font-medium">Filters</h3>
          <div className="grid grid-cols-3 gap-4">
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Occupancy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High (&gt; 80%)</SelectItem>
                <SelectItem value="medium">Medium (40-80%)</SelectItem>
                <SelectItem value="low">Low (&lt; 40%)</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Revenue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High (&gt; €1000)</SelectItem>
                <SelectItem value="medium">Medium (€500-€1000)</SelectItem>
                <SelectItem value="low">Low (&lt; €500)</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ana">Ana</SelectItem>
                <SelectItem value="john">John</SelectItem>
                <SelectItem value="maria">Maria</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <AssetsTable 
        assets={viewMode === "assets" ? assets : rooms} 
        selectedColumns={currentSelectedColumns} 
        columnOptions={currentColumnOptions}
        onDelete={handleDelete}
        onNewItem={onNewAsset}
        viewMode={viewMode}
      />

      <Dialog open={showDatePicker} onOpenChange={handleDatePickerClose}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Select Date Range</DialogTitle>
          </DialogHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-2 h-9 items-center">
              <TabsTrigger value="entry" className="px-3 text-[13px]">Entry Date</TabsTrigger>
              <TabsTrigger 
                value="finish"
                disabled={!tempDateRange.from}
                className="px-3 text-[13px]"
              >
                Finish Date
              </TabsTrigger>
            </TabsList>
            <TabsContent value="entry" className="mt-2">
              <div className="flex flex-col">
                <div className="text-sm text-muted-foreground mb-2">
                  Select your entry date
                </div>
                <CalendarComponent
                  mode="single"
                  selected={tempDateRange.from}
                  onSelect={(date) => {
                    setTempDateRange(prev => ({ ...prev, from: date || undefined }));
                    if (date) setActiveTab("finish");
                  }}
                  className="rounded-md border w-full [&_.rdp-caption]:text-sm [&_.rdp-head_th]:text-xs [&_.rdp-button]:text-sm [&_.rdp]:w-full [&_.rdp-month]:w-full [&_.rdp-table]:w-full"
                />
              </div>
            </TabsContent>
            <TabsContent value="finish" className="mt-2">
              <div className="flex flex-col">
                <div className="text-sm text-muted-foreground mb-2">
                  Select your finish date
                </div>
                <CalendarComponent
                  mode="single"
                  selected={tempDateRange.to}
                  onSelect={(date) => {
                    setTempDateRange(prev => ({ ...prev, to: date || undefined }));
                  }}
                  fromDate={tempDateRange.from}
                  className="rounded-md border w-full [&_.rdp-caption]:text-sm [&_.rdp-head_th]:text-xs [&_.rdp-button]:text-sm [&_.rdp]:w-full [&_.rdp-month]:w-full [&_.rdp-table]:w-full"
                />
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={handleDatePickerClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleApplyDateRange}
              disabled={!tempDateRange.from || !tempDateRange.to}
            >
              Apply Range
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showColumnSelector} onOpenChange={setShowColumnSelector}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Table Columns</DialogTitle>
          </DialogHeader>
          <Tabs value={columnSelectorTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="assets">Assets View</TabsTrigger>
              <TabsTrigger value="rooms">Rooms View</TabsTrigger>
            </TabsList>
            <TabsContent value="assets" className="mt-4">
              <div className="space-y-4">
                {columnOptions.map((column) => (
                  <div key={column.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`asset-${column.id}`}
                      checked={selectedColumns.includes(column.id)}
                      onCheckedChange={() => handleColumnToggle(column.id)}
                      disabled={column.required}
                    />
                    <label
                      htmlFor={`asset-${column.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {column.label}
                      {column.required && (
                        <span className="ml-2 text-xs text-muted-foreground">(Required)</span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="rooms" className="mt-4">
              <div className="space-y-4">
                {roomColumnOptions.map((column) => (
                  <div key={column.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`room-${column.id}`}
                      checked={selectedRoomColumns.includes(column.id)}
                      onCheckedChange={() => handleColumnToggle(column.id)}
                      disabled={column.required}
                    />
                    <label
                      htmlFor={`room-${column.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {column.label}
                      {column.required && (
                        <span className="ml-2 text-xs text-muted-foreground">(Required)</span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowColumnSelector(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}