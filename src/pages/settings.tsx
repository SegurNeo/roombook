import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Plus, FileText, Globe, Loader2, ChevronLeft, ChevronRight, CreditCard, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";

type StripeConnectStatus = "not_connected" | "pending_verification" | "active" | "restricted" | "error";
interface PayoutAccountDetails {
  last4?: string;
  bankName?: string;
}

interface SettingsData {
  language: string;
  region: string;
  currency: string;
  dateFormat: string;
  numberFormat: string;
  measurementUnit: string;
}

export function Settings() {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState("amenities");
  const [amenities, setAmenities] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [showAddAmenity, setShowAddAmenity] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newAmenity, setNewAmenity] = useState({ name: "", description: "" });
  const [newService, setNewService] = useState({ name: "", description: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [totalAmenities, setTotalAmenities] = useState(0);
  const [servicesCurrentPage, setServicesCurrentPage] = useState(1);
  const [servicesPageSize, setServicesPageSize] = useState(5);
  const [totalServices, setTotalServices] = useState(0);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [currentSettings, setCurrentSettings] = useState<SettingsData>({
    language: 'en',
    region: 'eu',
    currency: 'eur',
    dateFormat: 'dd/mm/yyyy',
    numberFormat: '1,234.56',
    measurementUnit: 'metric'
  });
  const [isApplyingSettings, setIsApplyingSettings] = useState(false);
  const { toast } = useToast();

  const [connectAccountStatus, setConnectAccountStatus] = useState<StripeConnectStatus>("not_connected");
  const [accountDetails, setAccountDetails] = useState<PayoutAccountDetails | null>(null);
  const [isLoadingPayouts, setIsLoadingPayouts] = useState(true);
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          navigate("/auth/login");
          return;
        }
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', session.user.id)
          .single();
        if (profileError) throw profileError;
        if (!profile?.organization_id) {
          navigate("/auth/onboarding");
          return;
        }
        setOrganizationId(profile.organization_id);
        const { data: orgSettings, error: settingsError } = await supabase
          .from('organizations')
          .select('settings')
          .eq('id', profile.organization_id)
          .single();
        if (!settingsError && orgSettings?.settings) {
          setCurrentSettings(orgSettings.settings);
        }
      } catch (error: any) {
        console.error('Auth error:', error);
        toast({ title: "Authentication Error", description: "Please sign in to continue", variant: "destructive" });
        navigate("/auth/login");
      }
    };
    checkAuth();
  }, [navigate, toast]);

  useEffect(() => {
    if (organizationId) {
      fetchAmenities();
      fetchServices();
    }
  }, [currentPage, pageSize, servicesCurrentPage, servicesPageSize, organizationId]);

  useEffect(() => {
    const fetchPayoutAccountStatus = async () => {
      setIsLoadingPayouts(true);
      console.log("Simulating fetch of payout account status (runs on component mount for demo)...");
      setTimeout(() => {
        setConnectAccountStatus("active");
        setAccountDetails({ last4: "SMUL", bankName: "Banco Simulado Global" });
        setIsLoadingPayouts(false);
      }, 1200);
    };
    fetchPayoutAccountStatus();
  }, []);

  const fetchAmenities = async () => {
    if (!organizationId) return;
    
    setIsLoading(true);
    try {
      const { count, error: countError } = await supabase
        .from('amenities')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      if (countError) throw countError;
      setTotalAmenities(count || 0);

      const { data, error } = await supabase
        .from('amenities')
        .select('id, name, description, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      if (error) throw error;
      setAmenities(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching amenities",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchServices = async () => {
    if (!organizationId) return;
    
    setIsLoading(true);
    try {
      const { count, error: countError } = await supabase
        .from('services')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      if (countError) throw countError;
      setTotalServices(count || 0);

      const { data, error } = await supabase
        .from('services')
        .select('id, name, description, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .range((servicesCurrentPage - 1) * servicesPageSize, servicesCurrentPage * servicesPageSize - 1);

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching services",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAmenity = async () => {
    if (!organizationId) {
      toast({
        title: "Error",
        description: "No organization found",
        variant: "destructive"
      });
      return;
    }

    if (!newAmenity.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the amenity",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("No authenticated user found");

      const { data, error } = await supabase
        .from('amenities')
        .insert([{
          name: newAmenity.name.trim(),
          description: newAmenity.description.trim() || null,
          organization_id: organizationId,
          created_by: user.id
        }])
        .select()
        .single();

      if (error) throw error;

      setAmenities(prev => [...prev, data]);
      setShowAddAmenity(false);
      setNewAmenity({ name: "", description: "" });

      toast({
        title: "Amenity added",
        description: "The amenity has been successfully added.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add amenity",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddService = async () => {
    if (!organizationId) {
      toast({
        title: "Error",
        description: "No organization found",
        variant: "destructive"
      });
      return;
    }

    if (!newService.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the service",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("No authenticated user found");

      const { error } = await supabase
        .from('services')
        .insert([{
          name: newService.name.trim(),
          description: newService.description.trim() || null,
          organization_id: organizationId,
          created_by: user.id
        }])
        .select()
        .single();

      if (error) throw error;

      setShowAddService(false);
      setNewService({ name: "", description: "" });

      toast({
        title: "Service added",
        description: "The service has been successfully added.",
      });
      
      fetchServices();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add service",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAmenity = async (id: string) => {
    try {
      const { error } = await supabase
        .from('amenities')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Amenity deleted",
        description: "The amenity has been successfully deleted.",
      });

      fetchAmenities();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Service deleted",
        description: "The service has been successfully deleted.",
      });

      fetchServices();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleApplySettings = async () => {
    if (!organizationId) return;
    setIsApplyingSettings(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ settings: currentSettings })
        .eq('id', organizationId);
      if (error) throw error;
      toast({ title: "Settings updated", description: "Your preferences have been saved.", });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update settings", variant: "destructive" });
    } finally {
      setTimeout(() => setIsApplyingSettings(false), 500);
    }
  };

  const handleConnectWithStripe = async () => {
    setIsConnectingStripe(true);
    try {
      console.log("Simulating call to create-stripe-connect-account-link for organization:", organizationId);
      await new Promise(resolve => setTimeout(resolve, 1500));
      const simulatedStripeOnboardingUrl = `https://connect.stripe.com/express/onboarding/acct_simulatedAccountID?redirect_url=${encodeURIComponent(window.location.href)}`;
      toast({ title: "Redirigiendo a Stripe...", description: "Completa la configuración en la página de Stripe." });
      window.location.href = simulatedStripeOnboardingUrl;
    } catch (error: any) {
      console.error("Error connecting with Stripe:", error);
      toast({ title: "Error", description: error.message || "Could not connect with Stripe.", variant: "destructive" });
      setIsConnectingStripe(false);
    }
  };

  const totalPages = Math.ceil(totalAmenities / pageSize);
  const totalServicesPages = Math.ceil(totalServices / servicesPageSize);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <div className="border-b">
          <div className="max-w-screen-2xl mx-auto">
            <TabsList className="h-12 w-full justify-start space-x-8 bg-transparent p-0">
              <TabsTrigger 
                value="amenities"
                className="relative h-12 rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 font-medium text-muted-foreground hover:text-primary data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                Amenities & Services
              </TabsTrigger>
              <TabsTrigger 
                value="contracts"
                className="relative h-12 rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 font-medium text-muted-foreground hover:text-primary data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                Contracts
              </TabsTrigger>
              <TabsTrigger 
                value="localization"
                className="relative h-12 rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 font-medium text-muted-foreground hover:text-primary data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                Language & Region
              </TabsTrigger>
              <TabsTrigger value="payouts" className="relative h-12 rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 font-medium text-muted-foreground hover:text-primary data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none">
                💰 Payouts
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="amenities" className="space-y-6">
          <Card className="shadow-none">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Property Amenities</CardTitle>
              <Button onClick={() => setShowAddAmenity(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Amenity
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : amenities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          No amenities found
                        </TableCell>
                      </TableRow>
                    ) : (
                      amenities.map((amenity) => (
                        <TableRow key={amenity.id}>
                          <TableCell className="font-medium">{amenity.name}</TableCell>
                          <TableCell>{amenity.description || '-'}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAmenity(amenity.id)}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-muted-foreground">
                    Showing {Math.min(pageSize, amenities.length)} of {totalAmenities} entries
                  </p>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => {
                      setPageSize(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Additional Services</CardTitle>
              <Button onClick={() => setShowAddService(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : services.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          No services found
                        </TableCell>
                      </TableRow>
                    ) : (
                      services.map((service) => (
                        <TableRow key={service.id}>
                          <TableCell className="font-medium">{service.name}</TableCell>
                          <TableCell>{service.description || '-'}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteService(service.id)}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-muted-foreground">
                    Showing {Math.min(servicesPageSize, services.length)} of {totalServices} entries
                  </p>
                  <Select
                    value={servicesPageSize.toString()}
                    onValueChange={(value) => {
                      setServicesPageSize(Number(value));
                      setServicesCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setServicesCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={servicesCurrentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setServicesCurrentPage(prev => Math.min(totalServicesPages, prev + 1))}
                    disabled={servicesCurrentPage === totalServicesPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-6">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Default Contract Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="noticePeriod">Standard Notice Period (months)</Label>
                  <Input
                    id="noticePeriod"
                    type="number"
                    min="1"
                    placeholder="Enter number of months"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deposit">Security Deposit (months of rent)</Label>
                  <Input
                    id="deposit"
                    type="number"
                    min="1"
                    placeholder="Enter number of months"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minDuration">Minimum Contract Duration (months)</Label>
                  <Input
                    id="minDuration"
                    type="number"
                    min="1"
                    placeholder="Enter number of months"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rentCalculation">Default Rent Calculation</Label>
                  <Select>
                    <SelectTrigger id="rentCalculation">
                      <SelectValue placeholder="Select calculation method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Month</SelectItem>
                      <SelectItem value="natural">Natural Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Contract Templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Document Templates</Label>
                  <p className="text-sm text-muted-foreground">
                    Upload or create contract templates for different scenarios
                  </p>
                </div>
                <div className="space-x-2">
                  <Button variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                  <Button>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Template
                  </Button>
                </div>
              </div>
              <div className="border rounded-lg p-4">
                <Input
                  type="file"
                  className="hidden"
                  id="template-upload"
                  accept=".doc,.docx,.pdf"
                />
                <Label
                  htmlFor="template-upload"
                  className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50"
                >
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    Drag & drop files here or click to browse
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Supports DOC, DOCX, and PDF
                  </span>
                </Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="localization" className="space-y-6">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Regional Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select value={currentSettings.language} onValueChange={(value) => setCurrentSettings({ ...currentSettings, language: value })}>
                    <SelectTrigger id="language">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Select value={currentSettings.region} onValueChange={(value) => setCurrentSettings({ ...currentSettings, region: value })}>
                    <SelectTrigger id="region">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eu">European Union</SelectItem>
                      <SelectItem value="uk">United Kingdom</SelectItem>
                      <SelectItem value="us">United States</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={currentSettings.currency} onValueChange={(value) => setCurrentSettings({ ...currentSettings, currency: value })}>
                    <SelectTrigger id="currency">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eur">Euro (€)</SelectItem>
                      <SelectItem value="gbp">British Pound (£)</SelectItem>
                      <SelectItem value="usd">US Dollar ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Select value={currentSettings.dateFormat} onValueChange={(value) => setCurrentSettings({ ...currentSettings, dateFormat: value })}>
                    <SelectTrigger id="dateFormat">
                      <SelectValue placeholder="Select date format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dd/mm/yyyy">DD/MM/YYYY</SelectItem>
                      <SelectItem value="mm/dd/yyyy">MM/DD/YYYY</SelectItem>
                      <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Formatting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numberFormat">Number Format</Label>
                  <Select value={currentSettings.numberFormat} onValueChange={(value) => setCurrentSettings({ ...currentSettings, numberFormat: value })}>
                    <SelectTrigger id="numberFormat">
                      <SelectValue placeholder="Select number format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1,234.56">1,234.56</SelectItem>
                      <SelectItem value="1.234,56">1.234,56</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="measurementUnit">Measurement Unit</Label>
                  <Select value={currentSettings.measurementUnit} onValueChange={(value) => setCurrentSettings({ ...currentSettings, measurementUnit: value })}>
                    <SelectTrigger id="measurementUnit">
                      <SelectValue placeholder="Select measurement unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="metric">Metric (m², km)</SelectItem>
                      <SelectItem value="imperial">Imperial (sq ft, mi)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <Button 
                  onClick={handleApplySettings}
                  disabled={isApplyingSettings}
                >
                  {isApplyingSettings ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Applying Changes...
                    </>
                  ) : (
                    <>
                      <Globe className="h-4 w-4 mr-2" />
                      Apply Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Pagos</CardTitle>
              <CardDescription>
                Administra la cuenta bancaria donde recibirás tus ingresos por alquileres.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingPayouts ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-2">Cargando estado de la cuenta de pagos...</p>
                </div>
              ) : connectAccountStatus === "not_connected" ? (
                <div className="p-6 border-2 border-dashed rounded-lg text-center space-y-3">
                  <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="text-xl font-semibold">Conecta tu cuenta bancaria</h3>
                  <p className="text-muted-foreground">
                    Para recibir tus ingresos, necesitas conectar tu cuenta de forma segura a través de Stripe.
                  </p>
                  <Button 
                    onClick={handleConnectWithStripe} 
                    disabled={isConnectingStripe}
                    size="lg" 
                    className="mt-2"
                  >
                    {isConnectingStripe ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                    Conectar con Stripe
                  </Button>
                </div>
              ) : connectAccountStatus === "pending_verification" ? (
                <div className="p-6 border border-yellow-300 bg-yellow-50 rounded-lg text-yellow-700 space-y-3">
                  <AlertCircle className="mx-auto h-10 w-10" />
                  <h3 className="text-lg font-semibold text-center">Verificación Pendiente</h3>
                  <p className="text-sm">
                    Tu cuenta de Stripe está siendo verificada. Este proceso puede tardar unos minutos o, en algunos casos, Stripe podría contactarte para solicitar documentación adicional.
                  </p>
                  <p className="text-sm">
                    Puedes <a href="https://dashboard.stripe.com/account" target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-800">revisar el estado en tu dashboard de Stripe</a>.
                  </p>
                </div>
              ) : connectAccountStatus === "active" && accountDetails ? (
                <div className="p-6 border border-green-300 bg-green-50 rounded-lg text-green-700 space-y-4">
                  <div className="flex items-center justify-center text-center space-x-2">
                    <CheckCircle2 className="h-10 w-10" />
                    <h3 className="text-lg font-semibold">¡Cuenta Conectada y Activa!</h3>
                  </div>
                  <p className="text-sm text-center">Estás listo para recibir pagos en la siguiente cuenta:</p>
                  <div className="p-4 bg-background border rounded-md text-foreground">
                    <p><strong>Banco:</strong> {accountDetails.bankName || 'N/D'}</p>
                    <p><strong>Terminación IBAN:</strong> **** {accountDetails.last4 || 'N/D'}</p>
                  </div>
                  <Button 
                    onClick={() => window.open("https://dashboard.stripe.com/account", "_blank")} 
                    variant="outline"
                    className="w-full"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Gestionar cuenta en Stripe
                  </Button>
                </div>
              ) : connectAccountStatus === "restricted" ? (
                 <div className="p-6 border border-red-300 bg-red-50 rounded-lg text-red-700 space-y-3">
                  <AlertCircle className="mx-auto h-10 w-10" />
                  <h3 className="text-lg font-semibold text-center">Cuenta Restringida</h3>
                  <p className="text-sm">
                   Tu cuenta de Stripe tiene restricciones que impiden los pagos. Stripe te habrá notificado sobre los pasos necesarios.
                  </p>
                  <Button 
                    onClick={() => window.open("https://dashboard.stripe.com/account", "_blank")} 
                    variant="outline"
                    className="w-full border-red-300 text-red-700 hover:bg-red-100"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Resolver problemas en Stripe
                  </Button>
                </div>
              ) : connectAccountStatus === "error" ? (
                <p className="text-red-600">Hubo un error al cargar la información de tu cuenta de pagos. Por favor, inténtalo de nuevo más tarde.</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddAmenity} onOpenChange={setShowAddAmenity}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Amenity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amenityName">Name</Label>
              <Input
                id="amenityName"
                placeholder="Enter amenity name"
                value={newAmenity.name}
                onChange={(e) => setNewAmenity(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amenityDescription">Description (Optional)</Label>
              <Textarea
                id="amenityDescription"
                placeholder="Enter a description of the amenity"
                value={newAmenity.description}
                onChange={(e) => setNewAmenity(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddAmenity(false);
                setNewAmenity({ name: "", description: "" });
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleAddAmenity} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Amenity
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddService} onOpenChange={setShowAddService}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="serviceName">Name</Label>
              <Input
                id="serviceName"
                placeholder="Enter service name"
                value={newService.name}
                onChange={(e) => setNewService(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serviceDescription">Description (Optional)</Label>
              <Textarea
                id="serviceDescription"
                placeholder="Enter a description of the service"
                value={newService.description}
                onChange={(e) => setNewService(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddService(false);
                setNewService({ name: "", description: "" });
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleAddService} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Service
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}