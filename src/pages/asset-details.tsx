import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useFormat } from "@/components/format-provider";
import { formatCurrency, formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddressInput } from "@/components/address-input";
import { Checkbox } from "@/components/ui/checkbox";
import { EditAssetModal } from "@/components/edit-asset-modal";
import { 
  ArrowLeft, 
  Building2, 
  Edit, 
  Trash2, 
  Calendar, 
  DollarSign,
  Users,
  Percent,
  BedDouble,
  Bath,
  MapPin,
  Loader2,
  Check,
  Upload
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";

interface AssetDetails {
  id: string;
  name: string;
  address: {
    street: string;
    number: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  bathrooms: number;
  photos: string[];
  purchase_price?: number;
  purchase_date?: string;
  management_model?: string;
  monthly_rent?: number;
  management_percentage?: number;
  amenities: string[];
  created_at: string;
  rooms: Array<{
    id: string;
    name: string;
    capacity: string;
    location: string;
    bathroom: string;
    description?: string;
    photos: string[];
  }>;
}

interface Booking {
  id: string;
  customer?: {
    first_name: string;
    last_name: string;
  };
  start_date: string;
  end_date: string;
  rent_price: number;
  status: string;
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

export function AssetDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useFormat();
  const [asset, setAsset] = useState<AssetDetails | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [showDeleteRoomDialog, setShowDeleteRoomDialog] = useState(false);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);
  const [password, setPassword] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [selectedRoomBookings, setSelectedRoomBookings] = useState<Booking[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState<EditAssetData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const DELETE_PASSWORD = "delete123";

  useEffect(() => {
    fetchAssetDetails();
  }, [id]);

  useEffect(() => {
    if (asset && !editData) {
      setEditData({
        name: asset.name,
        address: asset.address,
        purchase_price: asset.purchase_price,
        purchase_date: asset.purchase_date,
        management_model: asset.management_model,
        monthly_rent: asset.monthly_rent,
        management_percentage: asset.management_percentage,
        amenities: asset.amenities,
        photos: asset.photos,
      });
    }
  }, [asset]);

  const fetchAssetDetails = async () => {
    try {
      setLoading(true);

      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .select(`
          id,
          name,
          address,
          bathrooms,
          photos,
          purchase_price,
          purchase_date,
          management_model,
          monthly_rent,
          management_percentage,
          amenities,
          created_at,
          rooms (
            id,
            name,
            capacity,
            location,
            bathroom,
            description,
            photos
          )
        `)
        .eq('id', id)
        .single();

      if (assetError) throw assetError;
      if (!assetData) throw new Error('Asset not found');

      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          start_date,
          end_date,
          rent_price,
          status,
          customers (
            first_name,
            last_name
          )
        `)
        .in('room_id', assetData.rooms.map(room => room.id))
        .order('start_date', { ascending: false });

      if (bookingsError) throw bookingsError;

      setAsset(assetData);
      setBookings(bookingsData || []);
    } catch (error: any) {
      console.error('Error fetching asset details:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRoomBookings = async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          start_date,
          end_date,
          rent_price,
          status,
          customers (
            first_name,
            last_name
          )
        `)
        .eq('room_id', roomId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setSelectedRoomBookings(data || []);
    } catch (error: any) {
      console.error('Error fetching room bookings:', error);
      toast({
        title: "Error",
        description: "Failed to fetch room bookings",
        variant: "destructive"
      });
    }
  };

  const handleDeleteAsset = async () => {
    if (!asset) return;

    if (password !== DELETE_PASSWORD) {
      toast({
        title: "Invalid password",
        description: "Please enter the correct password to delete this asset.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', asset.id);

      if (error) throw error;

      toast({
        title: "Asset deleted",
        description: "The asset and all its rooms have been deleted successfully."
      });
      navigate('/');
    } catch (error: any) {
      console.error('Error deleting asset:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!selectedRoom) return;

    if (roomPassword !== DELETE_PASSWORD) {
      toast({
        title: "Invalid password",
        description: "Please enter the correct password to delete this room.",
        variant: "destructive",
      });
      return;
    }

    setIsDeletingRoom(true);

    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', selectedRoom);

      if (error) throw error;

      const updatedRooms = asset?.rooms.filter(room => room.id !== selectedRoom) || [];
      setAsset(asset ? { ...asset, rooms: updatedRooms } : null);
      
      toast({
        title: "Room deleted",
        description: "The room has been deleted successfully."
      });
      
      setShowDeleteRoomDialog(false);
      setSelectedRoom(null);
      setRoomPassword("");
    } catch (error: any) {
      console.error('Error deleting room:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsDeletingRoom(false);
    }
  };

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoom(roomId);
    setShowDeleteRoomDialog(true);
    fetchRoomBookings(roomId);
  };

  const handleCloseRoomDialog = () => {
    setShowDeleteRoomDialog(false);
    setSelectedRoom(null);
    setRoomPassword("");
    setSelectedRoomBookings([]);
  };

  const handleEditSubmit = async () => {
    if (!editData || !asset) return;

    setIsEditing(true);

    try {
      const { error } = await supabase
        .from('assets')
        .update({
          name: editData.name,
          address: editData.address,
          purchase_price: editData.purchase_price,
          purchase_date: editData.purchase_date,
          management_model: editData.management_model,
          monthly_rent: editData.monthly_rent,
          management_percentage: editData.management_percentage,
          amenities: editData.amenities,
          photos: editData.photos,
        })
        .eq('id', asset.id);

      if (error) throw error;

      setAsset({
        ...asset,
        ...editData,
      });

      toast({
        title: "Asset updated",
        description: "The asset information has been updated successfully.",
      });

      setShowEditModal(false);
    } catch (error: any) {
      console.error('Error updating asset:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsEditing(false);
    }
  };

  const calculateMetrics = () => {
    if (!bookings.length) return {
      totalRevenue: 0,
      avgBookingDuration: 0,
      occupancyRate: 0,
      activeBookings: 0
    };

    const now = new Date();
    const totalRevenue = bookings.reduce((sum, b) => sum + b.rent_price, 0);
    const durations = bookings.map(b => {
      const start = new Date(b.start_date);
      const end = new Date(b.end_date);
      return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    });
    const avgBookingDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const activeBookings = bookings.filter(b => 
      new Date(b.start_date) <= now && 
      new Date(b.end_date) >= now && 
      b.status === 'active'
    ).length;
    const occupancyRate = (activeBookings / (asset?.rooms.length || 1)) * 100;

    return {
      totalRevenue,
      avgBookingDuration,
      occupancyRate,
      activeBookings
    };
  };

  const metrics = calculateMetrics();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-lg font-medium">Loading asset details...</p>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium">Asset not found</p>
          <Button onClick={() => navigate('/')}>Go back to assets</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to assets
      </Button>

      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{asset.name}</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setShowEditModal(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Asset
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Asset
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.totalRevenue, settings)}
            </div>
            <p className="text-xs text-muted-foreground">
              From {bookings.length} bookings
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Stay Duration</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(metrics.avgBookingDuration)} days
            </div>
            <p className="text-xs text-muted-foreground">
              Per booking
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(metrics.occupancyRate)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.activeBookings} active bookings
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rooms</CardTitle>
            <BedDouble className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {asset.rooms.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {asset.bathrooms} bathrooms
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Asset Details</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="bookings">Booking History</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <Card className="shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Asset Information</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Information
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Address</p>
                  <p className="text-sm">
                    {asset.address.street} {asset.address.number}
                    <br />
                    {asset.address.city}, {asset.address.state}
                    <br />
                    {asset.address.country} {asset.address.postalCode}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Management</p>
                  <p className="text-sm">
                    Model: {asset.management_model || 'N/A'}
                    <br />
                    Monthly Rent: {asset.monthly_rent ? formatCurrency(asset.monthly_rent, settings) : 'N/A'}
                    <br />
                    Management %: {asset.management_percentage ? `${asset.management_percentage}%` : 'N/A'}
                  </p>
                </div>

                {asset.purchase_price && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Purchase Details</p>
                    <p className="text-sm">
                      Price: {formatCurrency(asset.purchase_price, settings)}
                      <br />
                      Date: {asset.purchase_date ? formatDate(new Date(asset.purchase_date), settings) : 'N/A'}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Amenities</p>
                  <div className="flex flex-wrap gap-2">
                    {asset.amenities.map((amenity) => (
                      <Badge key={amenity} variant="secondary">
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {asset.photos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Photos</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {asset.photos.map((photo, index) => (
                      <img
                        key={index}
                        src={photo}
                        alt={`Asset photo ${index + 1}`}
                        className="aspect-video rounded-lg object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rooms" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {asset.rooms.map((room) => (
              <Card key={room.id} className="group relative shadow-none">
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRoomSelect(room.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardHeader>
                  <CardTitle>{room.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <BedDouble className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm capitalize">{room.capacity}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Bath className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm capitalize">{room.bathroom}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm capitalize">{room.location}</span>
                    </div>
                  </div>

                  {room.description && (
                    <p className="text-sm text-muted-foreground">
                      {room.description}
                    </p>
                  )}

                  {room.photos.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {room.photos.map((photo, index) => (
                        <img
                          key={index}
                          src={photo}
                          alt={`Room photo ${index + 1}`}
                          className="aspect-video rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="bookings" className="space-y-6">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Booking History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border shadow-none">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left align-middle font-medium">Customer</th>
                      <th className="h-10 px-4 text-left align-middle font-medium">Start Date</th>
                      <th className="h-10 px-4 text-left align-middle font-medium">End Date</th>
                      <th className="h-10 px-4 text-left align-middle font-medium">Price</th>
                      <th className="h-10 px-4 text-left align-middle font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((booking) => (
                      <tr key={booking.id} className="border-b">
                        <td className="p-4">
                          {booking.customer ? `${booking.customer.first_name} ${booking.customer.last_name}` : 'Unknown'}
                        </td>
                        <td className="p-4">{formatDate(new Date(booking.start_date), settings)}</td>
                        <td className="p-4">{formatDate(new Date(booking.end_date), settings)}</td>
                        <td className="p-4">{formatCurrency(booking.rent_price, settings)}</td>
                        <td className="p-4">
                          <Badge 
                            variant={booking.status === 'active' ? 'default' : 'secondary'}
                          >
                            {booking.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Monthly Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bookings}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="start_date" 
                        tickFormatter={(date) => formatDate(new Date(date), settings)}
                      />
                      <YAxis 
                        tickFormatter={(value) => formatCurrency(value, settings)}
                      />
                      <Tooltip 
                        formatter={(value: any) => formatCurrency(value, settings)}
                        labelFormatter={(label) => formatDate(new Date(label as string), settings)}
                      />
                      <Bar dataKey="rent_price" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Occupancy Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={bookings}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="start_date"
                        tickFormatter={(date) => formatDate(new Date(date), settings)}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(label) => formatDate(new Date(label as string), settings)}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="occupancy_rate" 
                        stroke="hsl(var(--primary))" 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>
              Enter your password to confirm deletion of {asset?.name}.
              {asset?.rooms.length > 0 && (
                <>
                  <br /><br />
                  The following rooms will also be deleted:
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    {asset.rooms.map((room) => (
                      <li key={room.id} className="text-sm">
                        {room.name} ({room.capacity} room, {room.bathroom} bathroom)
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder={DELETE_PASSWORD}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setPassword("");
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAsset}
              disabled={isDeleting || !password}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Asset
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteRoomDialog} onOpenChange={handleCloseRoomDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Room</DialogTitle>
            <DialogDescription>
              Enter your password to confirm deletion of {asset?.rooms.find(r => r.id === selectedRoom)?.name}.
              {selectedRoomBookings.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <p className="font-medium">The following bookings will be deleted:</p>
                    <div className="max-h-[200px] overflow-y-auto space-y-2">
                      {selectedRoomBookings.map((booking) => (
                        <div 
                          key={booking.id} 
                          className="text-sm p-2 rounded-lg bg-muted"
                        >
                          <div className="font-medium">
                            {booking.customer 
                              ? `${booking.customer.first_name} ${booking.customer.last_name}`
                              : 'Unknown Customer'
                            }
                          </div>
                          <div className="text-muted-foreground">
                            {formatDate(new Date(booking.start_date), settings)} - {formatDate(new Date(booking.end_date), settings)}
                            <br />
                            {formatCurrency(booking.rent_price, settings)} • {booking.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="roomPassword">Password</Label>
              <Input
                id="roomPassword"
                type="password"
                placeholder={DELETE_PASSWORD}
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseRoomDialog}
              disabled={isDeletingRoom}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRoom}
              disabled={isDeletingRoom || !roomPassword}
            >
              {isDeletingRoom ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Room
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showEditModal && editData && (
        <EditAssetModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          data={editData}
          onDataChange={setEditData}
          onSubmit={handleEditSubmit}
          isSubmitting={isEditing}
        />
      )}
    </div>
  );
}