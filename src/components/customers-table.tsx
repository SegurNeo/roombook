import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Pencil, ChevronLeft, ChevronRight, Plus, CreditCard, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ColumnOption } from "@/pages/customers";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import React from "react";

interface Customer {
  id: string;
  name: string;
  clientId: string;
  email: string;
  phone: string;
  status: string;
  nextActionDate: string;
  user: {
    name: string;
    image: string;
  };
  stripe_customer_id?: string | null;
  stripe_payment_method_id?: string | null;
  stripe_mandate_status?: string | null;
  payment_methods?: Array<{
    id: string;
    stripe_payment_method_id: string;
    stripe_mandate_status: string;
    payment_method_type: string;
    is_default: boolean;
    nickname: string;
    last_four?: string;
  }>;
  payment_methods_count?: number;
}

interface CustomersTableProps {
  customers: Customer[];
  selectedColumns: string[];
  columnOptions: ColumnOption[];
  onDelete?: () => void;
  onNewCustomer?: () => void;
}

const statusStyles = {
  person: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  company: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

export function CustomersTable({ customers, selectedColumns, columnOptions, onDelete, onNewCustomer }: CustomersTableProps) {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  const [configuringCustomerId, setConfiguringCustomerId] = useState<string | null>(null);
  const [syncingCustomerId, setSyncingCustomerId] = useState<string | null>(null);

  const DELETE_PASSWORD = "delete123";

  if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
    console.error("Stripe publishable key not found. Please set VITE_STRIPE_PUBLISHABLE_KEY.");
  }

  // Helper function to determine payment method configuration status
  const getPaymentMethodStatus = (customer: Customer) => {
    // Debug logging for Pedro López
    if (customer.email === 'pepelop@gmail.com') {
      console.log('🔍 DEBUG Pedro López data:', {
        name: customer.name,
        stripe_customer_id: customer.stripe_customer_id,
        stripe_payment_method_id: customer.stripe_payment_method_id,
        stripe_mandate_status: customer.stripe_mandate_status,
        payment_methods: customer.payment_methods,
        payment_methods_count: customer.payment_methods_count
      });
    }
    
    // Check if customer is synced with Stripe
    if (!customer.stripe_customer_id) {
      return {
        status: 'not_configured',
        label: 'Not configured',
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
        canConfigure: false,
        description: 'Customer needs to be synced with payment system first',
        count: 0
      };
    }
    
    // Use new payment_methods array if available, otherwise fall back to legacy fields
    const paymentMethods = customer.payment_methods || [];
    const paymentMethodsCount = customer.payment_methods_count || paymentMethods.length;
    
    // Debug logging for Pedro López
    if (customer.email === 'pepelop@gmail.com') {
      console.log('🔍 DEBUG Pedro López processed:', {
        paymentMethods,
        paymentMethodsCount,
        firstPmStatus: paymentMethods[0]?.stripe_mandate_status
      });
    }
    
    // If no payment methods at all
    if (paymentMethodsCount === 0 && !customer.stripe_payment_method_id) {
      return {
        status: 'ready_to_setup',
        label: 'Ready to setup',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        canConfigure: true,
        description: 'Customer is ready to configure payment method',
        count: 0
      };
    }
    
    // Handle multiple payment methods
    if (paymentMethodsCount > 1) {
      const activeCount = paymentMethods.filter(pm => pm.stripe_mandate_status === 'active').length;
      
      if (activeCount === paymentMethodsCount) {
        return {
          status: 'multiple_active',
          label: `${paymentMethodsCount} Active`,
          color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
          canConfigure: false,
          description: `Customer has ${paymentMethodsCount} active payment methods`,
          count: paymentMethodsCount
        };
      } else if (activeCount > 0) {
        return {
          status: 'multiple_mixed',
          label: `${activeCount}/${paymentMethodsCount} Active`,
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
          canConfigure: true,
          description: `Customer has ${activeCount} active out of ${paymentMethodsCount} payment methods`,
          count: paymentMethodsCount
        };
      } else {
        return {
          status: 'multiple_inactive',
          label: `${paymentMethodsCount} Inactive`,
          color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
          canConfigure: true,
          description: `Customer has ${paymentMethodsCount} inactive payment methods`,
          count: paymentMethodsCount
        };
      }
    }
    
    // Handle single payment method (legacy compatibility)
    const mandateStatus = customer.payment_methods?.[0]?.stripe_mandate_status || customer.stripe_mandate_status;
    
    // Debug log for Pedro López
    if (customer.email === 'pepelop@gmail.com') {
      console.log('🔍 DEBUG Pedro López mandate check:', {
        mandateStatus,
        aboutToReturn: mandateStatus === 'active' ? 'ACTIVE STATUS' : 'OTHER STATUS'
      });
    }
    
    switch (mandateStatus) {
      case 'active':
        const activeResult = {
          status: 'active',
          label: 'Active',
          color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
          canConfigure: false,
          description: 'Payment method is configured and active',
          count: 1
        };
        
        // Debug log for Pedro López
        if (customer.email === 'pepelop@gmail.com') {
          console.log('🎯 FINAL Pedro López result:', activeResult);
        }
        
        return activeResult;
      case 'failed':
        return {
          status: 'failed',
          label: 'Setup failed',
          color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
          canConfigure: true,
          description: 'Payment method setup failed, needs reconfiguration',
          count: 1
        };
      case 'pending':
        return {
          status: 'pending',
          label: 'Setup pending',
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
          canConfigure: false,
          description: 'Payment method setup is in progress',
          count: 1
        };
      case 'inactive':
        return {
          status: 'inactive',
          label: 'Inactive',
          color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
          canConfigure: true,
          description: 'Payment method is inactive, may need reconfiguration',
          count: 1
        };
      default:
        return {
          status: 'unknown',
          label: 'Unknown status',
          color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
          canConfigure: true,
          description: 'Payment method status is unknown, may need reconfiguration',
          count: paymentMethodsCount || 1
        };
    }
  };

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 border rounded-lg bg-muted/10">
        <div className="text-center space-y-3">
          <h3 className="text-lg font-semibold">No customers found</h3>
          <p className="text-muted-foreground">
            Get started by adding your first customer to manage their bookings and information.
          </p>
          {onNewCustomer && (
            <Button onClick={onNewCustomer} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          )}
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(customers.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentCustomers = customers.slice(startIndex, endIndex);

  const visibleColumns = columnOptions.filter(col => selectedColumns.includes(col.id));

  const handleDeleteClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCustomer) {
      setDeleteDialogOpen(false);
      return;
    }

    if (password !== DELETE_PASSWORD) {
      toast({
        title: "Invalid password",
        description: "Please enter the correct password to delete this customer.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('customers')
        .delete()
        .eq('id', selectedCustomer.id);

      if (deleteError) throw deleteError;

      toast({
        title: "Customer deleted",
        description: "The customer has been successfully deleted.",
      });

      setDeleteDialogOpen(false);
      setPassword("");
      setSelectedCustomer(null);
      if (onDelete) onDelete();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete customer. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleConfigurePaymentMethod = async (customer: Customer) => {
    if (!customer.id) {
        toast({ title: "Error", description: "Customer ID is missing.", variant: "destructive"});
        return;
    }

    // Validate that we have the Stripe publishable key
    if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
      toast({
        title: "Configuration Error",
        description: "Payment system is not properly configured. Please contact support.",
        variant: "destructive",
      });
      return;
    }

    // Get payment method status and validate if customer can configure payment method
    const paymentStatus = getPaymentMethodStatus(customer);
    
    if (!paymentStatus.canConfigure) {
      toast({
        title: "Payment Method Setup Not Available",
        description: paymentStatus.description,
        variant: "default",
      });
      return;
    }

    // Special handling for not configured customers
    if (paymentStatus.status === 'not_configured') {
      toast({
        title: "Customer Not Synced",
        description: `${customer.name} needs to be synced with the payment system first. Please contact your administrator.`,
        variant: "destructive",
      });
      return;
    }

    setConfiguringCustomerId(customer.id);

    try {
      console.log(`Requesting payment method setup for customer ID: ${customer.id}`);
      
      const { data, error: functionError } = await supabase.functions.invoke(
        'create-sepa-setup-session',
        { 
          body: { 
            supabase_customer_id: customer.id,
            success_url: `${window.location.origin}/customers?setup_success=true`,
            cancel_url: `${window.location.origin}/customers`
          } 
        }
      );

      if (functionError) {
        console.error("Supabase function error:", functionError);
        
        // Handle specific error cases
        if (functionError.message?.includes("Customer not found") || 
            functionError.message?.includes("not synced with Stripe")) {
          throw new Error(
            `Customer ${customer.name} is not synced with the payment system. ` +
            "Please contact your administrator to sync the customer first."
          );
        }
        
        throw new Error(functionError.message || "Failed to create payment method setup session.");
      }

      // Check if the response contains an error (even with 200 status)
      if (data?.error) {
        console.error("Function returned error:", data.error);
        
        // Handle specific error types (can add more specific error handling here if needed)
        
        if (typeof data.error === 'string') {
          if (data.error.includes("Customer not found") || 
              data.error.includes("not synced with Stripe")) {
            throw new Error(
              `Customer ${customer.name} is not synced with the payment system. ` +
              "Please contact your administrator to sync the customer first."
            );
          }
          throw new Error(data.error);
        } else if (data.error.message) {
          throw new Error(data.error.message);
        } else {
          throw new Error("Unknown error occurred while setting up payment method.");
        }
      }

      const { sessionId } = data;
      if (!sessionId) {
        throw new Error("Payment setup session ID not received from server.");
      }

      console.log(`Received Stripe Checkout Session ID: ${sessionId}`);

      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error("Payment system failed to load. Please check your internet connection and try again.");
      }

      const { error: redirectError } = await stripe.redirectToCheckout({ sessionId });

      if (redirectError) {
        console.error("Payment system redirection error:", redirectError);
        throw new Error(redirectError.message || "Failed to redirect to payment setup.");
      }

      // If we get here, the redirect should be happening, so we don't reset the loading state

    } catch (error: any) {
      console.error("Error during payment method configuration:", error);
      
      // Provide more specific error messages based on the error type
      let errorMessage = "Could not initiate payment method setup. Please try again.";
      
      if (error.message?.includes("not synced with")) {
        errorMessage = error.message;
      } else if (error.message?.includes("Customer not found")) {
        errorMessage = `Customer ${customer.name} not found in the system. Please verify that the customer exists.`;
      } else if (error.message?.includes("Stripe")) {
        errorMessage = `Payment system error: ${error.message}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Payment Method Setup Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Always reset the loading state on error
      setConfiguringCustomerId(null);
    }
  };

  // NEW: Function to sync customer with Stripe
  const handleSyncWithStripe = async (customer: Customer) => {
    if (!customer.id) {
      toast({ title: "Error", description: "Customer ID is missing.", variant: "destructive"});
      return;
    }

    setSyncingCustomerId(customer.id);

    try {
      console.log(`Syncing customer ${customer.id} with Stripe`);
      
      const { data, error: functionError } = await supabase.functions.invoke(
        'create-stripe-customer',
        { 
          body: { 
            record: {
              id: customer.id,
              first_name: customer.name.split(' ')[0] || '',
              last_name: customer.name.split(' ').slice(1).join(' ') || '',
              email: customer.email,
              phone_prefix: customer.phone?.split(' ')[0] || '',
              phone_number: customer.phone?.split(' ').slice(1).join(' ') || '',
              payer_type: customer.status !== 'N/A' ? customer.status : null,
              notes: null
            }
          } 
        }
      );

      if (functionError) {
        console.error("Stripe sync error:", functionError);
        throw new Error(functionError.message || "Failed to sync customer with Stripe.");
      }

      if (data?.error) {
        console.error("Function returned error:", data.error);
        throw new Error(data.error.details || data.error || "Failed to sync customer with Stripe.");
      }

      toast({
        title: "Customer Synced!",
        description: `${customer.name} has been successfully synced with the payment system.`,
      });

      // Refresh the page to update the customer data
      window.location.reload();

    } catch (error: any) {
      console.error("Error syncing customer with Stripe:", error);
      
      toast({
        title: "Sync Error",
        description: error.message || "Could not sync customer with payment system. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSyncingCustomerId(null);
    }
  };

  const renderCell = (customer: Customer, columnId: string) => {
    switch (columnId) {
      case "name":
        return <TableCell className="font-medium">{customer.name}</TableCell>;
      case "clientId":
        return <TableCell>{customer.clientId}</TableCell>;
      case "email":
        return <TableCell>{customer.email}</TableCell>;
      case "phone":
        return <TableCell>{customer.phone}</TableCell>;
      case "status":
        return (
          <TableCell>
            {customer.status !== 'N/A' ? (
              <Badge 
                variant="secondary" 
                className={cn(
                  "capitalize",
                  statusStyles[customer.status as keyof typeof statusStyles]
                )}
              >
                {customer.status}
              </Badge>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </TableCell>
        );
      case "nextActionDate":
        return <TableCell>{customer.nextActionDate}</TableCell>;
      case "user":
        if (customer.user && typeof customer.user.name === 'string') {
          return <TableCell>{customer.user.name}</TableCell>;
        } else {
          console.warn(`Malformed user data for customer ${customer.id}:`, customer.user);
          return <TableCell>-</TableCell>;
        }
      case "payment_method_status":
        const paymentStatus = getPaymentMethodStatus(customer);
        return (
          <TableCell>
            <Badge 
              variant="secondary" 
              className={cn("capitalize", paymentStatus.color)}
              title={paymentStatus.description}
            >
              {paymentStatus.label}
            </Badge>
          </TableCell>
        );
      default:
        const col = columnOptions.find(c => c.id === columnId);
        let value = customer[columnId as keyof Customer] ?? '-';
        if (typeof value === 'object' && value !== null && !React.isValidElement(value)) {
          console.warn(`Rendering unexpected object for column ${columnId}, customer ${customer.id}:`, value);
          value = '[Object]';
        }
        return <TableCell>{col ? String(value) : '-'}</TableCell>;
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
            {currentCustomers.map((customer) => (
              <TableRow key={customer.id}>
                {visibleColumns.map((column) => renderCell(customer, column.id))}
                <TableCell>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="secondary"
                        onClick={() => navigate(`/customers/${customer.id}`)}
                        className="flex items-center"
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      {(() => {
                        const paymentStatus = getPaymentMethodStatus(customer);
                        const isConfiguring = configuringCustomerId === customer.id;
                        const isSyncing = syncingCustomerId === customer.id;
                        
                        // Show sync button for not configured customers
                        if (paymentStatus.status === 'not_configured') {
                          return (
                            <Button
                              variant="outline"
                              onClick={() => handleSyncWithStripe(customer)}
                              disabled={isSyncing}
                              className="flex items-center whitespace-nowrap"
                              title="Sync this customer with the payment system first"
                            >
                              {isSyncing ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Syncing...
                                </>
                              ) : (
                                <>
                                  <CreditCard className="h-4 w-4 mr-2" />
                                  Sync with Stripe
                                </>
                              )}
                            </Button>
                          );
                        }
                        
                        // Handle multiple payment methods - navigate to customer details for management
                        if (paymentStatus.count > 1) {
                          return (
                            <Button
                              variant="secondary"
                              onClick={() => navigate(`/customers/${customer.id}?tab=payment-methods`)}
                              className="flex items-center whitespace-nowrap"
                              title={`View and manage ${paymentStatus.count} payment methods`}
                            >
                              <CreditCard className="h-4 w-4 mr-2" />
                              Manage payment methods ({paymentStatus.count})
                            </Button>
                          );
                        }
                        
                        // Handle single payment method or no payment methods
                        return (
                          <Button
                            variant={paymentStatus.canConfigure ? "secondary" : "ghost"}
                            onClick={() => {
                              if (paymentStatus.status === 'active' || paymentStatus.count > 0) {
                                // Navigate to customer details payment methods tab for management
                                navigate(`/customers/${customer.id}?tab=payment-methods`);
                              } else {
                                // Setup new payment method
                                handleConfigurePaymentMethod(customer);
                              }
                            }}
                            disabled={(!paymentStatus.canConfigure && paymentStatus.status !== 'active') || isConfiguring}
                            className={cn(
                              "flex items-center whitespace-nowrap",
                              !paymentStatus.canConfigure && paymentStatus.status !== 'active' && "opacity-50 cursor-not-allowed"
                            )}
                            title={paymentStatus.description}
                          >
                            {isConfiguring ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Setting up...
                              </>
                            ) : (
                              <>
                                <CreditCard className="h-4 w-4 mr-2" />
                                {paymentStatus.status === 'ready_to_setup' ? 'Setup Payment' : 
                                 paymentStatus.status === 'active' ? 'Manage payment methods (1)' : 
                                 paymentStatus.canConfigure ? 'Configure' : 'View'}
                              </>
                            )}
                          </Button>
                        );
                      })()}
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteClick(customer)}
                      className="flex items-center"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
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
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription>
              Enter your password to confirm deletion of {selectedCustomer?.name}
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
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={!password}
              >
                Delete Customer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}