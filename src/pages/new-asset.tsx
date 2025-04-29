import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, Plus, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { AddressInput } from "@/components/address-input";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface NewAssetProps {
  onBack: () => void;
  onContinue: (data: any, numberOfRooms: number) => void;
}

interface Address {
  street: string;
  number: string;
  other: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

interface Amenity {
  id: string;
  name: string;
  description: string;
}

interface Service {
  id: string;
  name: string;
  description: string;
}

export function NewAsset({ onBack, onContinue }: NewAssetProps) {
  const [images, setImages] = useState<File[]>([]);
  const [managementModel, setManagementModel] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<Date>();
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [address, setAddress] = useState<Address | null>(null);
  const [numberOfRooms, setNumberOfRooms] = useState<string>("");
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddAmenity, setShowAddAmenity] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [newAmenity, setNewAmenity] = useState({ name: "", description: "" });
  const [newService, setNewService] = useState({ name: "", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const getOrganizationId = async () => {
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

        setOrganizationId(profile.organization_id);
        fetchAmenitiesAndServices(profile.organization_id);
      } catch (error: any) {
        console.error('Error getting organization ID:', error);
        toast({
          title: "Error",
          description: "Failed to load organization data",
          variant: "destructive"
        });
      }
    };

    getOrganizationId();
  }, []);

  const fetchAmenitiesAndServices = async (orgId: string) => {
    try {
      setLoading(true);
      const [{ data: amenitiesData, error: amenitiesError }, { data: servicesData, error: servicesError }] = await Promise.all([
        supabase.from('amenities').select('*').eq('organization_id', orgId),
        supabase.from('services').select('*').eq('organization_id', orgId)
      ]);

      if (amenitiesError) throw amenitiesError;
      if (servicesError) throw servicesError;

      setAmenities(amenitiesData || []);
      setServices(servicesData || []);
    } catch (error: any) {
      console.error('Error fetching amenities and services:', error);
      toast({
        title: "Error",
        description: "Failed to load amenities and services",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddAmenity = async () => {
    if (!organizationId) {
      toast({
        title: "Error",
        description: "Organization data not loaded",
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

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
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
      setSelectedAmenities(prev => [...prev, data.name]);
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
      setIsSubmitting(false);
    }
  };

  const handleAddService = async () => {
    if (!organizationId) {
      toast({
        title: "Error",
        description: "Organization data not loaded",
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

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user found");

      const { data, error } = await supabase
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

      setServices(prev => [...prev, data]);
      setSelectedServices(prev => [...prev, data.name]);
      setShowAddService(false);
      setNewService({ name: "", description: "" });

      toast({
        title: "Service added",
        description: "The service has been successfully added.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add service",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 10) {
      toast({
        title: "Too many images",
        description: "You can only upload up to 10 images",
        variant: "destructive",
      });
      return;
    }
    setImages(files);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) {
      toast({
        title: "Address required",
        description: "Please enter a valid address",
        variant: "destructive",
      });
      return;
    }
    const rooms = parseInt(numberOfRooms);
    if (!rooms || rooms < 1) {
      toast({
        title: "Invalid number of rooms",
        description: "Please enter at least one room",
        variant: "destructive",
      });
      return;
    }

    const formData = {
      address,
      reference: (document.getElementById('reference') as HTMLInputElement)?.value,
      bathrooms: parseInt((document.getElementById('bathrooms') as HTMLInputElement)?.value || "0"),
      photos: images,
      purchasePrice: parseFloat((document.getElementById('purchasePrice') as HTMLInputElement)?.value || "0"),
      purchaseDate,
      managementModel,
      monthlyRent: parseFloat((document.getElementById('monthlyRent') as HTMLInputElement)?.value || "0"),
      managementPercentage: parseFloat((document.getElementById('managementPercentage') as HTMLInputElement)?.value || "0"),
      amenities: selectedAmenities,
      services: selectedServices,
    };

    onContinue(formData, rooms);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-lg font-medium">Loading amenities and services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to assets
      </Button>
      <h2 className="text-3xl font-bold tracking-tight">New Asset</h2>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">General Information</h3>
            <div className="grid gap-6">
              <div>
                <AddressInput onAddressChange={setAddress} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Public Reference (Optional)</Label>
                <Input id="reference" placeholder="Referencia catastral" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Asset Details</h3>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rooms">Number of Rooms</Label>
                <Input 
                  id="rooms" 
                  type="number" 
                  min="1" 
                  value={numberOfRooms}
                  onChange={(e) => setNumberOfRooms(e.target.value)}
                  placeholder="Enter number of rooms"
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bathrooms">Number of Bathrooms</Label>
                <Input id="bathrooms" type="number" min="0" required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="images">Property Photos</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Input
                    id="images"
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  <Label
                    htmlFor="images"
                    className="cursor-pointer flex flex-col items-center space-y-2"
                  >
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Click to upload images (max 10)
                    </span>
                  </Label>
                  {images.length > 0 && (
                    <div className="mt-4 text-sm text-muted-foreground">
                      {images.length} images selected
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Other Information</h3>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="purchasePrice">Purchase Price (Optional)</Label>
                <Input 
                  id="purchasePrice" 
                  type="number" 
                  min="0" 
                  step="0.01"
                  placeholder="Enter purchase price" 
                />
              </div>
              <div className="space-y-2">
                <Label>Purchase Date (Optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !purchaseDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {purchaseDate ? format(purchaseDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={purchaseDate}
                      onSelect={setPurchaseDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="managementModel">Management Model (Optional)</Label>
                <Select value={managementModel} onValueChange={setManagementModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select management model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rent-to-rent">Rent to Rent</SelectItem>
                    <SelectItem value="full-management">Full Management</SelectItem>
                    <SelectItem value="property">Property Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {managementModel === "rent-to-rent" && (
                <div className="space-y-2">
                  <Label htmlFor="monthlyRent">Monthly Rent</Label>
                  <Input 
                    id="monthlyRent" 
                    type="number" 
                    min="0" 
                    step="0.01"
                    placeholder="Enter monthly rent"
                    required 
                  />
                </div>
              )}
              {managementModel === "full-management" && (
                <div className="space-y-2">
                  <Label htmlFor="managementPercentage">Management Percentage</Label>
                  <Input 
                    id="managementPercentage" 
                    type="number" 
                    min="0" 
                    max="100"
                    step="0.1"
                    placeholder="Enter percentage"
                    required 
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Amenities</h3>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setShowAddAmenity(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Amenity
              </Button>
            </div>
            {amenities.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">No amenities found. Add your first amenity to get started.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {amenities.map((amenity) => (
                  <div key={amenity.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={amenity.id}
                      checked={selectedAmenities.includes(amenity.name)}
                      onCheckedChange={(checked) => {
                        setSelectedAmenities(current =>
                          checked
                            ? [...current, amenity.name]
                            : current.filter(name => name !== amenity.name)
                        );
                      }}
                    />
                    <Label
                      htmlFor={amenity.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {amenity.name}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Services</h3>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setShowAddService(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {services.map((service) => (
                <div key={service.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={service.id}
                    checked={selectedServices.includes(service.name)}
                    onCheckedChange={(checked) => {
                      setSelectedServices(current =>
                        checked
                          ? [...current, service.name]
                          : current.filter(name => name !== service.name)
                      );
                    }}
                  />
                  <Label
                    htmlFor={service.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {service.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <Button variant="outline" type="button" onClick={onBack}>
            Cancel
          </Button>
          <Button type="submit">Continue</Button>
        </div>
      </form>

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
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleAddAmenity} disabled={isSubmitting}>
              {isSubmitting ? (
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
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleAddService} disabled={isSubmitting}>
              {isSubmitting ? (
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