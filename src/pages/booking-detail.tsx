import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Interface for Rent Transaction (based on previous list_tables output)
interface RentTransaction {
  id: string;
  due_date: string;
  amount: number;
  type: 'rent' | 'deposit'; // Based on common values
  status: 'scheduled' | 'processing' | 'paid' | 'failed' | 'paid_manually' | 'pending'; // Based on common values
  stripe_payment_intent_id?: string | null;
  stripe_invoice_id?: string | null;
  created_at: string;
}

// Placeholder for Booking type, adjust based on your actual Booking interface in bookings-table.tsx
interface BookingDetail {
  id: string;
  // asset: string; // Will come from rooms.assets.name
  // room: string;  // Will come from rooms.name
  start_date: string; // Changed from startDate
  end_date: string;   // Changed from endDate
  rent_price: number; // Changed from price, assuming number from DB
  deposit_amount: number; // Added for totalRevenue calculation, assuming number
  // totalRevenue: string; // Will be calculated or ensure it is selected if direct column
  status: string;     // Changed from booking_status
  payment_status?: string | null;
  stripe_payment_intent_id?: string | null;
  // Add other fields as needed, e.g., customer details, user, etc.
  customer_id: string;
  customers?: {
    id: string;
    stripe_mandate_status?: string | null;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone_prefix?: string;
    phone_number?: string;
    // any other customer details you might want to show
  };
  profiles?: {
    id?: string;
    full_name?: string;
    image?: string;
  };
  created_at?: string;
  room_id: string; // FK to rooms
  rooms?: { // To store details from the related room
    id: string;
    name: string;
    asset_id: string; // FK to assets
    assets?: { // To store details from the related asset
        id: string;
        name: string;
    };
  };
  rent_transactions?: RentTransaction[]; // Added for storing related transactions
}

const paymentStatusStyles: { [key: string]: string } = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  paid_manual: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  processing_stripe: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  paid_stripe: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300",
  failed_stripe: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  default: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

// Helper function to format currency (can be moved to utils if used elsewhere)
const formatCurrency = (valueStr: string | number | null | undefined) => {
  if (valueStr === null || valueStr === undefined) return "N/A";
  const num = parseFloat(String(valueStr).replace(/[^0-9.-]+/g, ""));
  if (isNaN(num)) return String(valueStr);
  return `€${num.toFixed(2)}`;
};

export function BookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (bookingId) {
      const fetchBookingDetails = async () => {
        setLoading(true);
        try {
          // Adjust the select query to fetch all necessary details, including related tables if needed
          // For example, fetching customer name from a related 'customers' table
          // or user name from a related 'profiles' table.
          // This example assumes 'customer' is a direct text field.
          // You'll need to adjust if 'customer' is an ID and you need to join.
          const { data, error } = await supabase
            .from("bookings")
            .select(`
              *,
              customers!bookings_customer_id_fkey (id, stripe_mandate_status, first_name, last_name, email, phone_prefix, phone_number),
              profiles!bookings_created_by_fkey (id, full_name),
              rooms!bookings_room_id_fkey (id, name, asset_id, assets!rooms_asset_id_fkey(id, name)),
              rent_transactions!rent_transactions_booking_id_fkey (id, due_date, amount, type, status, stripe_payment_intent_id, stripe_invoice_id, created_at)
            `)
            .eq("id", bookingId)
            .single();

          if (error) {
            console.error("Error fetching booking details (raw):", error); 
            throw error;
          }
          if (data) {
            console.log("Booking data from Supabase:", data); 
            setBooking(data as BookingDetail);
          } else {
            toast({
              title: "Booking not found",
              description: "The requested booking does not exist.",
              variant: "destructive",
            });
            navigate("/bookings"); // Or some other appropriate fallback page
          }
        } catch (error: any) {
          console.error("Error fetching booking details:", error);
          toast({
            title: "Error",
            description: error.message || "Failed to fetch booking details.",
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      };
      fetchBookingDetails();
    } else {
      // Handle case where bookingId is not present, though routing should prevent this
      toast({
        title: "Error",
        description: "Booking ID is missing.",
        variant: "destructive",
      });
      navigate("/bookings");
      setLoading(false);
    }
  }, [bookingId, navigate, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <p className="text-xl">Booking not found.</p>
        <Button onClick={() => navigate("/bookings")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Bookings
        </Button>
      </div>
    );
  }

  // Format dates for display
  const formattedStartDate = booking.start_date ? new Date(booking.start_date).toLocaleDateString() : "N/A";
  const formattedEndDate = booking.end_date ? new Date(booking.end_date).toLocaleDateString() : "N/A";
  const formattedCreatedAt = booking.created_at ? new Date(booking.created_at).toLocaleString() : "N/A";

  // Calculate total revenue (example)
  const totalRevenue = (booking.rent_price || 0) + (booking.deposit_amount || 0);
  const formattedTotalRevenue = formatCurrency(totalRevenue);
  const formattedPrice = formatCurrency(booking.rent_price);

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <Button variant="ghost" onClick={() => navigate("/bookings")} className="mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Bookings
      </Button>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold tracking-tight">
          Booking ID: {booking.id}
        </h2>
        <Badge 
          variant="outline" 
          className={cn(
            "capitalize text-sm px-3 py-1",
            paymentStatusStyles[booking.payment_status as keyof typeof paymentStatusStyles] || paymentStatusStyles.default
          )}
        >
          {booking.payment_status?.replace(/_/g, ' ') || 'Unknown'}
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl md:text-3xl">Booking & Customer Details</CardTitle>
              {/* <CardDescription>Detailed information about the booking and customer.</CardDescription> */}
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 pt-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-lg">Booking Information</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <p className="text-muted-foreground">Customer:</p> 
                  <p className="font-medium">
                    {booking.customers ? `${booking.customers.first_name || ''} ${booking.customers.last_name || ''}`.trim() : 'N/A'}
                  </p>
                  <p className="text-muted-foreground">Asset:</p> <p>{booking.rooms?.assets?.name || 'N/A'}</p>
                  <p className="text-muted-foreground">Room:</p> <p>{booking.rooms?.name || 'N/A'}</p>
                  <p className="text-muted-foreground">Start Date:</p> <p>{formattedStartDate}</p>
                  <p className="text-muted-foreground">End Date:</p> <p>{formattedEndDate}</p>
                  <p className="text-muted-foreground">Price:</p> <p>{formattedPrice}</p>
                  <p className="text-muted-foreground">Total Revenue:</p> <p>{formattedTotalRevenue}</p>
                  <p className="text-muted-foreground">Booking Status:</p> 
                  <p>
                    <Badge variant="secondary" className="capitalize">{booking.status || 'N/A'}</Badge>
                  </p>
                  <p className="text-muted-foreground">Created By:</p> <p>{booking.profiles?.full_name || 'N/A'}</p>
                  <p className="text-muted-foreground">Created At:</p> <p>{formattedCreatedAt}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                 <h4 className="font-semibold text-lg">Payment & Customer</h4>
                 <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <p className="text-muted-foreground">Payment Status:</p> 
                    <p>
                        <Badge 
                        variant="outline" 
                        className={cn(
                            "capitalize",
                            paymentStatusStyles[booking.payment_status as keyof typeof paymentStatusStyles] || paymentStatusStyles.default
                        )}
                        >
                        {booking.payment_status?.replace(/_/g, ' ') || 'Unknown'}
                        </Badge>
                    </p>
                    {booking.stripe_payment_intent_id && (
                        <>
                            <p className="text-muted-foreground">Stripe Payment ID:</p> 
                            <p className="truncate">{booking.stripe_payment_intent_id}</p>
                        </>
                    )}
                    {booking.customers?.stripe_mandate_status && (
                         <>
                            <p className="text-muted-foreground">SEPA Mandate:</p> 
                            <p>
                                <Badge variant={booking.customers.stripe_mandate_status === 'active' ? 'default' : 'destructive'} className="capitalize">
                                    {booking.customers.stripe_mandate_status.replace(/_/g, ' ')}
                                </Badge>
                            </p>
                        </>
                    )}
                 </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>
                List of payment attempts and history for this booking.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {booking.rent_transactions && booking.rent_transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment ID (Stripe)</TableHead>
                      <TableHead>Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {booking.rent_transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>{new Date(tx.due_date).toLocaleDateString()}</TableCell>
                        <TableCell className="capitalize">{tx.type}</TableCell>
                        <TableCell className="text-right">{formatCurrency(tx.amount)}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary"
                            className={cn(
                              "capitalize",
                              paymentStatusStyles[tx.status as keyof typeof paymentStatusStyles] || paymentStatusStyles.default
                            )}
                          >
                            {tx.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="truncate max-w-xs">{tx.stripe_payment_intent_id || tx.stripe_invoice_id || 'N/A'}</TableCell>
                        <TableCell>{new Date(tx.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">No transactions found for this booking.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
    </div>
  );
} 