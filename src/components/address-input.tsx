import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddressInputProps {
  onAddressChange: (address: {
    street: string;
    number: string;
    other: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  }) => void;
}

interface AddressFields {
  street: string;
  number: string;
  other: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export function AddressInput({ onAddressChange }: AddressInputProps) {
  const handleFieldChange = (field: keyof AddressFields, value: string) => {
    const newFields = {
      street: document.getElementById('street') as HTMLInputElement,
      number: document.getElementById('number') as HTMLInputElement,
      other: document.getElementById('other') as HTMLInputElement,
      city: document.getElementById('city') as HTMLInputElement,
      state: document.getElementById('state') as HTMLInputElement,
      country: document.getElementById('country') as HTMLInputElement,
      postalCode: document.getElementById('postalCode') as HTMLInputElement,
    };

    const updatedAddress = {
      street: newFields.street.value,
      number: newFields.number.value,
      other: newFields.other.value,
      city: newFields.city.value,
      state: newFields.state.value,
      country: newFields.country.value,
      postalCode: newFields.postalCode.value,
      [field]: value,
    };

    onAddressChange(updatedAddress);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="street">Street</Label>
          <Input
            id="street"
            onChange={(e) => handleFieldChange('street', e.target.value)}
            placeholder="Street name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="number">Number</Label>
          <Input
            id="number"
            onChange={(e) => handleFieldChange('number', e.target.value)}
            placeholder="Street number"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="other">Additional Info</Label>
          <Input
            id="other"
            onChange={(e) => handleFieldChange('other', e.target.value)}
            placeholder="Apartment, suite, unit, etc."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal Code</Label>
          <Input
            id="postalCode"
            onChange={(e) => handleFieldChange('postalCode', e.target.value)}
            placeholder="Postal code"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            onChange={(e) => handleFieldChange('city', e.target.value)}
            placeholder="City"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="state">State/Province</Label>
          <Input
            id="state"
            onChange={(e) => handleFieldChange('state', e.target.value)}
            placeholder="State or province"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            onChange={(e) => handleFieldChange('country', e.target.value)}
            placeholder="Country"
            required
          />
        </div>
      </div>
    </div>
  );
}