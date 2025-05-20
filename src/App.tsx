import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import { RentCheck } from './pages/rent-check';
import { SignUp } from './pages/auth/signup';
import { Login } from './pages/auth/login';
import { AuthCallback } from './pages/auth/callback';
import { ConfirmEmail } from './pages/auth/confirm-email';
import { Onboarding } from './pages/auth/onboarding';
import { Team } from './pages/team';
import { AcceptInvite } from './pages/auth/accept-invite';
import { CompleteInvite } from './pages/auth/complete-invite';
import { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { FormatProvider } from '@/components/format-provider';
import { supabase } from './lib/supabase';
import { useToast } from './hooks/use-toast';

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
  name: string;
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
  const [showNewAsset, setShowNewAsset] = useState(false);
  const [showNewAssetRooms, setShowNewAssetRooms] = useState(false);
  const [showAssetPreview, setShowAssetPreview] = useState(false);
  const [assetData, setAssetData] = useState<AssetData | null>(null);
  const [totalRooms, setTotalRooms] = useState(0);
  const [session, setSession] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const getSession = async () => {
        setLoadingAuth(true);
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;
            setSession(session);
        } catch (error: any) {
            toast({ title: "Auth Error", description: `Failed to get session: ${error.message}`, variant: "destructive"});
            console.error("Auth error:", error);
            setSession(null);
        } finally {
            setLoadingAuth(false);
        }
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Auth State Change:", _event, session ? 'Got session' : 'No session');
      setSession(session);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [toast]);

  const handleNewAssetComplete = () => {
      setShowAssetPreview(false);
      setShowNewAsset(false);
      setShowNewAssetRooms(false);
      setAssetData(null);
  };

  if (loadingAuth) {
     return (
        <div className="flex items-center justify-center h-screen">
          <div>Loading session...</div>
        </div>
     );
  }

  return (
    <Router>
      <FormatProvider>
          <Routes>
              <Route path="/auth/signup" element={<SignUp />} />
              <Route path="/auth/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/auth/confirm-email" element={<ConfirmEmail />} />
              <Route path="/auth/onboarding" element={<Onboarding />} />
              <Route path="/accept-invite" element={<AcceptInvite />} />
              <Route path="/auth/complete-invite" element={<CompleteInvite />} />

              <Route
                path="/*"
                element={
                  !session ? (
                     <Navigate to="/auth/login" replace />
                   ) : (
                     <div className="min-h-screen flex bg-background">
                       <Sidebar />
                       <main className="flex-1 overflow-y-auto p-8">
                         <Routes>
                           <Route path="/customers/*" element={<Customers />} />
                           <Route path="/customers/:id" element={<CustomerDetails />} />
                           
                           {/* Asset creation flow */}
                           {showNewAsset && !showNewAssetRooms && !showAssetPreview && (
                                <Route path="*" element={
                                  <NewAsset
                                    onBack={() => setShowNewAsset(false)}
                                    onContinue={(data, numberOfRooms) => {
                                        setAssetData(data);
                                        setTotalRooms(numberOfRooms);
                                        setShowNewAsset(false);
                                        setShowNewAssetRooms(true);
                                    }}
                                  />
                                } />
                           )}
                           {showNewAssetRooms && !showAssetPreview && (
                               <Route path="*" element={
                                 <NewAssetRooms
                                    onBack={() => {setShowNewAssetRooms(false); setShowNewAsset(true);}}
                                    onComplete={(roomsData) => {
                                      if (assetData) {
                                          setAssetData({ ...assetData, rooms: roomsData });
                                          setShowNewAssetRooms(false);
                                          setShowAssetPreview(true);
                                      }
                                    }}
                                    totalRooms={totalRooms}
                                 />
                               } />
                           )}
                           {showAssetPreview && assetData && (
                               <Route path="*" element={
                                 <AssetPreview
                                    onBack={() => {setShowAssetPreview(false); setShowNewAssetRooms(true);}}
                                    onConfirm={handleNewAssetComplete}
                                    assetData={assetData}
                                 />
                               } />
                           )}

                           {/* Regular routes */}
                           {!showNewAsset && !showNewAssetRooms && !showAssetPreview && (
                             <>
                                <Route path="/assets/:id" element={<AssetDetails />} />
                                <Route path="/assets" element={<Assets onNewAsset={() => setShowNewAsset(true)} />} />
                                <Route path="/bookings" element={<Bookings />} />
                                <Route path="/rent-check" element={<RentCheck />} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="/profile" element={<Profile />} />
                                <Route path="/team" element={<Team />} />
                                <Route path="/notifications" element={<Notifications />} />
                                <Route path="/report" element={<Report />} />
                                <Route path="/" element={<Navigate to="/assets" replace />} />
                                <Route path="*" element={<div>404 Not Found</div>} />
                             </>
                           )}
                         </Routes>
                       </main>
                       <Toaster />
                     </div>
                   )
                }
              />
          </Routes>
      </FormatProvider>
    </Router>
  );
}

export default App;