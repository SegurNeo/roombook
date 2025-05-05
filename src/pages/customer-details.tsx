import { useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useFormat } from "@/components/format-provider";
import { formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Phone, Mail, FileText, Building2, Calendar, CreditCard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// --- Simple Error Boundary Component ---
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}
class SimpleErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Error caught by Error Boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        this.props.fallback || (
          <div className="p-4 text-center text-red-600 border border-red-300 rounded-md bg-red-50">
            <h2>Something went wrong rendering customer details.</h2>
            <pre className="text-xs text-left whitespace-pre-wrap">
              {this.state.error?.message}
            </pre>
            <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="mt-2">
              Reload Page
            </Button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
// --- End Error Boundary ---

interface CustomerDetails {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_prefix: string;
  phone_number: string;
  id_number: string;
  id_document: string | null;
  notes: string | null;
  created_at: string;
  payer_type: string | null;
  payer_name: string | null;
  payer_email: string | null;
  payer_phone_prefix: string | null;
  payer_phone_number: string | null;
  payer_id_number: string | null;
  payer_id_document: string | null;
  bookings: Array<{
    id: string;
    start_date: string;
    end_date: string;
    rent_price: number;
    status: string;
    room: {
      name: string;
      asset: {
        name: string;
      };
    };
  }>;
  transactions: Array<{
    id: string;
    due_date: string;
    amount: number;
    type: string;
    status: string;
  }>;
}

export function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useFormat();
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  console.log("Rendering CustomerDetails with ID from params:", id);

  useEffect(() => {
    console.log("useEffect triggered with ID:", id);
    if (id) {
      fetchCustomerDetails();
    } else {
      console.warn("Customer ID is missing in params, skipping fetch.");
      setLoading(false);
    }

    const mandateStatus = searchParams.get('mandate_setup');
    if (mandateStatus) {
      if (mandateStatus === 'success') {
        toast({
          title: "Mandate Setup Initiated",
          description: "Stripe is processing the mandate setup. The status will update shortly.",
          duration: 7000,
        });
      } else if (mandateStatus === 'cancel') {
        toast({
          title: "Mandate Setup Cancelled",
          description: "The mandate setup process was cancelled.",
          variant: "default",
        });
      }
      searchParams.delete('mandate_setup');
      setSearchParams(searchParams, { replace: true });
    }

  }, [id]);

  const fetchCustomerDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          bookings (
            id,
            start_date,
            end_date,
            rent_price,
            status,
            room:rooms (
              name,
              asset:assets (
                name
              )
            )
          ),
          transactions:rent_transactions (
            id,
            due_date,
            amount,
            type,
            status
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.warn(`Customer with ID ${id} not found in database.`);
          setCustomer(null);
        } else {
          throw error;
        }
      } else {
        setCustomer(data);
      }
    } catch (error: any) {
      console.error('Error fetching customer details:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-lg font-medium">Loading customer details...</p>
        </div>
      </div>
    );
  }

  if (!customer && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 p-4">
         <h3 className="text-xl font-semibold">Customer Not Found</h3>
         <p className="text-muted-foreground">Could not find customer with ID '{id}'.</p>
        <Button onClick={() => navigate('/customers')}>Back to customers</Button>
      </div>
    );
  }

  // Customer loaded, render details within Error Boundary
  return (
    <SimpleErrorBoundary>
      {/* Wrap main content in a conditional render based on customer */} 
      {customer ? (
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => navigate('/customers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to customers
          </Button>

          {/* Render details only if customer is guaranteed non-null here */}
          <>
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">
                  {customer.first_name} {customer.last_name}
                </h2>
                <Badge variant="secondary" className="capitalize">
                  {customer.payer_type || 'Person'}
                </Badge>
              </div>

              <Tabs defaultValue="details" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="details">Customer Details</TabsTrigger>
                  <TabsTrigger value="bookings">Bookings</TabsTrigger>
                  <TabsTrigger value="transactions">Transactions</TabsTrigger>
                </TabsList>

                <TabsContent value="details">
                  <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Contact Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{customer.email}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{customer.phone_prefix} {customer.phone_number}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>ID: {customer.id_number}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {customer.payer_type && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Payer Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center space-x-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{customer.payer_name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{customer.payer_email}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{customer.payer_phone_prefix} {customer.payer_phone_number}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span>ID: {customer.payer_id_number}</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {customer.notes && (
                      <Card className="md:col-span-2">
                        <CardHeader>
                          <CardTitle>Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">{customer.notes}</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="bookings">
                  <Card>
                    <CardHeader>
                      <CardTitle>Booking History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {customer.bookings?.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground">No bookings found</p>
                      ) : (
                        <div className="space-y-4">
                          {customer.bookings?.map((booking) => (
                            <div key={booking.id} className="flex items-center justify-between p-4 border rounded-lg">
                              <div className="space-y-1">
                                <p className="font-medium">{booking.room.asset.name} - {booking.room.name}</p>
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <Calendar className="h-4 w-4 mr-2" />
                                  {formatDate(new Date(booking.start_date), settings)} - {formatDate(new Date(booking.end_date), settings)}
                                </div>
                              </div>
                              <div className="flex items-center space-x-4">
                                <div className="text-right">
                                  <p className="font-medium">€{booking.rent_price.toLocaleString()}</p>
                                  <Badge variant="secondary" className="capitalize">{booking.status}</Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="transactions">
                  <Card>
                    <CardHeader>
                      <CardTitle>Transaction History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {customer.transactions?.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground">No transactions found</p>
                      ) : (
                        <div className="space-y-4">
                          {customer.transactions?.map((transaction) => (
                            <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                              <div className="space-y-1">
                                <p className="font-medium capitalize">{transaction.type}</p>
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <Calendar className="h-4 w-4 mr-2" />
                                  Due: {formatDate(new Date(transaction.due_date), settings)}
                                </div>
                              </div>
                              <div className="flex items-center space-x-4">
                                <div className="text-right">
                                  <div className="flex items-center space-x-2">
                                    <CreditCard className="h-4 w-4" />
                                    <p className="font-medium">€{transaction.amount.toLocaleString()}</p>
                                  </div>
                                  <Badge variant="secondary" className="capitalize">{transaction.status}</Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
          </> 
        </div>
       ) : ( 
         // Render nothing or a placeholder if customer became null unexpectedly 
         // This case should ideally not be hit due to earlier checks, but satisfies TS 
         null 
       )} 
    </SimpleErrorBoundary>
  );
}