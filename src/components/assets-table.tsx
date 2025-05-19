import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Pencil, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { ColumnOption } from "@/pages/assets";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

interface Asset {
  id: string;
  name: string;
  occupancy: number;
  revenue: number;
  avgStay: number;
  totalBookings: number;
  user?: {
    name?: string;
  };
  created_by?: string;
  assetName?: string;
  asset_name?: string;
  assets?: {
    name: string;
  };
}

interface AssetsTableProps {
  assets: Asset[];
  selectedColumns: string[];
  columnOptions: ColumnOption[];
  onDelete?: () => void;
  onNewItem?: () => void;
  viewMode?: 'assets' | 'rooms';
}

export function AssetsTable({ assets, selectedColumns, columnOptions, onDelete, onNewItem, viewMode = 'assets' }: AssetsTableProps) {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [password, setPassword] = useState("");
  const [isLastRoom, setIsLastRoom] = useState(false);
  const [assetRooms, setAssetRooms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const DELETE_PASSWORD = "delete123";

  // If there are no items, show the empty state
  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 border rounded-lg bg-muted/10">
        <div className="text-center space-y-3">
          <h3 className="text-lg font-semibold">No {viewMode === 'assets' ? 'assets' : 'rooms'} found</h3>
          <p className="text-muted-foreground">
            {viewMode === 'assets' 
              ? "Get started by adding your first property asset."
              : "No rooms have been added to your assets yet."}
          </p>
          {onNewItem && (
            <Button onClick={onNewItem} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Add {viewMode === 'assets' ? 'Asset' : 'Room'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(assets.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentAssets = assets.slice(startIndex, endIndex);

  const visibleColumns = columnOptions.filter(col => selectedColumns.includes(col.id));

  const totals = currentAssets.reduce(
    (acc, asset) => ({
      occupancy: acc.occupancy + asset.occupancy,
      revenue: acc.revenue + asset.revenue,
      avgStay: acc.avgStay + asset.avgStay,
      totalBookings: acc.totalBookings + asset.totalBookings,
    }),
    { occupancy: 0, revenue: 0, avgStay: 0, totalBookings: 0 }
  );

  const averageOccupancy = (totals.occupancy / currentAssets.length).toFixed(1);
  const averageStay = (totals.avgStay / currentAssets.length).toFixed(1);

  const handleDeleteClick = async (asset: Asset) => {
    setIsLoading(true);
    try {
      // If this is a room view (asset has assetName property)
      if ('assetName' in asset && (asset as any).asset_id) {
        // Check if this is the last room
        const { data: roomCount, error: countError } = await supabase
          .from('rooms')
          .select('id', { count: 'exact' })
          .eq('asset_id', (asset as any).asset_id);

        if (countError) throw countError;

        setIsLastRoom(roomCount?.length === 1);
        setAssetRooms([]);
      } else {
        // Get all rooms for this asset
        const { data: rooms, error: roomsError } = await supabase
          .from('rooms')
          .select('*')
          .eq('asset_id', asset.id);

        if (roomsError) throw roomsError;
        setAssetRooms(rooms || []);
        setIsLastRoom(false);
      }

      setSelectedAsset(asset);
      setDeleteDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch asset details: " + error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAsset) {
      setDeleteDialogOpen(false);
      return;
    }

    if (password !== DELETE_PASSWORD) {
      toast({
        title: "Invalid password",
        description: "Please enter the correct password to delete this item.",
        variant: "destructive",
      });
      return;
    }

    try {
      const isRoom = 'assetName' in selectedAsset;

      if (isRoom) {
        // Deleting a room
        const { error: deleteError } = await supabase
          .from('rooms')
          .delete()
          .eq('id', selectedAsset.id);

        if (deleteError) throw deleteError;

        if (isLastRoom) {
          // Also delete the parent asset
          const { error: assetDeleteError } = await supabase
            .from('assets')
            .delete()
            .eq('id', (selectedAsset as any).asset_id);

          if (assetDeleteError) throw assetDeleteError;

          toast({
            title: "Asset deleted",
            description: "The asset was deleted because its last room was removed.",
          });
        } else {
          toast({
            title: "Room deleted",
            description: "The room has been successfully deleted.",
          });
        }
      } else {
        // Deleting an asset
        const { error: deleteError } = await supabase
          .from('assets')
          .delete()
          .eq('id', selectedAsset.id);

        if (deleteError) throw deleteError;

        toast({
          title: "Asset deleted",
          description: "The asset and all its rooms have been deleted.",
        });
      }

      setDeleteDialogOpen(false);
      setPassword("");
      setSelectedAsset(null);
      setAssetRooms([]);
      if (onDelete) onDelete();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete. Please try again.",
        variant: "destructive",
      });
    }
  };

  const renderCell = (asset: Asset, columnId: string) => {
    switch (columnId) {
      case "name":
        return <TableCell className="font-medium">{asset.name}</TableCell>;
      case "occupancy":
        return <TableCell>{asset.occupancy}%</TableCell>;
      case "revenue":
        return <TableCell>{asset.revenue}</TableCell>;
      case "avgStay":
        return <TableCell>{asset.avgStay}</TableCell>;
      case "totalBookings":
        return <TableCell>{asset.totalBookings}</TableCell>;
      case "user":
        return (
          <TableCell>
            <div className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {asset.user?.name?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              <span>{asset.user?.name || 'Unknown'}</span>
            </div>
          </TableCell>
        );
      case "assetName":
        return <TableCell>{asset.assets?.name || asset.asset_name || asset.assetName || '-'}</TableCell>;
      case "roomName":
        return <TableCell>{asset.name}</TableCell>;
      case "capacity":
        return <TableCell className="capitalize">{(asset as any).capacity}</TableCell>;
      case "location":
        return <TableCell className="capitalize">{(asset as any).location}</TableCell>;
      case "bathroom":
        return <TableCell className="capitalize">{(asset as any).bathroom}</TableCell>;
      default:
        return <TableCell>-</TableCell>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg [&_tr]:border-b [&_th]:border-r [&_td]:border-r last:[&_td]:border-r-0 last:[&_th]:border-r-0">
        <Table className="[&_tr:hover]:bg-transparent">
          <TableHeader>
            <TableRow>
              {visibleColumns.map((column) => (
                <TableHead key={column.id}>{column.label}</TableHead>
              ))}
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentAssets.map((asset) => (
              <TableRow key={asset.id}>
                {visibleColumns.map((column) => renderCell(asset, column.id))}
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/assets/${asset.id}`)}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="ml-2">Edit</span>
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => handleDeleteClick(asset)}
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-medium">
              <TableCell>Subtotal ({currentAssets.length} items)</TableCell>
              {selectedColumns.includes("occupancy") && <TableCell>{averageOccupancy}%</TableCell>}
              {selectedColumns.includes("revenue") && <TableCell>{totals.revenue}</TableCell>}
              {selectedColumns.includes("avgStay") && <TableCell>{averageStay}</TableCell>}
              {selectedColumns.includes("totalBookings") && <TableCell>{totals.totalBookings}</TableCell>}
              {selectedColumns.includes("user") && <TableCell></TableCell>}
              {selectedColumns.filter(id => !["name", "occupancy", "revenue", "avgStay", "totalBookings", "user"].includes(id)).map(id => (
                <TableCell key={id}></TableCell>
              ))}
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
            <SelectTrigger className="w-[70px]">
              <SelectValue>{pageSize}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-6">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedAsset && (
                <>
                  Delete {isLastRoom ? 'Asset' : ('assetName' in selectedAsset ? 'Room' : 'Asset')}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedAsset && (
                <>
                  {isLastRoom ? (
                    <>
                      This is the last room of the asset. Deleting it will also delete the asset.
                      <br /><br />
                      Enter your password to confirm deletion of the room and its parent asset.
                    </>
                  ) : 'assetName' in selectedAsset ? (
                    <>
                      Enter your password to confirm deletion of room "{selectedAsset.name}"
                    </>
                  ) : (
                    <>
                      Enter your password to confirm deletion of asset "{selectedAsset.name}"
                      {assetRooms.length > 0 && (
                        <>
                          <br /><br />
                          The following rooms will also be deleted:
                          <ul className="list-disc pl-6 mt-2 space-y-1">
                            {assetRooms.map((room: any) => (
                              <li key={room.id} className="text-sm">
                                {room.name} ({room.capacity} room, {room.bathroom} bathroom)
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </>
                  )}
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
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => {
                setDeleteDialogOpen(false);
                setPassword("");
                setSelectedAsset(null);
                setAssetRooms([]);
              }}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={!password}
              >
                {selectedAsset && (
                  <>
                    Delete {isLastRoom ? 'Asset' : ('assetName' in selectedAsset ? 'Room' : 'Asset')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}