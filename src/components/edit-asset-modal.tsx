import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddressInput } from "@/components/address-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Check, Upload, Trash2 } from "lucide-react";

interface EditAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: EditAssetData;
  onDataChange: (data: EditAssetData) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

interface EditAssetData {
  name: string;
  address: {
    street: string;
    number: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  purchase_price?: number;
  purchase_date?: string;
  management_model?: string;
  monthly_rent?: number;
  management_percentage?: number;
  amenities: string[];
  photos: string[];
}

const defaultAmenities = [
  { id: "wifi", label: "WiFi" },
  { id: "ac", label: "Air Conditioning" },
  { id: "heating", label: "Heating" },
  { id: "washer", label: "Washer" },
  { id: "dryer", label: "Dryer" },
  { id: "parking", label: "Parking" },
  { id: "elevator", label: "Elevator" },
  { id: "pool", label: "Pool" },
  { id: "gym", label: "Gym" },
];

export function EditAssetModal({ 
  open, 
  onOpenChange, 
  data, 
  onDataChange,
  onSubmit,
  isSubmitting
}: EditAssetModalProps) {
  const [activeTab, setActiveTab] = useState("general");

  if (!data) return null;

  const handleManagementModelChange = (value: string) => {
    // Reset related fields when changing model
    const updatedData = {
      ...data,
      management_model: value,
      monthly_rent: undefined,
      management_percentage: undefined,
      purchase_price: undefined,
      purchase_date: undefined
    };
    onDataChange(updatedData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Asset</DialogTitle>
          <DialogDescription>
            Update the asset information below.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="management">Management</TabsTrigger>
            <TabsTrigger value="amenities">Amenities</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={data.name}
                  onChange={(e) => onDataChange({ ...data, name: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label>Address</Label>
                <AddressInput
                  onAddressChange={(address) => onDataChange({ ...data, address })}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="management" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="management_model">Management Model</Label>
                <Select
                  value={data.management_model}
                  onValueChange={handleManagementModelChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rent-to-rent">Rent to Rent</SelectItem>
                    <SelectItem value="full-management">Full Management</SelectItem>
                    <SelectItem value="property">Property Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {data.management_model === "rent-to-rent" && (
                <div className="grid gap-2">
                  <Label htmlFor="monthly_rent">Monthly Rent</Label>
                  <Input
                    id="monthly_rent"
                    type="number"
                    min="0"
                    step="0.01"
                    value={data.monthly_rent || ''}
                    onChange={(e) => onDataChange({ ...data, monthly_rent: parseFloat(e.target.value) })}
                    placeholder="Enter monthly rent"
                    required
                  />
                </div>
              )}

              {data.management_model === "full-management" && (
                <div className="grid gap-2">
                  <Label htmlFor="management_percentage">Management Percentage</Label>
                  <Input
                    id="management_percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={data.management_percentage || ''}
                    onChange={(e) => onDataChange({ ...data, management_percentage: parseFloat(e.target.value) })}
                    placeholder="Enter percentage"
                    required
                  />
                </div>
              )}

              {data.management_model === "property" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="purchase_price">Purchase Price</Label>
                    <Input
                      id="purchase_price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={data.purchase_price || ''}
                      onChange={(e) => onDataChange({ ...data, purchase_price: parseFloat(e.target.value) })}
                      placeholder="Enter purchase price"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="purchase_date">Purchase Date</Label>
                    <Input
                      id="purchase_date"
                      type="date"
                      value={data.purchase_date || ''}
                      onChange={(e) => onDataChange({ ...data, purchase_date: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="amenities" className="space-y-4 mt-4">
            <div className="grid gap-2">
              <Label>Available Amenities</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {defaultAmenities.map((amenity) => (
                  <div key={amenity.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={amenity.id}
                      checked={data.amenities.includes(amenity.label)}
                      onCheckedChange={(checked) => {
                        const updatedAmenities = checked
                          ? [...data.amenities, amenity.label]
                          : data.amenities.filter((a) => a !== amenity.label);
                        onDataChange({ ...data, amenities: updatedAmenities });
                      }}
                    />
                    <Label htmlFor={amenity.id}>{amenity.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="photos" className="space-y-4 mt-4">
            <div className="grid gap-2">
              <Label>Property Photos</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {data.photos.map((photo, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={photo}
                      alt={`Asset photo ${index + 1}`}
                      className="aspect-video rounded-lg object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        const updatedPhotos = [...data.photos];
                        updatedPhotos.splice(index, 1);
                        onDataChange({ ...data, photos: updatedPhotos });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="aspect-video rounded-lg border-2 border-dashed flex items-center justify-center">
                  <Button variant="ghost" className="h-full w-full">
                    <Upload className="h-4 w-4 mr-2" />
                    Add Photo
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}