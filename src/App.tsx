import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/sidebar';
import { Assets } from './pages/assets';
import { Customers } from './pages/customers';
import { Bookings } from './pages/bookings';
import { Settings } from './pages/settings';
import { Profile } from './pages/profile';
import { Notifications } from './pages/notifications';
import { Report } from './pages/report';
import { NewAsset } from './pages/new-asset';
import { NewAssetRooms } from './pages/new-asset-rooms';
import { AssetPreview } from './pages/asset-preview';
import { AssetDetails } from './pages/asset-details';
import { CustomerDetails } from './pages/customer-details';
import { NewCustomer } from './pages/new-customer';
import { NewBooking } from './pages/new-booking';
import { RentCheck } from './pages/rent-check';
import { SignUp } from './pages/auth/signup';
import { Login } from './pages/auth/login';
import { AuthCallback } from './pages/auth/callback';
import { ConfirmEmail } from './pages/auth/confirm-email';
import { Onboarding } from './pages/auth/onboarding';
import { Team } from './pages/team';
import { useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { FormatProvider } from '@/components/format-provider';

interface Address {
  street: string;
  number: string;
  other?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

interface Room {
  id: string;
  name: string;
  capacity: "single" | "double";
  location: "exterior" | "interior";
  bathroom: "ensuite" | "shared";
  description?: string;
  photos: File[];
}

interface AssetData {
  address: Address;
  reference?: string;
  rooms: Room[];
  bathrooms: number;
  photos: File[];
  purchasePrice?: number;
  purchaseDate?: Date;
  managementModel?: string;
  monthlyRent?: number;
  managementPercentage?: number;
  amenities: string[];
}

function App() {
  const [currentPage, setCurrentPage] = useState('assets');
  const [showNewAsset, setShowNewAsset] = useState(false);
  const [showNewAssetRooms, setShowNewAssetRooms] = useState(false);
  const [showAssetPreview, setShowAssetPreview] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [totalRooms, setTotalRooms] = useState(0);
  const [assetData, setAssetData] = useState<AssetData | null>(null);

  const renderDashboard = () => {
    if (showAssetPreview && assetData) {
      return (
        <AssetPreview
          onBack={() => {
            setShowAssetPreview(false);
            setShowNewAssetRooms(true);
          }}
          onConfirm={() => {
            setShowAssetPreview(false);
            setShowNewAsset(false);
            setShowNewAssetRooms(false);
            setCurrentPage('assets');
            setAssetData(null);
          }}
          assetData={assetData}
        />
      );
    }

    if (showNewAssetRooms) {
      return (
        <NewAssetRooms
          onBack={() => {
            setShowNewAssetRooms(false);
            setShowNewAsset(true);
          }}
          onComplete={(roomsData) => {
            if (assetData) {
              setAssetData({ ...assetData, rooms: roomsData });
              setShowNewAssetRooms(false);
              setShowAssetPreview(true);
            }
          }}
          totalRooms={totalRooms}
        />
      );
    }

    if (showNewAsset) {
      return (
        <NewAsset
          onBack={() => setShowNewAsset(false)}
          onContinue={(data, numberOfRooms) => {
            setAssetData(data);
            setTotalRooms(numberOfRooms);
            setShowNewAsset(false);
            setShowNewAssetRooms(true);
          }}
        />
      );
    }

    if (showNewCustomer) {
      return (
        <NewCustomer
          onBack={() => setShowNewCustomer(false)}
          onComplete={(customerData) => {
            console.log('New customer data:', customerData);
            setShowNewCustomer(false);
            setCurrentPage('customers');
          }}
        />
      );
    }

    if (showNewBooking) {
      return (
        <NewBooking
          onBack={() => setShowNewBooking(false)}
          onComplete={(bookingData) => {
            console.log('New booking data:', bookingData);
            setShowNewBooking(false);
            setCurrentPage('bookings');
          }}
        />
      );
    }

    switch (currentPage) {
      case 'notifications':
        return <Notifications />;
      case 'report':
        return <Report />;
      case 'assets':
        return <Assets onNewAsset={() => setShowNewAsset(true)} />;
      case 'customers':
        return <Customers onNewCustomer={() => setShowNewCustomer(true)} />;
      case 'bookings':
        return <Bookings onNewBooking={() => setShowNewBooking(true)} />;
      case 'rent-check':
        return <RentCheck />;
      case 'settings':
        return <Settings />;
      case 'profile':
        return <Profile />;
      case 'team':
        return <Team />;
      default:
        return <Assets onNewAsset={() => setShowNewAsset(true)} />;
    }
  };

  return (
    <Router>
      <FormatProvider>
        <Routes>
          <Route path="/auth/signup" element={<SignUp />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/confirm-email" element={<ConfirmEmail />} />
          <Route path="/auth/onboarding" element={<Onboarding />} />
          <Route
            path="/*"
            element={
              <div className="min-h-screen flex bg-background">
                <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
                <main className="flex-1 overflow-y-auto p-8">
                  <Routes>
                    <Route path="/assets/:id" element={<AssetDetails />} />
                    <Route path="/customers/:id" element={<CustomerDetails />} />
                    <Route path="/" element={renderDashboard()} />
                  </Routes>
                </main>
                <Toaster />
              </div>
            }
          />
        </Routes>
      </FormatProvider>
    </Router>
  );
}

export default App;