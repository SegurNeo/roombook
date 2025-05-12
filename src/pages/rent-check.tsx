import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Download, Settings2, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserFilter } from "@/components/user-filter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";

interface RentTransaction {
  id: string;
  customer: string;
  asset: string;
  room: string;
  dueDate: string;
  amount: number;
  type: 'rent' | 'deposit';
  status: 'scheduled' | 'processing' | 'paid' | 'failed' | 'paid_manually' | 'pending';
  user: {
    name?: string;
    image?: string;
  };
  stripe_invoice_id?: string | null;
  stripe_payment_intent_id?: string | null;
}

const statusStyles = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  processing: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  paid_manually: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300",
};

export interface ColumnOption {
  id: string;
  label: string;
  required?: boolean;
}

const columnOptions: ColumnOption[] = [
  { id: "customer", label: "Customer", required: true },
  { id: "asset", label: "Asset", required: true },
  { id: "room", label: "Room" },
  { id: "dueDate", label: "Due Date" },
  { id: "amount", label: "Amount" },
  { id: "type", label: "Type" },
  { id: "status", label: "Status" },
  { id: "user", label: "Created by" },
];

export function RentCheck() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<RentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState("month");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    columnOptions.filter(col => col.required || ["room", "dueDate", "amount", "type", "status", "user"].includes(col.id)).map(col => col.id)
  );
  const { toast } = useToast();

  useEffect(() => {
    fetchTransactions();
  }, [timePeriod, statusFilter, selectedUserId]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('rent_transactions')
        .select(`
          id,
          due_date,
          amount,
          type,
          status,
          stripe_invoice_id,
          stripe_payment_intent_id,
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
          profiles!rent_transactions_created_by_fkey (
            id,
            full_name
          )
        `);

      // Apply filters
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      if (selectedUserId) {
        query = query.eq('created_by', selectedUserId);
      }

      // Apply time period filter
      const today = new Date();
      switch (timePeriod) {
        case "week":
          query = query.gte('due_date', format(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7), 'yyyy-MM-dd'));
          break;
        case "month":
          query = query.gte('due_date', format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd'));
          break;
        case "year":
          query = query.gte('due_date', format(new Date(today.getFullYear(), 0, 1), 'yyyy-MM-dd'));
          break;
      }

      const { data, error } = await query;

      if (error) throw error;

      const transformedTransactions = (data || []).map(transaction => ({
        id: transaction.id,
        customer: `${(transaction.customers as any)?.first_name || ''} ${(transaction.customers as any)?.last_name || ''}`.trim(),
        asset: (transaction.rooms as any)?.assets?.name || 'Unknown',
        room: (transaction.rooms as any)?.name || 'Unknown',
        dueDate: format(new Date(transaction.due_date), "PP"),
        amount: transaction.amount,
        type: transaction.type,
        status: transaction.status,
        user: {
          name: (transaction.profiles as any)?.full_name || 'Unknown',
          image: `https://api.dicebear.com/7.x/initials/svg?seed=${(transaction.profiles as any)?.full_name || 'Unknown'}`
        },
        stripe_invoice_id: transaction.stripe_invoice_id,
        stripe_payment_intent_id: transaction.stripe_payment_intent_id
      }));

      setTransactions(transformedTransactions);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      toast({
        title: "Error fetching transactions",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaidManually = async (transactionId: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke("mark-transaction-paid-manual", {
        body: { rent_transaction_id: transactionId },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error.details || data.error.message || "Failed to mark as paid manually");
      }
      
      toast({
        title: "Status Updated",
        description: data?.message || "Transaction marked as paid manually.",
      });

      fetchTransactions();
    } catch (error: any) {
      console.error("Error marking transaction as paid manually:", error);
      toast({
        title: "Error Updating Status",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToManual = async (transactionId: string, currentStatus: string) => {
    if (['pending', 'paid', 'paid_manually'].includes(currentStatus)) {
        toast({
            title: "Action Not Allowed",
            description: `Transaction is already in status '${currentStatus}' and cannot be switched to manual.`,
            variant: "default" 
        });
        return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("switch-transaction-to-manual", {
        body: { rent_transaction_id: transactionId },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error.details || data.error.message || "Failed to switch to manual");
      
      toast({
        title: "Switched to Manual",
        description: data?.message || "Transaction switched to manual collection. Status set to 'pending'.",
      });
      fetchTransactions(); // Refrescar
    } catch (error: any) {
      toast({
        title: "Error Switching to Manual",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    return transactions.reduce(
      (acc, transaction) => ({
        total: acc.total + transaction.amount,
        pending: acc.pending + (transaction.status === 'scheduled' || transaction.status === 'processing' ? transaction.amount : 0),
        paid: acc.paid + (transaction.status === 'paid' ? transaction.amount : 0),
        late: acc.late + (transaction.status === 'failed' ? transaction.amount : 0),
      }),
      { total: 0, pending: 0, paid: 0, late: 0 }
    );
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

  const handleExport = () => {
    try {
      const csvContent = [
        // Header row
        selectedColumns.map(colId => {
          const column = columnOptions.find(col => col.id === colId);
          return column?.label || colId;
        }).join(','),
        // Data rows
        ...transactions.map(transaction => 
          selectedColumns.map(colId => {
            switch (colId) {
              case 'customer':
                return `"${transaction.customer}"`;
              case 'asset':
                return `"${transaction.asset}"`;
              case 'room':
                return `"${transaction.room}"`;
              case 'dueDate':
                return transaction.dueDate;
              case 'amount':
                return transaction.amount;
              case 'type':
                return transaction.type;
              case 'status':
                return transaction.status;
              case 'user':
                return `"${transaction.user.name}"`;
              default:
                return '';
            }
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `rent-transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast({
        title: "Export successful",
        description: "Your data has been exported to CSV.",
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message || "Failed to export data",
        variant: "destructive"
      });
    }
  };

  const handleAddBooking = () => {
    navigate('/new-booking');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-lg font-medium">Loading transactions...</p>
        </div>
      </div>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Rent Check</h2>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" /> Export
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="p-4 border rounded-lg bg-card">
          <h3 className="font-semibold mb-2">Total Amount</h3>
          <p className="text-2xl font-bold">€{totals.total.toLocaleString()}</p>
        </div>
        <div className="p-4 border rounded-lg bg-card">
          <h3 className="font-semibold mb-2 text-yellow-600">Pending</h3>
          <p className="text-2xl font-bold text-yellow-600">€{totals.pending.toLocaleString()}</p>
        </div>
        <div className="p-4 border rounded-lg bg-card">
          <h3 className="font-semibold mb-2 text-green-600">Paid</h3>
          <p className="text-2xl font-bold text-green-600">€{totals.paid.toLocaleString()}</p>
        </div>
        <div className="p-4 border rounded-lg bg-card">
          <h3 className="font-semibold mb-2 text-red-600">Late</h3>
          <p className="text-2xl font-bold text-red-600">€{totals.late.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex justify-between items-center space-x-4">
        <div className="flex items-center">
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue>Time period</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-4">
          <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? null : value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="paid_manually">Paid Manually</SelectItem>
            </SelectContent>
          </Select>

          <UserFilter
            selectedUserId={selectedUserId}
            onSelect={setSelectedUserId}
          />

          <Button variant="outline" onClick={() => setShowColumnSelector(true)}>
            <Settings2 className="mr-2 h-4 w-4" /> Edit columns
          </Button>
        </div>
      </div>

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

      {transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 border rounded-lg bg-muted/10">
          <div className="text-center space-y-3">
            <h3 className="text-lg font-semibold">No rent transactions found</h3>
            <p className="text-muted-foreground">
              Create a booking to start managing rent transactions and payments.
            </p>
            <Button 
              onClick={handleAddBooking}
              className="mt-4"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Booking
            </Button>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                {selectedColumns.includes("customer") && <TableHead>Customer</TableHead>}
                {selectedColumns.includes("asset") && <TableHead>Asset</TableHead>}
                {selectedColumns.includes("room") && <TableHead>Room</TableHead>}
                {selectedColumns.includes("dueDate") && <TableHead>Due Date</TableHead>}
                {selectedColumns.includes("type") && <TableHead>Type</TableHead>}
                {selectedColumns.includes("amount") && <TableHead>Amount</TableHead>}
                {selectedColumns.includes("status") && <TableHead>Status</TableHead>}
                {selectedColumns.includes("user") && <TableHead>Created by</TableHead>}
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  {selectedColumns.includes("customer") && <TableCell>{transaction.customer}</TableCell>}
                  {selectedColumns.includes("asset") && <TableCell>{transaction.asset}</TableCell>}
                  {selectedColumns.includes("room") && <TableCell>{transaction.room}</TableCell>}
                  {selectedColumns.includes("dueDate") && <TableCell>{transaction.dueDate}</TableCell>}
                  {selectedColumns.includes("type") && <TableCell className="capitalize">{transaction.type}</TableCell>}
                  {selectedColumns.includes("amount") && <TableCell>€{transaction.amount.toLocaleString()}</TableCell>}
                  {selectedColumns.includes("status") && (
                    <TableCell>
                      <Badge 
                        variant="secondary"
                        className={cn(
                          "capitalize",
                          statusStyles[transaction.status]
                        )}
                      >
                        {transaction.status}
                      </Badge>
                    </TableCell>
                  )}
                  {selectedColumns.includes("user") && (
                    <TableCell>{transaction.user.name}</TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center space-x-1"> 
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkAsPaidManually(transaction.id)}
                        disabled={transaction.status === 'paid' || transaction.status === 'paid_manually' || loading}
                      >
                        Mark Paid
                      </Button>
                      { (transaction.status === 'scheduled' || transaction.status === 'processing' || transaction.status === 'failed') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSwitchToManual(transaction.id, transaction.status)}
                          disabled={loading}
                          title="Switch to Manual Collection"
                        >
                          To Manual
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}