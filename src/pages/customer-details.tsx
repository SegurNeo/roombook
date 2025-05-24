import { useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useFormat } from "@/components/format-provider";
import { formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Phone, Mail, FileText, Building2, Calendar, CreditCard, Plus, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loadStripe } from "@stripe/stripe-js";

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
  stripe_customer_id?: string | null;
  stripe_payment_method_id?: string | null;
  stripe_mandate_status?: string | null;
  customer_payment_methods?: Array<{
    id: string;
    stripe_payment_method_id: string;
    stripe_mandate_status: string;
    payment_method_type: string;
    is_default: boolean;
    nickname: string;
    last_four?: string;
    created_at: string;
  }>;
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
  
  // Payment method action states
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [deletingPaymentMethodId, setDeletingPaymentMethodId] = useState<string | null>(null);
  const [syncingWithStripe, setSyncingWithStripe] = useState(false);
  
  // Edit payment method dialog states
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<{
    id: string;
    nickname: string;
  } | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);

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
          title: "Processing Payment Method...",
          description: "Please wait while we update your payment method information.",
          duration: 10000,
        });
        if (id) {
          // Poll for updates since webhook processing takes time
          pollForPaymentMethodUpdates();
        }
      } else if (mandateStatus === 'cancel') {
        toast({
          title: "Mandate Setup Cancelled",
          description: "The mandate setup process was cancelled.",
          variant: "default",
        });
      }
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('mandate_setup');
      setSearchParams(newSearchParams, { replace: true });
    }

  }, [id, searchParams, setSearchParams, toast]);

  // Function to poll for payment method updates after Stripe checkout
  const pollForPaymentMethodUpdates = async () => {
    if (!id) return;
    
    // Get initial payment methods count
    const initialData = customer?.customer_payment_methods?.length || 0;
    
    let attempts = 0;
    const maxAttempts = 12; // 12 attempts × 2.5s = 30 seconds max
    
    const checkForUpdates = async (): Promise<void> => {
      try {
        attempts++;
        console.log(`Polling attempt ${attempts}/${maxAttempts} for payment method updates...`);
        
        const { data, error } = await supabase
          .from('customers')
          .select(`
            customer_payment_methods!customer_payment_methods_customer_id_fkey (
              id,
              stripe_payment_method_id,
              stripe_mandate_status,
              payment_method_type,
              is_default,
              nickname,
              last_four,
              created_at
            )
          `)
          .eq('id', id)
          .single();

        if (error) {
          console.error('Error polling for updates:', error);
          return;
        }

        const currentCount = data?.customer_payment_methods?.length || 0;
        
        // Check if payment methods have been updated
        if (currentCount > initialData) {
          console.log(`Payment method update detected! Count: ${initialData} → ${currentCount}`);
          
          // Refresh full customer data
          await fetchCustomerDetails();
          
          toast({
            title: "Payment Method Added Successfully!",
            description: "Your new payment method has been configured and is ready to use.",
            variant: "default",
          });
          
          return; // Stop polling
        }
        
        // Continue polling if no changes and haven't reached max attempts
        if (attempts < maxAttempts) {
          setTimeout(() => checkForUpdates(), 2500); // Wait 2.5 seconds before next attempt
        } else {
          console.log('Polling timeout reached. Refreshing data anyway...');
          await fetchCustomerDetails();
          
          toast({
            title: "Payment Method Processing",
            description: "Your payment method is being processed. It may take a few minutes to appear.",
            variant: "default",
          });
        }
        
      } catch (error) {
        console.error('Error in polling check:', error);
        // On error, just refresh the data once
        await fetchCustomerDetails();
      }
    };
    
    // Start polling after initial delay to allow webhook processing
    setTimeout(() => checkForUpdates(), 2000);
  };

  const fetchCustomerDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          stripe_customer_id,
          stripe_payment_method_id, 
          stripe_mandate_status,
          customer_payment_methods!customer_payment_methods_customer_id_fkey (
            id,
            stripe_payment_method_id,
            stripe_mandate_status,
            payment_method_type,
            is_default,
            nickname,
            last_four,
            created_at
          ),
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

  // Function to set a payment method as default
  const handleSetAsDefault = async (paymentMethodId: string) => {
    if (!customer?.id) return;
    
    setSettingDefaultId(paymentMethodId);
    
    try {
      const { error } = await supabase
        .from('customer_payment_methods')
        .update({ is_default: true })
        .eq('id', paymentMethodId);

      if (error) throw error;

      toast({
        title: "Payment Method Set as Default",
        description: "The payment method has been set as default successfully.",
      });

      // Refresh customer data
      await fetchCustomerDetails();
    } catch (error: any) {
      console.error('Error setting payment method as default:', error);
      toast({
        title: "Error",
        description: error.message || "Could not update default payment method.",
        variant: "destructive"
      });
    } finally {
      setSettingDefaultId(null);
    }
  };

  // Function to sync customer with Stripe
  const handleSyncWithStripe = async () => {
    if (!customer?.id) return;
    
    setSyncingWithStripe(true);
    
    try {
      console.log(`Syncing customer ${customer.id} with Stripe`);
      
      const { data, error: functionError } = await supabase.functions.invoke(
        'create-stripe-customer',
        { 
          body: { 
            record: {
              id: customer.id,
              first_name: customer.first_name,
              last_name: customer.last_name,
              email: customer.email,
              phone_prefix: customer.phone_prefix,
              phone_number: customer.phone_number,
              payer_type: customer.payer_type,
              notes: customer.notes
            }
          } 
        }
      );

      if (functionError) {
        console.error("Stripe sync error:", functionError);
        throw new Error(functionError.message || "Error syncing with payment system.");
      }

      if (data?.error) {
        console.error("Function returned error:", data.error);
        throw new Error(data.error.details || data.error || "Error syncing with payment system.");
      }

      toast({
        title: "Customer Synced",
        description: `${customer.first_name} ${customer.last_name} has been synced successfully with the payment system.`,
      });

      // Refresh customer data
      await fetchCustomerDetails();
    } catch (error: any) {
      console.error("Error syncing customer with Stripe:", error);
      
      toast({
        title: "Sync Error",
        description: error.message || "Could not sync customer with payment system.",
        variant: "destructive",
      });
    } finally {
      setSyncingWithStripe(false);
    }
  };

  // Function to setup payment method
  const handleSetupPaymentMethod = async () => {
    if (!customer?.id || !customer.stripe_customer_id) {
      console.error("Cannot setup payment method - missing data:", {
        customerId: customer?.id,
        stripeCustomerId: customer?.stripe_customer_id,
        hasCustomer: !!customer
      });
      toast({
        title: "Error",
        description: "Customer data is incomplete. Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      console.log(`Requesting payment method setup for customer:`, {
        id: customer.id,
        stripe_customer_id: customer.stripe_customer_id,
        name: `${customer.first_name} ${customer.last_name}`
      });
      
      const { data, error: functionError } = await supabase.functions.invoke(
        'create-sepa-setup-session',
        { 
          body: { 
            supabase_customer_id: customer.id,
            success_url: `${window.location.origin}/customers/${customer.id}?mandate_setup=success`,
            cancel_url: `${window.location.origin}/customers/${customer.id}?mandate_setup=cancel`
          } 
        }
      );

      if (functionError) {
        console.error("Supabase function error:", functionError);
        console.error("Full function error details:", {
          message: functionError.message,
          status: functionError.status,
          statusText: functionError.statusText,
          details: functionError.details
        });
        throw new Error(functionError.message || "Error creating payment method setup session.");
      }

      if (data?.error) {
        console.error("Function returned error:", data.error);
        console.error("Full data response:", data);
        throw new Error(data.error || "Error creating payment method setup session.");
      }

      const { sessionId } = data;
      if (!sessionId) {
        throw new Error("No session ID received from server.");
      }

      // Redirect to Stripe Checkout
      const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');
      if (!stripe) {
        throw new Error("Error loading payment system.");
      }

      const { error: redirectError } = await stripe.redirectToCheckout({ sessionId });

      if (redirectError) {
        console.error("Payment system redirection error:", redirectError);
        throw new Error(redirectError.message || "Error redirecting to payment system.");
      }

    } catch (error: any) {
      console.error("Error during payment method setup:", error);
      
      toast({
        title: "Setup Error",
        description: error.message || "Could not start payment method setup.",
        variant: "destructive",
      });
    }
  };

  // Function to delete payment method
  const handleDeletePaymentMethod = async (paymentMethodId: string, nickname: string) => {
    if (!customer?.id) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the payment method "${nickname}"?\n\nThis action cannot be undone.`
    );
    
    if (!confirmDelete) return;
    
    setDeletingPaymentMethodId(paymentMethodId);
    
    try {
      const { error } = await supabase
        .from('customer_payment_methods')
        .delete()
        .eq('id', paymentMethodId);

      if (error) throw error;

      toast({
        title: "Payment Method Deleted",
        description: `The payment method "${nickname}" has been deleted successfully.`,
      });

      // Refresh customer data
      await fetchCustomerDetails();
    } catch (error: any) {
      console.error('Error deleting payment method:', error);
      toast({
        title: "Error",
        description: error.message || "Could not delete payment method.",
        variant: "destructive"
      });
    } finally {
      setDeletingPaymentMethodId(null);
    }
  };

  // Function to open edit dialog
  const handleEditPaymentMethod = (paymentMethod: { id: string; nickname: string }) => {
    setEditingPaymentMethod(paymentMethod);
    setEditNickname(paymentMethod.nickname);
  };

  // Function to save nickname
  const handleSaveNickname = async () => {
    if (!editingPaymentMethod || !editNickname.trim()) return;
    
    setSavingNickname(true);
    
    try {
      const { error } = await supabase
        .from('customer_payment_methods')
        .update({ nickname: editNickname.trim() })
        .eq('id', editingPaymentMethod.id);

      if (error) throw error;

      toast({
        title: "Payment Method Updated",
        description: "The payment method name has been updated successfully.",
      });

      // Close dialog and refresh data
      setEditingPaymentMethod(null);
      setEditNickname("");
      await fetchCustomerDetails();
    } catch (error: any) {
      console.error('Error updating payment method nickname:', error);
      toast({
        title: "Error",
        description: error.message || "Could not update payment method nickname.",
        variant: "destructive"
      });
    } finally {
      setSavingNickname(false);
    }
  };

  // Function to close edit dialog
  const handleCancelEdit = () => {
    setEditingPaymentMethod(null);
    setEditNickname("");
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
                  <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
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

                <TabsContent value="payment-methods">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center">
                          <CreditCard className="h-5 w-5 mr-2" />
                          Payment Methods
                        </span>
                        {customer.stripe_customer_id && (
                          <Button size="sm" onClick={handleSetupPaymentMethod}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Payment Method
                          </Button>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!customer.stripe_customer_id ? (
                        <div className="text-center py-8">
                          <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <h3 className="text-lg font-medium mb-2">Payment System Not Configured</h3>
                          <p className="text-muted-foreground mb-4">
                            This customer needs to be synced with the payment system before setting up payment methods.
                          </p>
                          <Button onClick={handleSyncWithStripe} disabled={syncingWithStripe}>
                            {syncingWithStripe ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Configuring...
                              </>
                            ) : (
                              <>
                                <CreditCard className="h-4 w-4 mr-2" />
                                Configure Payment System
                              </>
                            )}
                          </Button>
                        </div>
                      ) : !customer.customer_payment_methods || customer.customer_payment_methods.length === 0 ? (
                        <div className="text-center py-8">
                          <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <h3 className="text-lg font-medium mb-2">No Payment Methods</h3>
                          <p className="text-muted-foreground mb-4">
                            Set up a payment method to enable automatic payments for this customer.
                          </p>
                          <Button onClick={handleSetupPaymentMethod}>
                            <Plus className="h-4 w-4 mr-2" />
                            Setup First Payment Method
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {customer.customer_payment_methods
                            .sort((a, b) => {
                              if (a.is_default !== b.is_default) return b.is_default ? 1 : -1;
                              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                            })
                            .map((paymentMethod) => (
                            <div 
                              key={paymentMethod.id} 
                              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center space-x-4">
                                <div className="flex-shrink-0">
                                  <CreditCard className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium">{paymentMethod.nickname}</span>
                                    {paymentMethod.is_default && (
                                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                                        Default
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                                    <span className="capitalize">
                                      {paymentMethod.payment_method_type === 'sepa_debit' ? 'SEPA Direct Debit' : paymentMethod.payment_method_type}
                                    </span>
                                    {paymentMethod.last_four && (
                                      <span>•••• {paymentMethod.last_four}</span>
                                    )}
                                    <Badge 
                                      variant="secondary" 
                                      className={
                                        paymentMethod.stripe_mandate_status === 'active' 
                                          ? 'bg-green-100 text-green-800' 
                                          : paymentMethod.stripe_mandate_status === 'failed'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-yellow-100 text-yellow-800'
                                      }
                                    >
                                      {paymentMethod.stripe_mandate_status === 'active' ? 'Active' :
                                       paymentMethod.stripe_mandate_status === 'failed' ? 'Failed' :
                                       paymentMethod.stripe_mandate_status === 'pending' ? 'Pending' : 'Inactive'}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Added on {formatDate(new Date(paymentMethod.created_at), settings)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {!paymentMethod.is_default && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handleSetAsDefault(paymentMethod.id)}
                                    disabled={settingDefaultId === paymentMethod.id}
                                  >
                                    {settingDefaultId === paymentMethod.id ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Establishing...
                                      </>
                                    ) : (
                                      'Set as Default'
                                    )}
                                  </Button>
                                )}
                                <Button variant="outline" size="sm" onClick={() => handleEditPaymentMethod(paymentMethod)}>
                                  Edit
                                </Button>
                                {customer.customer_payment_methods && customer.customer_payment_methods.length > 1 && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => handleDeletePaymentMethod(paymentMethod.id, paymentMethod.nickname)}
                                    disabled={deletingPaymentMethodId === paymentMethod.id}
                                  >
                                    {deletingPaymentMethodId === paymentMethod.id ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Deleting...
                                      </>
                                    ) : (
                                      'Delete'
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
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

      {/* Edit Payment Method Dialog */}
      <Dialog open={!!editingPaymentMethod} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Payment Method</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nickname">Payment Method Name</Label>
              <Input
                id="nickname"
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                placeholder="Ej: Personal Account, Business Account..."
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                Give a descriptive name to easily identify this payment method.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit} disabled={savingNickname}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveNickname} 
              disabled={savingNickname || !editNickname.trim()}
            >
              {savingNickname ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SimpleErrorBoundary>
  );
}