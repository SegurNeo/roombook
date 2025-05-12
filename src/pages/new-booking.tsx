import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Check, Calendar as CalendarIcon, Share, Mail, MessageSquare, Send, CreditCard } from "lucide-react";
import { format, addMonths, isBefore, isAfter, differenceInMonths, startOfToday, endOfMonth, differenceInDays, startOfMonth } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { CustomerSearch } from "@/components/customer-search";
import { RoomSearch } from "@/components/room-search";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NewBookingProps {
  onBack: () => void;
  onComplete: (bookingData: any) => void;
}

type DurationType = "months" | "custom";

export function NewBooking({ onBack, onComplete }: NewBookingProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [durationType, setDurationType] = useState<DurationType>("months");
  const [monthsDuration, setMonthsDuration] = useState<string>("12");
  const [entryDate, setEntryDate] = useState<Date>();
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });
  const [rentPrice, setRentPrice] = useState<string>("");
  const [depositType, setDepositType] = useState<"months" | "custom">("months");
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [depositMonths, setDepositMonths] = useState<string>("2");
  const [noticeMonths, setNoticeMonths] = useState<string>("2");
  const [rentCalculation, setRentCalculation] = useState<"full" | "natural">("full");
  const [paymentCollectionMethod, setPaymentCollectionMethod] = useState<"automatic" | "manual">("automatic");
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const calculateFirstMonthRent = () => {
    if (!rentPrice || !dateRange.from) return 0;
    const baseRent = parseFloat(rentPrice);
    
    if (rentCalculation === "full") {
      return baseRent;
    } else {
      const daysInMonth = differenceInDays(endOfMonth(dateRange.from), dateRange.from) + 1;
      const totalDaysInMonth = differenceInDays(endOfMonth(dateRange.from), startOfMonth(dateRange.from)) + 1;
      return (baseRent / totalDaysInMonth) * daysInMonth;
    }
  };

  const generatePaymentTimeline = () => {
    if (!dateRange.from || !dateRange.to || !rentPrice) return [];
    
    const timeline = [];
    const firstMonthRent = calculateFirstMonthRent();
    const baseRent = parseFloat(rentPrice);
    const depositAmount = baseRent * parseInt(depositMonths);
    
    timeline.push({
      date: dateRange.from,
      type: 'Deposit',
      amount: depositAmount,
      description: `Security deposit (${depositMonths} months)`
    });

    timeline.push({
      date: dateRange.from,
      type: 'Rent',
      amount: firstMonthRent,
      description: rentCalculation === "natural" 
        ? `First month's rent (pro-rated for ${differenceInDays(endOfMonth(dateRange.from), dateRange.from) + 1} days)`
        : "First month's rent"
    });

    let currentDate = addMonths(startOfMonth(dateRange.from), 1);
    while (isBefore(currentDate, dateRange.to)) {
      timeline.push({
        date: currentDate,
        type: 'Rent',
        amount: baseRent,
        description: "Monthly rent"
      });
      currentDate = addMonths(currentDate, 1);
    }

    return timeline;
  };

  const handleMonthsDurationChange = (value: string) => {
    const months = parseInt(value);
    if (isNaN(months) || months < 3) {
      setMonthsDuration("3");
      if (entryDate) {
        setDateRange({
          from: entryDate,
          to: addMonths(entryDate, 3)
        });
      }
      return;
    }
    
    setMonthsDuration(value);
    if (entryDate) {
      setDateRange({
        from: entryDate,
        to: addMonths(entryDate, months)
      });
    }
  };

  const handleEntryDateSelect = (date: Date | undefined) => {
    setEntryDate(date);
    if (date) {
      const months = Math.max(3, parseInt(monthsDuration) || 3);
      setDateRange({
        from: date,
        to: addMonths(date, months)
      });
    } else {
      setDateRange({ from: undefined, to: undefined });
    }
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step === 1) {
      if (!selectedCustomer || !selectedRoom || !dateRange.from || !dateRange.to) {
        toast({
          title: "Missing information",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      const monthsDifference = differenceInMonths(dateRange.to, dateRange.from);
      if (monthsDifference < 3) {
        toast({
          title: "Invalid contract duration",
          description: "The contract duration must be at least 3 months",
          variant: "destructive",
        });
        return;
      }

      setStep(2);
    } else if (step === 2) {
      if (!rentPrice || !depositMonths || !noticeMonths) {
        toast({
          title: "Missing information",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dateRange.from || !dateRange.to) {
      toast({
        title: "Missing date range",
        description: "Start date or end date is missing.",
        variant: "destructive",
      });
      setIsCreating(false);
      return;
    }

    if (!rentPrice || !depositMonths || !noticeMonths) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      if (!user) {
        throw new Error("No authenticated user found");
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      if (!profile?.organization_id) {
        throw new Error("User does not belong to an organization");
      }

      // Calculate deposit amount based on type
      const finalDepositAmount = depositType === "months"
        ? parseFloat(rentPrice) * parseInt(depositMonths)
        : parseFloat(depositAmount);

      // Create the booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert([{
          customer_id: selectedCustomer.id,
          room_id: selectedRoom.id,
          start_date: dateRange.from.toISOString(),
          end_date: dateRange.to.toISOString(),
          organization_id: profile.organization_id,
          created_by: user.id,
          status: 'active',
          rent_price: parseFloat(rentPrice),
          deposit_months: parseInt(depositMonths),
          deposit_amount: finalDepositAmount,
          notice_period_months: parseInt(noticeMonths),
          rent_calculation: rentCalculation,
          payment_collection_method: paymentCollectionMethod,
        }])
        .select()
        .single();

      if (bookingError) throw bookingError;
      if (!booking) throw new Error("Booking creation returned no data.");

      // **** NUEVA LÓGICA PARA CREAR RENT_TRANSACTIONS ****
      const paymentTimeline = generatePaymentTimeline();
      if (paymentTimeline.length > 0) {
        const rentTransactionsToInsert = paymentTimeline.map(payment => ({
          booking_id: booking.id, // ID del booking recién creado
          customer_id: selectedCustomer.id,
          room_id: selectedRoom.id,
          organization_id: profile.organization_id,
          created_by: user.id,
          due_date: format(payment.date, 'yyyy-MM-dd'), // Asegurar formato correcto para la BD
          amount: payment.amount,
          type: payment.type.toLowerCase() as 'rent' | 'deposit', // 'Rent' o 'Deposit'
          status: paymentCollectionMethod === 'automatic' ? 'scheduled' : 'pending',
        }));

        console.log("Attempting to insert rent_transactions:", JSON.stringify(rentTransactionsToInsert, null, 2));

        const { error: rentTransactionsError } = await supabase
          .from('rent_transactions')
          .insert(rentTransactionsToInsert);

        if (rentTransactionsError) {
          // Si falla la creación de rent_transactions, podríamos considerar qué hacer.
          // ¿Eliminar el booking? ¿Marcarlo de alguna forma? ¿Solo loguear el error?
          // Por ahora, solo logueamos y notificamos, pero el booking ya existe.
          console.error('Error creating rent transactions:', rentTransactionsError);
          toast({
            title: "Error creating rent transactions",
            description: rentTransactionsError.message,
            variant: "destructive",
          });
          // NO continuar con onComplete si las transacciones fallan, ya que el estado es inconsistente.
          // setIsCreating(false) ya se maneja en el catch general o finally.
          throw new Error(`Booking created (ID: ${booking.id}), but failed to create its rent transactions.`);
        } else {
          console.log(`${rentTransactionsToInsert.length} rent transactions created for booking ${booking.id} with status: ${paymentCollectionMethod === 'automatic' ? 'scheduled' : 'pending'}`);

          if (paymentCollectionMethod === 'automatic') {
            try {
              console.log(`Attempting to schedule Stripe invoices for AUTOMATIC booking ID: ${booking.id}`);
              const { data: scheduleData, error: scheduleErrorFn } = await supabase.functions.invoke(
                "schedule-stripe-invoices",
                { body: { booking_id: booking.id } }
              );

              if (scheduleErrorFn) {
                console.error('Error invoking schedule-stripe-invoices:', scheduleErrorFn);
                toast({
                  title: "Error scheduling invoices",
                  description: `Rent transactions created, but failed to trigger invoice scheduling: ${scheduleErrorFn.message}. Please check Stripe or trigger manually.`,
                  variant: "default", 
                });
              } else if (scheduleData?.error) {
                console.error('Error from schedule-stripe-invoices function:', scheduleData.error);
                toast({
                  title: "Invoice Scheduling Problem",
                  description: `Rent transactions created, but there was an issue during invoice scheduling: ${scheduleData.error}. Please check Stripe or trigger manually.`,
                  variant: "default",
                });
              } else {
                console.log('schedule-stripe-invoices invoked successfully:', scheduleData);
                toast({
                  title: "Invoice Scheduling Initiated",
                  description: scheduleData?.message || "Stripe invoices are being scheduled.",
                  variant: "default", 
                });
              }
            } catch (invokeInternalError: any) {
              console.error('Unexpected error invoking schedule-stripe-invoices:', invokeInternalError);
              toast({
                title: "Error during invoice scheduling invocation",
                description: `Rent transactions created, but failed to trigger invoice scheduling: ${invokeInternalError.message}. Please check Stripe or trigger manually.`,
                variant: "default",
              });
            }
          } else {
            console.log(`Booking ID: ${booking.id} is MANUAL. Skipping Stripe invoice scheduling.`);
          }
        }
      }
      // **** FIN DE NUEVA LÓGICA ****

      toast({
        title: "Booking created",
        description: "Booking and rent transactions created. Invoice scheduling is in process.",
      });

      onComplete(booking);
    } catch (error: any) {
      console.error('Error creating booking:', error);
      toast({
        title: "Error creating booking",
        description: error.message || "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const today = startOfToday();

  const getNoticePeriodEndDate = () => {
    if (!dateRange.to || !noticeMonths) return null;
    return addMonths(dateRange.to, parseInt(noticeMonths));
  };

  const handleShare = async (method: 'email' | 'whatsapp' | 'sms') => {
    try {
      // Calculate timeline and totalAmount within handleShare
      const timeline = generatePaymentTimeline();
      const totalAmount = timeline.reduce((sum, item) => sum + item.amount, 0);

      // Ensure dates are defined before using format
      if (!dateRange.from || !dateRange.to) {
        throw new Error("Date range is not defined for sharing.");
      }
      const noticeEndDate = getNoticePeriodEndDate();
      if (!noticeEndDate) {
        throw new Error("Notice period end date could not be calculated.");
      }

      // Reformat contractData slightly to ensure no duplicates
      const contractData = {
        customer: {
          name: `${selectedCustomer.first_name} ${selectedCustomer.last_name}`,
          email: selectedCustomer.email,
          phone: `${selectedCustomer.phone_prefix}${selectedCustomer.phone_number}`,
        },
        property: {
          name: selectedRoom.name,
          asset: selectedRoom.asset_name,
          details: `${selectedRoom.capacity} room • ${selectedRoom.bathroom} bathroom`,
        },
        contract: {
          startDate: format(dateRange.from, "PPP"),
          endDate: format(dateRange.to, "PPP"),
          duration: `${differenceInMonths(dateRange.to, dateRange.from)} months`,
          noticePeriod: `${noticeMonths} months`,
          noticeDate: format(noticeEndDate, "PPP"),
        },
        financial: {
          monthlyRent: parseFloat(rentPrice),
          securityDeposit: parseFloat(depositAmount),
          depositMonths: parseInt(depositMonths),
          firstMonthCalculation: rentCalculation,
          totalValue: totalAmount,
        },
        timeline: timeline,
      };

      toast({
        title: "Sending contract...",
        description: `The contract will be sent via ${method}`,
      });

      console.log('Sending contract via:', method, contractData);
    } catch (error: any) {
      toast({
        title: "Error sending contract",
        description: error.message || "Failed to send contract",
        variant: "destructive",
      });
    }
  };

  if (step === 3) {
    const timeline = generatePaymentTimeline();
    const totalAmount = timeline.reduce((sum, item) => sum + item.amount, 0);
    
    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => setStep(2)} 
          className="mb-4" 
          disabled={isCreating}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to payment details
        </Button>

        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Contract Preview</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Share className="h-4 w-4 mr-2" />
                Share Contract
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleShare('email')}>
                <Mail className="h-4 w-4 mr-2" />
                Send via Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('whatsapp')}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Send via WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('sms')}>
                <Send className="h-4 w-4 mr-2" />
                Send via SMS
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border rounded-lg shadow-none">
            <CardHeader>
              <CardTitle>Contract Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Customer</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedCustomer.first_name} {selectedCustomer.last_name}
                  <br />
                  {selectedCustomer.email}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Property</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedRoom.name} in {selectedRoom.asset_name}
                  <br />
                  {selectedRoom.capacity} room • {selectedRoom.bathroom} bathroom
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Duration</h4>
                <p className="text-sm text-muted-foreground">
                  From: {format(dateRange.from!, "PPP")}
                  <br />
                  To: {format(dateRange.to!, "PPP")}
                  <br />
                  ({differenceInMonths(dateRange.to!, dateRange.from!)} months)
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Notice Period</h4>
                <p className="text-sm text-muted-foreground">
                  {noticeMonths} months
                  <br />
                  Must be given before: {format(getNoticePeriodEndDate()!, "PPP")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border rounded-lg shadow-none">
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Monthly Rent</h4>
                <p className="text-sm text-muted-foreground">
                  €{parseFloat(rentPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Security Deposit</h4>
                <p className="text-sm text-muted-foreground">
                  {depositMonths} months = €{(parseFloat(rentPrice) * parseInt(depositMonths)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">First Month Calculation</h4>
                <p className="text-sm text-muted-foreground">
                  {rentCalculation === "full" 
                    ? "Full month from entry date"
                    : `Pro-rated until end of ${format(dateRange.from!, "MMMM yyyy")}`}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Total Contract Value</h4>
                <p className="text-lg font-semibold">
                  €{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border rounded-lg shadow-none">
          <CardHeader>
            <CardTitle>Payment Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {timeline.map((payment, index) => (
                <div key={index} className="flex items-center justify-between py-2">
                  <div className="space-y-1">
                    <p className="font-medium">{payment.type}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(payment.date, "PPP")} - {payment.description}
                    </p>
                  </div>
                  <p className="font-medium">
                    €{payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button 
            variant="outline" 
            type="button" 
            onClick={onBack}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Booking...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create Booking
              </>
            )}
          </Button>
        </div>

        {isCreating && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-lg font-medium">Creating your booking...</p>
              <p className="text-sm text-muted-foreground">This may take a few moments</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => setStep(1)} 
          className="mb-4" 
          disabled={isCreating}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to contract details
        </Button>

        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Payment Details</h2>
        </div>

        <form onSubmit={handleContinue} className="space-y-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rentPrice">Monthly Rent (€)</Label>
              <Input
                id="rentPrice"
                type="number"
                min="0"
                step="0.01"
                value={rentPrice}
                onChange={(e) => setRentPrice(e.target.value)}
                placeholder="Enter monthly rent"
                required
                disabled={isCreating}
              />
            </div>

            <div className="space-y-2">
              <Label>Security Deposit</Label>
              <RadioGroup
                value={depositType}
                onValueChange={(value: "months" | "custom") => {
                  setDepositType(value);
                  if (value === "months") {
                    setDepositMonths("2");
                    if (rentPrice) {
                      setDepositAmount((parseFloat(rentPrice) * 2).toString());
                    }
                  } else {
                    setDepositAmount(depositAmount || "");
                    if (rentPrice && depositAmount) {
                      setDepositMonths((parseFloat(depositAmount) / parseFloat(rentPrice)).toFixed(2));
                    }
                  }
                }}
                className="grid gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="months" id="deposit-months" />
                  <Label htmlFor="deposit-months" className="font-normal">
                    Calculate by months
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="deposit-custom" />
                  <Label htmlFor="deposit-custom" className="font-normal">
                    Custom amount
                  </Label>
                </div>
              </RadioGroup>

              {depositType === "months" ? (
                <div className="space-y-2 mt-4">
                  <Label htmlFor="depositMonths">Number of Months</Label>
                  <Input
                    id="depositMonths"
                    type="number"
                    min="1"
                    value={depositMonths}
                    onChange={(e) => {
                      setDepositMonths(e.target.value);
                      if (rentPrice && !isNaN(parseFloat(rentPrice))) {
                        setDepositAmount((parseFloat(rentPrice) * parseInt(e.target.value)).toString());
                      }
                    }}
                    placeholder="Enter number of months"
                    required
                    disabled={isCreating}
                  />
                </div>
              ) : (
                <div className="space-y-2 mt-4">
                  <Label htmlFor="depositAmount">Custom Amount (€)</Label>
                  <Input
                    id="depositAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => {
                      setDepositAmount(e.target.value);
                      if (rentPrice && !isNaN(parseFloat(rentPrice))) {
                        setDepositMonths((parseFloat(e.target.value) / parseFloat(rentPrice)).toFixed(2));
                      }
                    }}
                    placeholder="Enter deposit amount"
                    required
                    disabled={isCreating}
                  />
                </div>
              )}

              {rentPrice && depositAmount && !isNaN(parseFloat(rentPrice)) && !isNaN(parseFloat(depositAmount)) && (
                <p className="text-sm text-muted-foreground mt-2">
                  Security deposit amount: €{parseFloat(depositAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {depositType === "months" && ` (${depositMonths} months)`}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="noticeMonths">Notice Period (Months)</Label>
              <Input
                id="noticeMonths"
                type="number"
                min="1"
                value={noticeMonths}
                onChange={(e) => setNoticeMonths(e.target.value)}
                placeholder="Enter notice period in months"
                required
                disabled={isCreating}
              />
              {dateRange.to && noticeMonths && (
                <p className="text-sm text-muted-foreground mt-2">
                  Notice must be given before {format(getNoticePeriodEndDate()!, "PPP")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>First Month Rent Calculation</Label>
              <RadioGroup
                value={rentCalculation}
                onValueChange={(value: "full" | "natural") => setRentCalculation(value)}
                className="grid gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="full" id="full" />
                  <Label htmlFor="full" className="font-normal">
                    Full Month (from entry date + 30 days)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="natural" id="natural" />
                  <Label htmlFor="natural" className="font-normal">
                    Natural Month (from entry date until end of month)
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-sm text-muted-foreground mt-2">
                {rentCalculation === "full" 
                  ? "The first month's rent will be calculated for a full 30-day period from the entry date."
                  : "The first month's rent will be calculated proportionally from the entry date until the end of the month."}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Payment Collection Method</Label>
              <RadioGroup
                value={paymentCollectionMethod}
                onValueChange={(value: "automatic" | "manual") => setPaymentCollectionMethod(value)}
                className="grid grid-cols-2 gap-4"
                disabled={isCreating}
              >
                <Label 
                  htmlFor="collection-automatic" 
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <RadioGroupItem value="automatic" id="collection-automatic" className="sr-only" />
                  <CreditCard className="mb-3 h-6 w-6" />
                  Automatic (SEPA)
                </Label>
                <Label 
                  htmlFor="collection-manual" 
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <RadioGroupItem value="manual" id="collection-manual" className="sr-only" />
                  <Send className="mb-3 h-6 w-6" />
                  Manual
                </Label>
              </RadioGroup>
              <p className="text-sm text-muted-foreground mt-1">
                {paymentCollectionMethod === "automatic"
                  ? "Rent will be collected automatically via SEPA Direct Debit if a mandate is active."
                  : "Rent payments will need to be manually recorded."}
              </p>
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
            <Button type="submit">
              Continue
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="mb-4" disabled={isCreating}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to bookings
      </Button>

      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">New Booking</h2>
      </div>

      <form onSubmit={handleContinue} className="space-y-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Customer</Label>
            <CustomerSearch
              onSelect={(customer) => setSelectedCustomer(customer)}
            />
            {selectedCustomer && (
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {selectedCustomer.first_name} {selectedCustomer.last_name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Room</Label>
            <RoomSearch
              onSelect={(room) => setSelectedRoom(room)}
            />
            {selectedRoom && (
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {selectedRoom.name} in {selectedRoom.asset_name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Contract Duration (Minimum 3 months)</Label>
            <RadioGroup
              value={durationType}
              onValueChange={(value: DurationType) => setDurationType(value)}
              className="grid gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="months" id="months" />
                <Label htmlFor="months" className="font-normal">
                  Specify duration in months
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="font-normal">
                  Choose custom dates
                </Label>
              </div>
            </RadioGroup>

            {durationType === "months" ? (
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Entry Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !entryDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {entryDate ? format(entryDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={entryDate}
                        onSelect={handleEntryDateSelect}
                        disabled={(date) => isBefore(date, today)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (Months)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="3"
                    value={monthsDuration}
                    onChange={(e) => handleMonthsDurationChange(e.target.value)}
                    placeholder="Enter number of months (minimum 3)"
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    Minimum duration is 3 months
                  </p>
                </div>

                {dateRange.from && dateRange.to && (
                  <div className="text-sm text-muted-foreground">
                    Contract period: {format(dateRange.from, "PPP")} - {format(dateRange.to, "PPP")}
                    <br />
                    Duration: {differenceInMonths(dateRange.to, dateRange.from)} months
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 mt-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "PPP")} - {format(dateRange.to, "PPP")}
                          </>
                        ) : (
                          format(dateRange.from, "PPP")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={(newRange: any) => { 
                        if (newRange?.from && newRange.to) {
                          const months = differenceInMonths(newRange.to, newRange.from);
                          if (months < 3) {
                            newRange.to = addMonths(newRange.from, 3);
                          }
                        }
                        const rangeToSet = newRange ? { from: newRange.from, to: newRange.to } : { from: undefined, to: undefined };
                        setDateRange(rangeToSet);
                      }}
                      numberOfMonths={2}
                      disabled={(date): boolean => 
                        (isBefore(date, today) || 
                        (dateRange.from && isAfter(date, addMonths(dateRange.from, 24)))) || false
                      }
                    />
                  </PopoverContent>
                </Popover>

                {dateRange.from && dateRange.to && (
                  <div className="text-sm text-muted-foreground">
                    Contract period: {format(dateRange.from, "PPP")} - {format(dateRange.to, "PPP")}
                    <br />
                    Duration: {differenceInMonths(dateRange.to, dateRange.from)} months
                  </div>
                )}
              </div>
            )}
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
          <Button type="submit">
            Continue
          </Button>
        </div>
      </form>
    </div>
  );
}