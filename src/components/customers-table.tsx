import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Pencil, ChevronLeft, ChevronRight, Plus, Eye, CreditCard, Loader2 } from "lucide-react";
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
  'N/A': "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
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

  const DELETE_PASSWORD = "delete123";

  if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
    console.error("Stripe publishable key not found. Please set VITE_STRIPE_PUBLISHABLE_KEY.");
  }

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

  const handleConfigureSEPA = async (customer: Customer) => {
    if (!customer.id) {
        toast({ title: "Error", description: "Customer ID is missing.", variant: "destructive"});
        return;
    }
    setConfiguringCustomerId(customer.id);

    try {
      console.log(`Requesting SEPA setup for Supabase customer ID: ${customer.id}`);
      const { data, error: functionError } = await supabase.functions.invoke(
        'create-sepa-setup-session',
        { body: { supabase_customer_id: customer.id } }
      );

      if (functionError) {
        throw new Error(functionError.message || "Failed to create SEPA setup session.");
      }

      const { sessionId } = data;
      if (!sessionId) {
        throw new Error("Checkout Session ID not received from function.");
      }

      console.log(`Received Stripe Checkout Session ID: ${sessionId}`);

      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error("Stripe.js failed to load.");
      }

      const { error: redirectError } = await stripe.redirectToCheckout({ sessionId });

      if (redirectError) {
        console.error("Stripe redirection error:", redirectError);
        throw new Error(redirectError.message || "Failed to redirect to Stripe.");
      }

    } catch (error: any) {
      console.error("Error during SEPA configuration:", error);
      toast({
        title: "SEPA Setup Error",
        description: error.message || "Could not initiate SEPA configuration. Please try again.",
        variant: "destructive",
      });
       setConfiguringCustomerId(null);
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
            <Badge 
              variant="secondary" 
              className={cn(
                "capitalize",
                statusStyles[customer.status as keyof typeof statusStyles]
              )}
            >
              {customer.status}
            </Badge>
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
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => navigate(`/customers/${customer.id}`)}
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="secondary" size="icon" title="Edit Customer" disabled>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => handleConfigureSEPA(customer)}
                      disabled={configuringCustomerId === customer.id}
                      title="Configure SEPA Direct Debit"
                    >
                      {configuringCustomerId === customer.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                          <CreditCard className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeleteClick(customer)}
                      title="Delete Customer"
                    >
                      <Trash2 className="h-4 w-4" />
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