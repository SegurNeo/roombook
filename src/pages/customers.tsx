import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Filter, Settings2, Calendar, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomersTable } from "@/components/customers-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle2 } from "lucide-react";
import { UserFilter } from "@/components/user-filter";
import { NewCustomer } from "./new-customer";
import { useSearchParams, useLocation } from "react-router-dom";

interface CustomersProps { }

export interface ColumnOption {
  id: string;
  label: string;
  required?: boolean;
}

const columnOptions: ColumnOption[] = [
  { id: "name", label: "Client name", required: true },
  { id: "clientId", label: "ID", required: true },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "status", label: "Status" },
  { id: "payment_method_status", label: "Payment Method" },
  { id: "nextActionDate", label: "Next action date" },
  { id: "user", label: "Created by" },
];

export function Customers({ }: CustomersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
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
    columnOptions.filter(col => col.required || ["email", "phone", "status", "payment_method_status", "nextActionDate", "user"].includes(col.id)).map(col => col.id)
  );
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  console.log('[Customers.tsx] Rendering - Path:', location.pathname, 'Search Params:', searchParams.toString());

  useEffect(() => {
    console.log('[Customers.tsx] useEffect for fetchCustomers - showNewCustomerForm:', showNewCustomerForm);
    if (!showNewCustomerForm) {
       fetchCustomers();
    }
  }, [selectedUserId, showNewCustomerForm]);

  useEffect(() => {
    const setup_success = searchParams.get('setup_success');
    console.log('[Customers.tsx] useEffect for setup_success - setup_success param:', setup_success);
    if (setup_success === 'true') {
      // Check if any customer has the 'updated_existing' flag
      checkForPaymentMethodUpdates();
      
      // Remove the query parameter using setSearchParams
      const newSearchParams = new URLSearchParams(searchParams.toString()); // Create a mutable copy
      newSearchParams.delete('setup_success');
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, toast]); // Add setSearchParams to dependencies

  const checkForPaymentMethodUpdates = async () => {
    try {
      // Find customers with recent payment method actions
      const { data: customersWithActions, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, last_payment_method_action, last_payment_method_action_at')
        .eq('last_payment_method_action', 'updated_existing')
        .gte('last_payment_method_action_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 minutes
        .order('last_payment_method_action_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error checking for payment method actions:', error);
        // Fallback to generic success message
        toast({
          title: "Payment Method Configured!",
          description: "The payment method has been successfully configured for this customer.",
          variant: "default",
        });
        return;
      }

      if (customersWithActions && customersWithActions.length > 0) {
        const customer = customersWithActions[0];
        // Show specific message for existing payment method update
        toast({
          title: "Payment Method Updated!",
          description: `The existing payment method for ${customer.first_name} ${customer.last_name} has been updated. This occurred because the same bank account was already configured for this customer.`,
          variant: "default",
        });

        // Clear the flag so it doesn't show again
        await supabase
          .from('customers')
          .update({ 
            last_payment_method_action: null,
            last_payment_method_action_at: null
          })
          .eq('id', customer.id);
      } else {
        // Generic success message
        toast({
          title: "Payment Method Configured!",
          description: "The payment method has been successfully configured for this customer.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error in checkForPaymentMethodUpdates:', error);
      // Fallback to generic success message
      toast({
        title: "Payment Method Configured!",
        description: "The payment method has been successfully configured for this customer.",
        variant: "default",
      });
    }
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('customers')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone_prefix,
          phone_number,
          id_number,
          notes,
          created_at,
          payer_type,
          payer_name,
          created_by,
          stripe_customer_id,
          stripe_payment_method_id,
          stripe_mandate_status,
          last_payment_method_action,
          last_payment_method_action_at,
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
          profiles!customers_created_by_fkey (
            id,
            full_name
          )
        `);

      if (selectedUserId) {
        query = query.eq('created_by', selectedUserId);
      }

      const { data: customersData, error } = await query;

      if (error) throw error;

      const transformedCustomers = customersData.map(customer => {
        const transformed = {
          id: customer.id,
          name: `${customer.first_name} ${customer.last_name}`,
          clientId: customer.id_number,
          email: customer.email,
          phone: `${customer.phone_prefix} ${customer.phone_number}`,
          status: customer.payer_type || 'N/A',
          nextActionDate: format(new Date(customer.created_at), 'PP'),
          user: {
            name: (customer.profiles as any)?.full_name || 'Unknown',
            image: `https://api.dicebear.com/7.x/initials/svg?seed=${(customer.profiles as any)?.full_name || 'Unknown'}`
          },
          // Legacy fields for backward compatibility
          stripe_customer_id: customer.stripe_customer_id,
          stripe_payment_method_id: customer.stripe_payment_method_id,
          stripe_mandate_status: customer.stripe_mandate_status,
          // Payment method action tracking
          last_payment_method_action: customer.last_payment_method_action,
          last_payment_method_action_at: customer.last_payment_method_action_at,
          // New multiple payment methods data
          payment_methods: (customer.customer_payment_methods as any[])?.map(pm => ({
            id: pm.id,
            stripe_payment_method_id: pm.stripe_payment_method_id,
            stripe_mandate_status: pm.stripe_mandate_status,
            payment_method_type: pm.payment_method_type,
            is_default: pm.is_default,
            nickname: pm.nickname,
            last_four: pm.last_four
          })) || [],
          payment_methods_count: (customer.customer_payment_methods as any[])?.length || 0
        };
        
        // Debug log for Pedro López
        if (customer.email === 'pepelop@gmail.com') {
          console.log('🔄 TRANSFORM Pedro López:', {
            original_customer_payment_methods: customer.customer_payment_methods,
            transformed_payment_methods: transformed.payment_methods,
            transformed_payment_methods_count: transformed.payment_methods_count,
            legacy_stripe_mandate_status: transformed.stripe_mandate_status
          });
        }
        
        return transformed;
      });

      setCustomers(transformedCustomers);
    } catch (error: any) {
      toast({
        title: "Error fetching customers",
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

  const handleDelete = () => {
    fetchCustomers();
  };

  if (showNewCustomerForm) {
      return (
          <NewCustomer
              onBack={() => setShowNewCustomerForm(false)}
              onComplete={(customerData) => {
                  console.log('New customer created:', customerData);
                  setShowNewCustomerForm(false);
              }}
          />
      );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-lg font-medium">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Customers</h2>
        <Button onClick={() => setShowNewCustomerForm(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add customer
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
                <SelectItem value="person">Person</SelectItem>
                <SelectItem value="company">Company</SelectItem>
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

      <CustomersTable 
        customers={customers} 
        selectedColumns={selectedColumns} 
        columnOptions={columnOptions}
        onDelete={handleDelete}
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

      {showSuccessModal && (
        <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                Payment Method Configured
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p>The payment method has been successfully configured for this customer.</p>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowSuccessModal(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}