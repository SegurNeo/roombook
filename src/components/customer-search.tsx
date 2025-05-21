import { useState, useEffect } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  // Add other customer properties if needed
}

interface CustomerSearchProps {
  onSelect: (customer: Customer | null) => void;
}

export function CustomerSearch({ onSelect }: CustomerSearchProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('first_name', { ascending: true });

      if (error) throw error;
      setCustomers((data as Customer[]) || []);
    } catch (error: any) {
      console.error('Error fetching customers:', error.message);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (customerId: string) => {
    const selectedCustomer = customers.find(c => c.id === customerId) || null;
    setSelectedValue(customerId);
    onSelect(selectedCustomer);
  };

  const selectedCustomerForDisplay = selectedValue
    ? customers.find(customer => customer.id === selectedValue)
    : null;

  return (
    <Select
      value={selectedValue || ""}
      onValueChange={handleValueChange}
      disabled={loading}
    >
      <SelectTrigger className="w-full justify-between">
        <SelectValue placeholder={loading ? "Loading customers..." : "Select customer..."}>
          {selectedCustomerForDisplay
            ? `${selectedCustomerForDisplay.first_name} ${selectedCustomerForDisplay.last_name}`
            : (loading ? "Loading customers..." : "Select customer...")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {customers.length === 0 && !loading && (
          <div className="p-4 text-sm text-muted-foreground">No customers found.</div>
        )}
        {customers.map((customer) => (
          <SelectItem key={customer.id} value={customer.id}>
            <div className="flex flex-col">
              <span>{customer.first_name} {customer.last_name}</span>
              <span className="text-xs opacity-75">{customer.email}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}