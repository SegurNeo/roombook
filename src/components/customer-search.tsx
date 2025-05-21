import { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/lib/supabase";

interface CustomerSearchProps {
  onSelect: (customer: any) => void;
}

export function CustomerSearch({ onSelect }: CustomerSearchProps) {
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [search, setSearch] = useState("");

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
      setCustomers(data || []);
    } catch (error: any) {
      console.error('Error fetching customers:', error.message);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    if (!search) return true;
    const searchValue = search.toLowerCase();
    const fullName = `${customer.first_name} ${customer.last_name}`.toLowerCase();
    const email = customer.email.toLowerCase();
    return fullName.includes(searchValue) || email.includes(searchValue);
  });

  const handleSelect = (currentValue: string) => {
    const customer = customers.find(c => 
      `${c.first_name} ${c.last_name}`.toLowerCase() === currentValue.toLowerCase()
    );
    if (customer) {
      setSelectedCustomer(customer);
      onSelect(customer);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedCustomer ? (
            `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
          ) : (
            "Select customer..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search customers..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading..." : "No customer found."}
            </CommandEmpty>
            <CommandGroup>
              {filteredCustomers.map((customer) => {
                const value = `${customer.first_name} ${customer.last_name}`;
                return (
                  <CommandItem
                    key={customer.id}
                    value={value}
                    onSelect={() => handleSelect(value)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{value}</span>
                      <span className="text-sm text-muted-foreground">
                        {customer.email}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}