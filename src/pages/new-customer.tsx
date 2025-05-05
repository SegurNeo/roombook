import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Check, Upload, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

const countryPrefixes = [
  { code: "ES", flag: "🇪🇸", prefix: "+34", name: "Spain" },
  { code: "US", flag: "🇺🇸", prefix: "+1", name: "United States" },
  { code: "GB", flag: "🇬🇧", prefix: "+44", name: "United Kingdom" },
  { code: "DE", flag: "🇩🇪", prefix: "+49", name: "Germany" },
  { code: "FR", flag: "🇫🇷", prefix: "+33", name: "France" },
  { code: "IT", flag: "🇮🇹", prefix: "+39", name: "Italy" },
  { code: "PT", flag: "🇵🇹", prefix: "+351", name: "Portugal" },
  { code: "NL", flag: "🇳🇱", prefix: "+31", name: "Netherlands" },
  { code: "BE", flag: "🇧🇪", prefix: "+32", name: "Belgium" },
  { code: "CH", flag: "🇨🇭", prefix: "+41", name: "Switzerland" },
];

interface NewCustomerProps {
  onBack: () => void;
  onComplete: (data: any) => void;
}

export function NewCustomer({ onBack, onComplete }: NewCustomerProps) {
  const [isSameAsPayer, setIsSameAsPayer] = useState(true);
  const [payerType, setPayerType] = useState<"person" | "company">("person");
  const [selectedPrefix, setSelectedPrefix] = useState({ code: "ES", flag: "🇪🇸", prefix: "+34", name: "Spain" });
  const [selectedPayerPrefix, setSelectedPayerPrefix] = useState({ code: "ES", flag: "🇪🇸", prefix: "+34", name: "Spain" });
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [payerIdDocument, setPayerIdDocument] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleIdDocumentChange = (e: React.ChangeEvent<HTMLInputElement>, isPayer: boolean = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 5MB",
        variant: "destructive"
      });
      return;
    }

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast({
        title: "Invalid file type",
        description: "Please upload an image or PDF file",
        variant: "destructive"
      });
      return;
    }

    if (isPayer) {
      setPayerIdDocument(file);
    } else {
      setIdDocument(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      // Get the current user's profile to get the organization_id
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      if (!user) {
        throw new Error("No authenticated user found");
      }

      // Get the user's organization_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      if (!profile?.organization_id) {
        throw new Error("User does not belong to an organization");
      }

      // Get form values using type assertion
      const form = e.target as HTMLFormElement;
      const firstName = (form.elements.namedItem('firstName') as HTMLInputElement)?.value;
      const lastName = (form.elements.namedItem('lastName') as HTMLInputElement)?.value;
      const email = (form.elements.namedItem('email') as HTMLInputElement)?.value;
      const phone = (form.elements.namedItem('phone') as HTMLInputElement)?.value;
      const idNumber = (form.elements.namedItem('idNumber') as HTMLInputElement)?.value;
      const notes = (form.elements.namedItem('notes') as HTMLInputElement)?.value;

      // Validate required fields
      if (!firstName || !lastName || !email || !phone || !idNumber) {
        throw new Error("Please fill in all required fields");
      }

      const customerData = {
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone_prefix: selectedPrefix.prefix,
        phone_number: phone,
        id_number: idNumber,
        id_document: null, // TODO: Implement file upload
        notes: notes || null,
        organization_id: profile.organization_id,
        created_by: user.id,
        payer_type: !isSameAsPayer ? payerType : null,
        payer_name: !isSameAsPayer ? (form.elements.namedItem('payerName') as HTMLInputElement)?.value || null : null,
        payer_email: !isSameAsPayer ? (form.elements.namedItem('payerEmail') as HTMLInputElement)?.value || null : null,
        payer_phone_prefix: !isSameAsPayer ? selectedPayerPrefix.prefix : null,
        payer_phone_number: !isSameAsPayer ? (form.elements.namedItem('payerPhone') as HTMLInputElement)?.value || null : null,
        payer_id_number: !isSameAsPayer ? (form.elements.namedItem('payerIdNumber') as HTMLInputElement)?.value || null : null,
        payer_id_document: null, // TODO: Implement file upload
      };

      // Insert the customer into the database
      const { data: customer, error: insertError } = await supabase
        .from('customers')
        .insert([customerData])
        .select()
        .single();

      if (insertError) throw insertError;

      // Invoke the Edge Function to create the Stripe customer
      if (customer) { // Ensure we have the customer data returned
        console.log('Invoking create-stripe-customer function for:', customer.id);
        const { data: functionData, error: functionError } = await supabase.functions.invoke(
          'create-stripe-customer',
          {
            body: { record: customer }, // Pass the newly created customer record
          }
        );

        if (functionError) {
          console.error('Error invoking create-stripe-customer function:', functionError);
          // Optional: Show a specific toast, but the main success toast will still show
          toast({
            title: "Customer Sync Warning",
            description: "Customer saved locally, but failed to sync with payment system. Please check Stripe or try configuring payment later.",
            duration: 7000, // Longer duration for warning
          });
          // Decide if you want to throw the error here or let it continue
          // throw functionError; // Uncomment this if sync failure should stop the flow
        } else {
          console.log('Stripe customer creation initiated/successful:', functionData);
        }
      } else {
         console.warn('Customer data not available after insert, skipping Stripe sync.');
         // Optionally show a warning toast here as well
          toast({
            title: "Customer Sync Skipped",
            description: "Customer saved locally, but data wasn't immediately available to sync with payment system.",
            duration: 7000,
          });
      }

      toast({
        title: "Customer created",
        description: "The customer has been successfully created.",
      });
      setIsCreating(false);

      onComplete(customer);
    } catch (error: any) {
      console.error('Error creating customer:', error);
      toast({
        title: "Error creating customer",
        description: error.message || "Failed to create customer. Please try again.",
        variant: "destructive",
      });
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="mb-4" disabled={isCreating}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to customers
      </Button>

      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">New Customer</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Customer Information</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  placeholder="Enter first name"
                  required
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  placeholder="Enter last name"
                  required
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter email address"
                  required
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedPrefix.code}
                    onValueChange={(value) => {
                      const prefix = countryPrefixes.find(p => p.code === value);
                      if (prefix) setSelectedPrefix(prefix);
                    }}
                    disabled={isCreating}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          <span>{selectedPrefix.flag}</span>
                          <span className="hidden sm:inline">{selectedPrefix.prefix}</span>
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {countryPrefixes.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          <div className="flex items-center gap-2">
                            <span>{country.flag}</span>
                            <span>{country.name}</span>
                            <span className="text-muted-foreground ml-auto">
                              {country.prefix}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="Enter phone number"
                    className="flex-1"
                    required
                    disabled={isCreating}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="idNumber">ID Number</Label>
                <Input
                  id="idNumber"
                  name="idNumber"
                  placeholder="Enter ID number"
                  required
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="idDocument">
                  ID Document (Optional)
                </Label>
                <div className="border-2 border-dashed rounded-lg p-4">
                  <Input
                    id="idDocument"
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={(e) => handleIdDocumentChange(e)}
                    disabled={isCreating}
                  />
                  <Label
                    htmlFor="idDocument"
                    className={`cursor-pointer flex flex-col items-center space-y-2 ${isCreating ? 'opacity-50' : ''}`}
                  >
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Click to upload ID document
                    </span>
                    <span className="text-xs text-muted-foreground">
                      (PDF or image, max 5MB)
                    </span>
                  </Label>
                  {idDocument && (
                    <p className="mt-2 text-sm text-muted-foreground text-center">
                      Selected: {idDocument.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sameAsPayer"
                checked={isSameAsPayer}
                onCheckedChange={(checked) => setIsSameAsPayer(checked as boolean)}
                disabled={isCreating}
              />
              <Label htmlFor="sameAsPayer">
                Customer is the payer of the rent
              </Label>
            </div>

            {!isSameAsPayer && (
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Label>Payer Type</Label>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="person"
                        name="payerType"
                        value="person"
                        checked={payerType === "person"}
                        onChange={(e) => setPayerType(e.target.value as "person" | "company")}
                        className="h-4 w-4"
                        disabled={isCreating}
                      />
                      <Label htmlFor="person">Person</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="company"
                        name="payerType"
                        value="company"
                        checked={payerType === "company"}
                        onChange={(e) => setPayerType(e.target.value as "person" | "company")}
                        className="h-4 w-4"
                        disabled={isCreating}
                      />
                      <Label htmlFor="company">Company</Label>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="payerName">
                      {payerType === "person" ? "Full Name" : "Company Name"}
                    </Label>
                    <Input
                      id="payerName"
                      name="payerName"
                      placeholder={`Enter ${payerType === "person" ? "full name" : "company name"}`}
                      required={!isSameAsPayer}
                      disabled={isCreating}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payerEmail">Email</Label>
                    <Input
                      id="payerEmail"
                      name="payerEmail"
                      type="email"
                      placeholder="Enter email address"
                      required={!isSameAsPayer}
                      disabled={isCreating}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payerPhone">Phone Number</Label>
                    <div className="flex gap-2">
                      <Select
                        value={selectedPayerPrefix.code}
                        onValueChange={(value) => {
                          const prefix = countryPrefixes.find(p => p.code === value);
                          if (prefix) setSelectedPayerPrefix(prefix);
                        }}
                        disabled={isCreating}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue>
                            <div className="flex items-center gap-2">
                              <span>{selectedPayerPrefix.flag}</span>
                              <span className="hidden sm:inline">{selectedPayerPrefix.prefix}</span>
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {countryPrefixes.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                              <div className="flex items-center gap-2">
                                <span>{country.flag}</span>
                                <span>{country.name}</span>
                                <span className="text-muted-foreground ml-auto">
                                  {country.prefix}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        id="payerPhone"
                        name="payerPhone"
                        type="tel"
                        placeholder="Enter phone number"
                        className="flex-1"
                        required={!isSameAsPayer}
                        disabled={isCreating}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payerIdNumber">
                      {payerType === "person" ? "ID Number" : "Tax ID"}
                    </Label>
                    <Input
                      id="payerIdNumber"
                      name="payerIdNumber"
                      placeholder={`Enter ${payerType === "person" ? "ID number" : "tax ID"}`}
                      required={!isSameAsPayer}
                      disabled={isCreating}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="payerIdDocument">
                      {payerType === "person" ? "ID Document" : "Company Registration"} (Optional)
                    </Label>
                    <div className="border-2 border-dashed rounded-lg p-4">
                      <Input
                        id="payerIdDocument"
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf"
                        onChange={(e) => handleIdDocumentChange(e, true)}
                        disabled={isCreating}
                      />
                      <Label
                        htmlFor="payerIdDocument"
                        className={`cursor-pointer flex flex-col items-center space-y-2 ${isCreating ? 'opacity-50' : ''}`}
                      >
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Click to upload {payerType === "person" ? "ID document" : "company registration"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          (PDF or image, max 5MB)
                        </span>
                      </Label>
                      {payerIdDocument && (
                        <p className="mt-2 text-sm text-muted-foreground text-center">
                          Selected: {payerIdDocument.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              name="notes"
              placeholder="Enter any additional notes"
              disabled={isCreating}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <Button 
            variant="outline" 
            type="button" 
            onClick={onBack}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Customer...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create Customer
              </>
            )}
          </Button>
        </div>
      </form>

      {isCreating && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-lg font-medium">Creating your customer...</p>
            <p className="text-sm text-muted-foreground">This may take a few moments</p>
          </div>
        </div>
      )}
    </div>
  );
}