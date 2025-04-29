import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Pencil, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { ColumnOption } from "@/pages/bookings";
import { supabase } from "@/lib/supabase";

interface Booking {
  id: string;
  customer: string;
  asset: string;
  room: string;
  startDate: string;
  endDate: string;
  price: string;
  totalRevenue: string;
}

interface BookingsTableProps {
  bookings: Booking[];
  selectedColumns: string[];
  columnOptions: ColumnOption[];
  onNewBooking?: () => void;
}

export function BookingsTable({ bookings, selectedColumns, columnOptions, onNewBooking }: BookingsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [password, setPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const DELETE_PASSWORD = "delete123";

  // If there are no bookings, show the empty state
  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 border rounded-lg bg-muted/10">
        <div className="text-center space-y-3">
          <h3 className="text-lg font-semibold">No bookings found</h3>
          <p className="text-muted-foreground">
            Get started by creating your first booking to manage your property rentals.
          </p>
          {onNewBooking && (
            <Button onClick={onNewBooking} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Add Booking
            </Button>
          )}
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(bookings.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentBookings = bookings.slice(startIndex, endIndex);

  const visibleColumns = columnOptions.filter(col => selectedColumns.includes(col.id));

  const totals = currentBookings.reduce(
    (acc, booking) => ({
      totalRevenue: acc.totalRevenue + parseInt(booking.totalRevenue.replace(/[^0-9]/g, '')),
    }),
    { totalRevenue: 0 }
  );

  const handleDeleteClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedBooking) {
      setDeleteDialogOpen(false);
      return;
    }

    if (password !== DELETE_PASSWORD) {
      toast({
        title: "Invalid password",
        description: "Please enter the correct password to delete this booking.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', selectedBooking.id);

      if (error) throw error;

      toast({
        title: "Booking deleted",
        description: `Booking for ${selectedBooking.customer} has been successfully deleted.`,
      });

      setDeleteDialogOpen(false);
      setPassword("");
      setSelectedBooking(null);
      window.location.reload(); // Refresh to update the list
    } catch (error: any) {
      toast({
        title: "Error deleting booking",
        description: error.message || "Failed to delete booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderCell = (booking: Booking, columnId: string) => {
    switch (columnId) {
      case "customer":
        return <TableCell className="font-medium">{booking.customer}</TableCell>;
      case "asset":
        return <TableCell>{booking.asset}</TableCell>;
      case "room":
        return <TableCell>{booking.room}</TableCell>;
      case "startDate":
        return <TableCell>{booking.startDate}</TableCell>;
      case "endDate":
        return <TableCell>{booking.endDate}</TableCell>;
      case "price":
        return <TableCell>{booking.price}</TableCell>;
      case "totalRevenue":
        return <TableCell>{booking.totalRevenue}</TableCell>;
      default:
        return <TableCell>-</TableCell>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg [&_tr]:border-b [&_th]:border-r [&_td]:border-r last:[&_td]:border-r-0 last:[&_th]:border-r-0">
        <Table className="[&_tr:hover]:bg-transparent">
          <TableHeader>
            <TableRow>
              {visibleColumns.map((column) => (
                <TableHead key={column.id}>{column.label}</TableHead>
              ))}
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentBookings.map((booking) => (
              <TableRow key={booking.id}>
                {visibleColumns.map((column) => renderCell(booking, column.id))}
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Button variant="secondary" size="sm">
                      <Pencil className="h-4 w-4" />
                      <span className="ml-2">Edit</span>
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => handleDeleteClick(booking)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-medium">
              <TableCell>Subtotal ({currentBookings.length} items)</TableCell>
              {selectedColumns.includes("asset") && <TableCell></TableCell>}
              {selectedColumns.includes("room") && <TableCell></TableCell>}
              {selectedColumns.includes("startDate") && <TableCell></TableCell>}
              {selectedColumns.includes("endDate") && <TableCell></TableCell>}
              {selectedColumns.includes("price") && <TableCell></TableCell>}
              {selectedColumns.includes("totalRevenue") && <TableCell>€{totals.totalRevenue}</TableCell>}
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
            <SelectTrigger className="w-[70px]">
              <SelectValue>{pageSize}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-6">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Booking</DialogTitle>
            <DialogDescription>
              Enter your password to confirm deletion of booking for {selectedBooking?.customer}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder={DELETE_PASSWORD}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setPassword("");
                  setSelectedBooking(null);
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={!password || isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Booking"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}