import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Pencil, ChevronLeft, ChevronRight, Plus, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { ColumnOption } from "@/pages/bookings";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import React from "react";
import { useNavigate } from "react-router-dom";

interface Booking {
  id: string;
  customer: string;
  customer_details: {
    id: string;
    stripe_mandate_status?: string | null;
  };
  asset: string;
  room: string;
  startDate: string;
  endDate: string;
  price: string;
  totalRevenue: string;
  booking_status: string;
  payment_status?: string | null;
  stripe_payment_intent_id?: string | null;
  user?: {
    name?: string;
    image?: string;
  };
}

interface BookingsTableProps {
  bookings: Booking[];
  selectedColumns: string[];
  columnOptions: ColumnOption[];
  onNewBooking?: () => void;
}

const paymentStatusStyles = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  paid_manual: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  processing_stripe: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  paid_stripe: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300",
  failed_stripe: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  default: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

export function BookingsTable({ bookings, selectedColumns, columnOptions, onNewBooking }: BookingsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [password, setPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // NEW: State for switching booking to manual collection
  const [isSwitchingBookingToManual, setIsSwitchingBookingToManual] = useState<string | null>(null);

  const DELETE_PASSWORD = "delete123";

  // Helper function to format currency
  const formatCurrency = (valueStr: string | number | null | undefined) => {
    if (valueStr === null || valueStr === undefined) return "N/A";
    const num = parseFloat(String(valueStr).replace(/[^0-9.-]+/g, ""));
    if (isNaN(num)) return String(valueStr);
    return `€${num.toFixed(2)}`;
  };

  const handleSwitchBookingCollectionToManual = async (booking: Booking) => {
    if (!booking.id) {
      toast({ title: "Error", description: "Booking ID is missing.", variant: "destructive" });
      return;
    }

    // Check current payment status - adapt this list based on your actual statuses
    const nonSwitchableStatuses = ['pending', 'paid_manual', 'paid_stripe']; // Statuses that shouldn't allow switching
    if (booking.payment_status && nonSwitchableStatuses.includes(booking.payment_status)) {
      toast({
        title: "Action Not Allowed",
        description: `Booking payment status is already '${booking.payment_status}'. Cannot switch to manual.`,
        variant: "default",
      });
      return;
    }

    setIsSwitchingBookingToManual(booking.id);
    try {
      // IMPORTANT CAVEAT:
      // This calls 'switch-transaction-to-manual' with booking.id.
      // If 'switch-transaction-to-manual' strictly expects a rent_transaction_id
      // and uses it to look up a specific rent transaction, this call might fail
      // or not have the intended effect on the entire booking.
      // This assumes the backend function can somehow interpret booking.id to
      // switch the whole booking's collection method to manual.
      const { data, error } = await supabase.functions.invoke(
        'switch-transaction-to-manual', // Using the function name as requested
        { body: { rent_transaction_id: booking.id } } // Passing booking.id as the identifier
      );

      if (error) throw error;

      if (data?.error) { // Handle errors returned successfully from the function
        throw new Error(data.error.details || data.error.message || "Failed to switch booking to manual collection");
      }

      toast({
        title: "Booking Collection Switched",
        description: data?.message || `Booking ${booking.id} switched to manual collection. Associated transactions may be updated.`,
      });
      
      // TODO: Implement a more robust data refresh mechanism instead of a full reload
      window.location.reload();

    } catch (error: any) {
      console.error("Error switching booking to manual collection:", error);
      toast({
        title: "Error Switching Collection Method",
        description: error.message || "Could not switch booking to manual collection.",
        variant: "destructive",
      });
    } finally {
      setIsSwitchingBookingToManual(null);
    }
  };

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
        return <TableCell>{formatCurrency(booking.price)}</TableCell>;
      case "totalRevenue":
        return <TableCell>{formatCurrency(booking.totalRevenue)}</TableCell>;
      case "booking_status":
        return (
          <TableCell>
            <Badge variant="outline" className="capitalize">
              {booking.booking_status || 'N/A'}
            </Badge>
          </TableCell>
        );
      case "payment_status":
        return (
          <TableCell>
            <Badge 
              variant="secondary" 
              className={cn(
                "capitalize",
                paymentStatusStyles[booking.payment_status as keyof typeof paymentStatusStyles] || paymentStatusStyles.default
              )}
            >
              {booking.payment_status?.replace(/_/g, ' ') || 'Unknown'}
            </Badge>
          </TableCell>
        );
      case "payment_type":
        let paymentType = "N/A";
        if (booking.payment_status === "paid_manual") {
          paymentType = "Manual";
        } else if (booking.payment_status?.includes("stripe")) {
          paymentType = "Automático";
        } else if (booking.payment_status === "pending") {
          paymentType = "Pendiente";
        }
        return <TableCell>{paymentType}</TableCell>;
      case "user":
        if (booking.user && typeof booking.user.name === 'string') {
          return <TableCell>{booking.user.name || 'N/A'}</TableCell>;
        }
        return <TableCell>-</TableCell>;
      default:
        const directValue = booking[columnId as keyof Booking];
        if (directValue !== undefined) {
          if (typeof directValue === 'object' && directValue !== null && !React.isValidElement(directValue)) {
            if (columnId === 'customer_details') return <TableCell>-</TableCell>;
            console.warn(`Rendering unexpected object for column ${columnId}, booking ${booking.id}:`, directValue);
            return <TableCell>{'[Object]'}</TableCell>;
          }
          return <TableCell>{String(directValue)}</TableCell>;
        }
        console.warn(`Unhandled columnId: ${columnId} for booking ${booking.id}`);
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
                  <div className="flex items-center space-x-1.5">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      title="Edit Booking"
                      onClick={() => navigate(`/bookings/${booking.id}`)}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    
                    {/* NEW: Switch to Manual Collection Button */}
                    {/* Show button if status allows (e.g., processing_stripe, failed_stripe) */}
                    {/* Adapt these statuses based on your logic */}
                    {['processing_stripe', 'failed_stripe'].includes(booking.payment_status || '') && (
                      <Button
                        variant="outline"
                        size="sm"
                        title="Switch to Manual Collection"
                        onClick={() => handleSwitchBookingCollectionToManual(booking)}
                        disabled={isSwitchingBookingToManual === booking.id}
                      >
                        {isSwitchingBookingToManual === booking.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Switch to Manual
                      </Button>
                    )}

                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDeleteClick(booking)}
                      disabled={isDeleting || isSwitchingBookingToManual === booking.id} // Also disable if switching to manual
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
              {selectedColumns.includes("totalRevenue") && <TableCell>{formatCurrency(totals.totalRevenue)}</TableCell>}
              {selectedColumns.includes("booking_status") && <TableCell></TableCell>}
              {selectedColumns.includes("payment_status") && <TableCell></TableCell>}
              {selectedColumns.includes("payment_type") && <TableCell></TableCell>}
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