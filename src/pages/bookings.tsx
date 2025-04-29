import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Filter, Settings2, Calendar, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookingsTable } from "@/components/bookings-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { UserFilter } from "@/components/user-filter";

interface BookingsProps {
  onNewBooking: () => void;
}

export interface ColumnOption {
  id: string;
  label: string;
  required?: boolean;
}

const columnOptions: ColumnOption[] = [
  { id: "customer", label: "Customer", required: true },
  { id: "asset", label: "Asset", required: true },
  { id: "room", label: "Room" },
  { id: "startDate", label: "Start Date" },
  { id: "endDate", label: "End Date" },
  { id: "price", label: "Price" },
  { id: "totalRevenue", label: "Total Revenue" },
  { id: "user", label: "Created by" },
];

export function Bookings({ onNewBooking }: BookingsProps) {
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
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    columnOptions.filter(col => col.required || ["room", "startDate", "endDate", "price", "totalRevenue", "user"].includes(col.id)).map(col => col.id)
  );
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchBookings();
  }, [selectedUserId]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('bookings')
        .select(`
          id,
          customer_id,
          room_id,
          start_date,
          end_date,
          rent_price,
          deposit_amount,
          status,
          created_by,
          customers (
            first_name,
            last_name
          ),
          rooms (
            name,
            assets (
              name
            )
          ),
          profiles!bookings_created_by_fkey (
            id,
            full_name
          )
        `);

      if (selectedUserId) {
        query = query.eq('created_by', selectedUserId);
      }

      const { data: bookingsData, error } = await query;

      if (error) throw error;

      const transformedBookings = bookingsData?.map(booking => ({
        id: booking.id,
        customer: `${(booking.customers as any)?.first_name || ''} ${(booking.customers as any)?.last_name || ''}`.trim(),
        asset: (booking.rooms as any)?.assets?.name || 'Unknown',
        room: (booking.rooms as any)?.name || 'Unknown',
        startDate: format(new Date(booking.start_date), "PP"),
        endDate: format(new Date(booking.end_date), "PP"),
        price: `€${booking.rent_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        totalRevenue: `€${(booking.rent_price + booking.deposit_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        user: {
          name: (booking.profiles as any)?.full_name || 'Unknown',
          image: `https://api.dicebear.com/7.x/initials/svg?seed=${(booking.profiles as any)?.full_name || 'Unknown'}`
        }
      })) || [];

      setBookings(transformedBookings);
    } catch (error: any) {
      console.error('Error fetching bookings:', error);
      toast({
        title: "Error fetching bookings",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleColumnToggle = (columnId: string) => {
    setSelectedColumns(current => {
      const isSelected = current.includes(columnId);
      const column = columnOptions.find(col => col.id === columnId);
      
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-lg font-medium">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Bookings</h2>
        <Button onClick={onNewBooking}>
          <Plus className="mr-2 h-4 w-4" /> Add booking
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

          <UserFilter
            selectedUserId={selectedUserId}
            onSelect={setSelectedUserId}
          />
        </div>

        <div className="flex space-x-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Import/Export
          </Button>
          <Button variant="outline" onClick={() => setShowColumnSelector(true)}>
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
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Created Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="thisWeek">This Week</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <BookingsTable 
        bookings={bookings} 
        selectedColumns={selectedColumns} 
        columnOptions={columnOptions}
        onNewBooking={onNewBooking}
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Table Columns</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-4">
              {columnOptions.map((column) => (
                <div key={column.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={column.id}
                    checked={selectedColumns.includes(column.id)}
                    onCheckedChange={() => handleColumnToggle(column.id)}
                    disabled={column.required}
                  />
                  <label
                    htmlFor={column.id}
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
          </div>
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