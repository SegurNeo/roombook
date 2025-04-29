import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface AssetPreviewProps {
  onBack: () => void;
  onConfirm: () => void;
  assetData: {
    address: {
      street: string;
      number: string;
      other?: string;
      city: string;
      state: string;
      country: string;
      postalCode: string;
    };
    reference?: string;
    rooms: Array<{
      id: string;
      name: string;
      capacity: "single" | "double";
      location: "exterior" | "interior";
      bathroom: "ensuite" | "shared";
      description?: string;
      photos: File[];
    }>;
    bathrooms: number;
    photos: File[];
    purchasePrice?: number;
    purchaseDate?: Date;
    managementModel?: string;
    monthlyRent?: number;
    managementPercentage?: number;
    amenities: string[];
  };
}

export function AssetPreview({ onBack, onConfirm, assetData }: AssetPreviewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const formatAddress = () => {
    const parts = [
      `${assetData.address.street} ${assetData.address.number}`,
      assetData.address.other,
      assetData.address.city,
      assetData.address.state,
      assetData.address.country,
      assetData.address.postalCode
    ];
    return parts.filter(Boolean).join(", ");
  };

  const handleConfirm = async () => {
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

      // First, create the asset
      const { data: asset, error: assetError } = await supabase
        .from('assets')
        .insert([
          {
            name: `${assetData.address.street} ${assetData.address.number}`,
            address: assetData.address,
            reference: assetData.reference || null,
            bathrooms: assetData.bathrooms,
            photos: [], // TODO: Implement file upload
            purchase_price: assetData.purchasePrice || null,
            purchase_date: assetData.purchaseDate || null,
            management_model: assetData.managementModel || null,
            monthly_rent: assetData.monthlyRent || null,
            management_percentage: assetData.managementPercentage || null,
            amenities: assetData.amenities.length > 0 ? assetData.amenities : null,
            organization_id: profile.organization_id,
            created_by: user.id
          }
        ])
        .select()
        .single();

      if (assetError) throw assetError;

      // Then, create all rooms for this asset
      const roomsToCreate = assetData.rooms.map(room => ({
        asset_id: asset.id,
        name: room.name,
        capacity: room.capacity,
        location: room.location,
        bathroom: room.bathroom,
        description: room.description || null,
        photos: [], // TODO: Implement file upload
        created_by: user.id // Add created_by field for rooms
      }));

      const { error: roomsError } = await supabase
        .from('rooms')
        .insert(roomsToCreate);

      if (roomsError) throw roomsError;

      toast({
        title: "Asset created",
        description: "The asset and its rooms have been successfully created.",
      });

      onConfirm();
    } catch (error: any) {
      console.error('Error creating asset:', error);
      toast({
        title: "Error creating asset",
        description: error.message || "Failed to create asset. Please try again.",
        variant: "destructive",
      });
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} disabled={isCreating}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to general information
      </Button>
      
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Asset Preview</h2>
        <Button onClick={handleConfirm} disabled={isCreating}>
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating Asset...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Confirm and Create
            </>
          )}
        </Button>
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-lg font-medium">Creating your asset...</p>
            <p className="text-sm text-muted-foreground">This may take a few moments</p>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        <div className="border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">General Information</h3>
          <dl className="grid gap-3 text-sm">
            <div className="grid grid-cols-3">
              <dt className="font-medium">Address</dt>
              <dd className="col-span-2">{formatAddress()}</dd>
            </div>
            {assetData.reference && (
              <div className="grid grid-cols-3">
                <dt className="font-medium">Reference</dt>
                <dd className="col-span-2">{assetData.reference}</dd>
              </div>
            )}
            <div className="grid grid-cols-3">
              <dt className="font-medium">Total Rooms</dt>
              <dd className="col-span-2">{assetData.rooms.length}</dd>
            </div>
            <div className="grid grid-cols-3">
              <dt className="font-medium">Bathrooms</dt>
              <dd className="col-span-2">{assetData.bathrooms}</dd>
            </div>
            <div className="grid grid-cols-3">
              <dt className="font-medium">Property Photos</dt>
              <dd className="col-span-2">{assetData.photos.length} photos selected</dd>
            </div>
          </dl>
        </div>

        <div className="border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Rooms</h3>
          <div className="space-y-4">
            {assetData.rooms.map((room) => (
              <div key={room.id} className="border rounded p-4">
                <dl className="grid gap-3 text-sm">
                  <div className="grid grid-cols-3">
                    <dt className="font-medium">Name</dt>
                    <dd className="col-span-2">{room.name}</dd>
                  </div>
                  <div className="grid grid-cols-3">
                    <dt className="font-medium">Capacity</dt>
                    <dd className="col-span-2 capitalize">{room.capacity}</dd>
                  </div>
                  <div className="grid grid-cols-3">
                    <dt className="font-medium">Location</dt>
                    <dd className="col-span-2 capitalize">{room.location}</dd>
                  </div>
                  <div className="grid grid-cols-3">
                    <dt className="font-medium">Bathroom</dt>
                    <dd className="col-span-2 capitalize">{room.bathroom}</dd>
                  </div>
                  {room.description && (
                    <div className="grid grid-cols-3">
                      <dt className="font-medium">Description</dt>
                      <dd className="col-span-2">{room.description}</dd>
                    </div>
                  )}
                  <div className="grid grid-cols-3">
                    <dt className="font-medium">Photos</dt>
                    <dd className="col-span-2">{room.photos.length} photos selected</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Additional Information</h3>
          <dl className="grid gap-3 text-sm">
            {assetData.purchasePrice && (
              <div className="grid grid-cols-3">
                <dt className="font-medium">Purchase Price</dt>
                <dd className="col-span-2">€{assetData.purchasePrice.toLocaleString()}</dd>
              </div>
            )}
            {assetData.purchaseDate && (
              <div className="grid grid-cols-3">
                <dt className="font-medium">Purchase Date</dt>
                <dd className="col-span-2">{format(assetData.purchaseDate, "PPP")}</dd>
              </div>
            )}
            {assetData.managementModel && (
              <div className="grid grid-cols-3">
                <dt className="font-medium">Management Model</dt>
                <dd className="col-span-2">{assetData.managementModel}</dd>
              </div>
            )}
            {assetData.monthlyRent && (
              <div className="grid grid-cols-3">
                <dt className="font-medium">Monthly Rent</dt>
                <dd className="col-span-2">€{assetData.monthlyRent.toLocaleString()}</dd>
              </div>
            )}
            {assetData.managementPercentage && (
              <div className="grid grid-cols-3">
                <dt className="font-medium">Management Percentage</dt>
                <dd className="col-span-2">{assetData.managementPercentage}%</dd>
              </div>
            )}
            <div className="grid grid-cols-3">
              <dt className="font-medium">Amenities</dt>
              <dd className="col-span-2">
                <div className="flex flex-wrap gap-2">
                  {assetData.amenities.map((amenity) => (
                    <span
                      key={amenity}
                      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                    >
                      {amenity}
                    </span>
                  ))}
                </div>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}