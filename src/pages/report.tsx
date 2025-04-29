import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, Plus, LineChart as LineChartIcon, BarChart as BarChartIcon, PieChart, X, DollarSign, Users, Clock, ArrowUpDown, Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Area, AreaChart, Line, LineChart, Pie, PieChart as RechartsPieChart, Tooltip, Legend } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format, subMonths } from "date-fns";

const rentChartConfig = {
  rent: {
    label: "Rent",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const occupancyChartConfig = {
  occupancy: {
    label: "Occupancy",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

interface ChartType {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  preview: () => JSX.Element;
}

const availableCharts: ChartType[] = [
  {
    id: 'revenue-by-room',
    name: 'Revenue by Room',
    description: 'Bar chart showing revenue distribution across different rooms',
    icon: BarChartIcon,
    preview: () => {
      const data = [
        { name: 'Room A', value: 4000 },
        { name: 'Room B', value: 3000 },
        { name: 'Room C', value: 2000 },
        { name: 'Room D', value: 2780 },
      ];
      
      return (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Bar dataKey="value" fill="hsl(var(--chart-1))" />
          </BarChart>
        </ResponsiveContainer>
      );
    }
  },
  {
    id: 'booking-trends',
    name: 'Booking Trends',
    description: 'Line chart showing booking patterns over time',
    icon: LineChartIcon,
    preview: () => {
      const data = [
        { name: 'Jan', value: 400 },
        { name: 'Feb', value: 300 },
        { name: 'Mar', value: 600 },
        { name: 'Apr', value: 800 },
      ];
      
      return (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Line type="monotone" dataKey="value" stroke="hsl(var(--chart-2))" />
          </LineChart>
        </ResponsiveContainer>
      );
    }
  },
  {
    id: 'room-distribution',
    name: 'Room Distribution',
    description: 'Pie chart showing the distribution of room types',
    icon: PieChart,
    preview: () => {
      const data = [
        { name: 'Single', value: 400 },
        { name: 'Double', value: 300 },
        { name: 'Suite', value: 300 },
      ];
      
      return (
        <ResponsiveContainer width="100%" height={200}>
          <RechartsPieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="hsl(var(--chart-1))"
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      );
    }
  },
  {
    id: 'average-stay-duration',
    name: 'Average Stay Duration',
    description: 'Line chart showing average length of stay over time',
    icon: Clock,
    preview: () => {
      const data = [
        { month: 'Jan', duration: 5.2 },
        { month: 'Feb', duration: 4.8 },
        { month: 'Mar', duration: 6.1 },
        { month: 'Apr', duration: 5.5 },
      ];
      
      return (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Line type="monotone" dataKey="duration" stroke="hsl(var(--chart-3))" />
            <Tooltip />
          </LineChart>
        </ResponsiveContainer>
      );
    }
  },
  {
    id: 'revenue-comparison',
    name: 'Revenue Comparison',
    description: 'Compare revenue between different periods',
    icon: ArrowUpDown,
    preview: () => {
      const data = [
        { month: 'Jan', current: 4000, previous: 3000 },
        { month: 'Feb', current: 3500, previous: 2800 },
        { month: 'Mar', current: 4200, previous: 3300 },
        { month: 'Apr', current: 5000, previous: 3800 },
      ];
      
      return (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="current" name="Current" fill="hsl(var(--chart-1))" />
            <Bar dataKey="previous" name="Previous" fill="hsl(var(--chart-2))" />
          </BarChart>
        </ResponsiveContainer>
      );
    }
  },
  {
    id: 'occupancy-by-room-type',
    name: 'Occupancy by Room Type',
    description: 'Compare occupancy rates between different room types',
    icon: Users,
    preview: () => {
      const data = [
        { month: 'Jan', single: 85, double: 75, suite: 60 },
        { month: 'Feb', single: 88, double: 82, suite: 65 },
        { month: 'Mar', single: 92, double: 78, suite: 70 },
        { month: 'Apr', single: 90, double: 85, suite: 75 },
      ];
      
      return (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="single" name="Single" stroke="hsl(var(--chart-1))" />
            <Line type="monotone" dataKey="double" name="Double" stroke="hsl(var(--chart-2))" />
            <Line type="monotone" dataKey="suite" name="Suite" stroke="hsl(var(--chart-3))" />
          </LineChart>
        </ResponsiveContainer>
      );
    }
  },
  {
    id: 'revenue-by-payment-type',
    name: 'Revenue by Payment Type',
    description: 'Distribution of revenue across different payment methods',
    icon: DollarSign,
    preview: () => {
      const data = [
        { name: 'Credit Card', value: 4500 },
        { name: 'Bank Transfer', value: 3200 },
        { name: 'Cash', value: 1800 },
        { name: 'Other', value: 500 },
      ];
      
      return (
        <ResponsiveContainer width="100%" height={200}>
          <RechartsPieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="hsl(var(--chart-1))"
              label
            />
            <Tooltip />
            <Legend />
          </RechartsPieChart>
        </ResponsiveContainer>
      );
    }
  },
];

export function Report() {
  const [timePeriod, setTimePeriod] = useState("month");
  const [rentData, setRentData] = useState<any[]>([]);
  const [occupancyData, setOccupancyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [percentageChange, setPercentageChange] = useState(0);
  const [avgOccupancy, setAvgOccupancy] = useState(0);
  const [showAddChart, setShowAddChart] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState<string | null>(null);
  const [activeCharts, setActiveCharts] = useState<string[]>(['rent-evolution', 'occupancy-rate']);

  useEffect(() => {
    fetchRentData();
    fetchOccupancyData();
  }, [timePeriod]);

  const getDateRange = () => {
    const now = new Date();
    switch (timePeriod) {
      case "week":
        return {
          start: startOfWeek(now),
          end: endOfWeek(now),
          format: "EEE",
          title: "This Week"
        };
      case "month":
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
          format: "dd MMM",
          title: "This Month"
        };
      case "quarter":
        return {
          start: startOfMonth(subMonths(now, 2)),
          end: endOfMonth(now),
          format: "MMM",
          title: "Last 3 Months"
        };
      case "year":
        return {
          start: startOfYear(now),
          end: endOfYear(now),
          format: "MMM",
          title: "This Year"
        };
      default:
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
          format: "dd MMM",
          title: "This Month"
        };
    }
  };

  const fetchRentData = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange();

      const sampleData = generateSampleData(start, end);
      
      setRentData(sampleData);
      
      const total = sampleData.reduce((sum: number, item: { rent: number }) => sum + item.rent, 0);
      setTotalRevenue(total);

      const prevTotal = sampleData.slice(0, Math.floor(sampleData.length / 2))
        .reduce((sum: number, item: { rent: number }) => sum + item.rent, 0);
      const currentTotal = sampleData.slice(Math.floor(sampleData.length / 2))
        .reduce((sum: number, item: { rent: number }) => sum + item.rent, 0);
      const change = ((currentTotal - prevTotal) / prevTotal) * 100;
      setPercentageChange(change);

    } catch (error: any) {
      console.error('Error fetching rent data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOccupancyData = async () => {
    try {
      const { start, end } = getDateRange();
      
      const data = generateOccupancyData(start, end);
      setOccupancyData(data);
      
      const avg = data.reduce((sum, item) => sum + item.occupancy, 0) / data.length;
      setAvgOccupancy(avg);
      
    } catch (error: any) {
      console.error('Error fetching occupancy data:', error);
    }
  };

  const generateSampleData = (start: Date, end: Date) => {
    const data = [];
    let current = start;
    const dateFormat = getDateRange().format;

    while (current <= end) {
      data.push({
        date: format(current, dateFormat),
        rent: Math.floor(Math.random() * 20000) + 10000
      });
      current = new Date(current.setDate(current.getDate() + 1));
    }

    if (timePeriod !== "week") {
      const grouped = data.reduce((acc: { [key: string]: { date: string; rent: number } }, item: { date: string; rent: number }) => {
        if (!acc[item.date]) {
          acc[item.date] = { date: item.date, rent: 0 };
        }
        acc[item.date].rent += item.rent;
        return acc;
      }, {});
      return Object.values(grouped);
    }

    return data;
  };

  const generateOccupancyData = (start: Date, end: Date) => {
    const data = [];
    let current = start;
    const dateFormat = getDateRange().format;
    let prevOccupancy = Math.floor(Math.random() * 30) + 60;

    while (current <= end) {
      const change = (Math.random() - 0.5) * 10;
      prevOccupancy = Math.min(100, Math.max(50, prevOccupancy + change));
      
      data.push({
        date: format(current, dateFormat),
        occupancy: Math.round(prevOccupancy)
      });
      current = new Date(current.setDate(current.getDate() + 1));
    }

    if (timePeriod !== "week") {
      const grouped = data.reduce((acc: { [key: string]: { date: string; occupancy: number; count: number } }, item: { date: string; occupancy: number }) => {
        if (!acc[item.date]) {
          acc[item.date] = { date: item.date, occupancy: 0, count: 0 };
        }
        acc[item.date].occupancy += item.occupancy;
        acc[item.date].count += 1;
        return acc;
      }, {});

      return Object.values(grouped).map((item: { date: string; occupancy: number; count: number }) => ({
        date: item.date,
        occupancy: Math.round(item.occupancy / item.count)
      }));
    }

    return data;
  };

  const handleAddChart = () => {
    if (selectedChartType) {
      setActiveCharts([...activeCharts, selectedChartType]);
      setShowAddChart(false);
      setSelectedChartType(null);
    }
  };

  const handleRemoveChart = (chartId: string) => {
    setActiveCharts(activeCharts.filter(id => id !== chartId));
  };

  const renderChart = (chartId: string) => {
    const chart = chartId === 'rent-evolution' ? (
      <Card className="shadow-none group relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveChart(chartId);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
        <CardHeader>
          <CardTitle>Rent Evolution</CardTitle>
          <CardDescription>{getDateRange().title}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={rentChartConfig}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={rentData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="grid gap-2">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Date
                            </span>
                            <span className="font-bold text-muted-foreground">
                              {payload[0].payload.date}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Revenue
                            </span>
                            <span className="font-bold">
                              €{payload[0].value.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="rent"
                  fill="hsl(var(--chart-1))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
        <CardFooter className="flex-col items-start gap-2 text-sm">
          <div className="flex gap-2 font-medium leading-none">
            {percentageChange >= 0 ? "Trending up" : "Trending down"} by {Math.abs(percentageChange).toFixed(1)}% 
            <TrendingUp className={`h-4 w-4 ${percentageChange < 0 ? 'rotate-180' : ''}`} />
          </div>
          <div className="leading-none text-muted-foreground">
            Total revenue: €{totalRevenue.toLocaleString()}
          </div>
        </CardFooter>
      </Card>
    ) : chartId === 'occupancy-rate' ? (
      <Card className="shadow-none group relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveChart(chartId);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
        <CardHeader>
          <CardTitle>Occupancy Rate</CardTitle>
          <CardDescription>{getDateRange().title}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={occupancyChartConfig}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={occupancyData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="grid gap-2">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Date
                            </span>
                            <span className="font-bold text-muted-foreground">
                              {payload[0].payload.date}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Occupancy
                            </span>
                            <span className="font-bold">
                              {payload[0].value}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="occupancy"
                  stroke="hsl(var(--chart-2))"
                  fill="hsl(var(--chart-2) / 0.2)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
        <CardFooter className="flex-col items-start gap-2 text-sm">
          <div className="flex gap-2 font-medium leading-none">
            Average occupancy rate: {avgOccupancy.toFixed(1)}%
          </div>
        </CardFooter>
      </Card>
    ) : (
      <Card className="shadow-none group relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveChart(chartId);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
        <CardHeader>
          <CardTitle>{availableCharts.find(c => c.id === chartId)?.name}</CardTitle>
          <CardDescription>{getDateRange().title}</CardDescription>
        </CardHeader>
        <CardContent>
          {availableCharts.find(c => c.id === chartId)?.preview()}
        </CardContent>
      </Card>
    );

    return chart;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
        <div className="flex items-center space-x-4">
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">Last 3 Months</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {activeCharts.map((chartId) => renderChart(chartId))}
          
          <Card 
            className="shadow-none border-dashed cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setShowAddChart(true)}
          >
            <CardContent className="flex flex-col items-center justify-center h-[400px] space-y-4">
              <div className="p-4 bg-primary/10 rounded-full">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold">Add Graph</h3>
                <p className="text-sm text-muted-foreground">
                  Click to add a new visualization
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showAddChart} onOpenChange={setShowAddChart}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Graph</DialogTitle>
            <DialogDescription>
              Choose a visualization to add to your dashboard
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6">
            <RadioGroup
              value={selectedChartType || ""}
              onValueChange={setSelectedChartType}
              className="grid gap-4"
            >
              {availableCharts.map((chart) => (
                <Label
                  key={chart.id}
                  className={`flex items-start space-x-4 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedChartType === chart.id ? "border-primary" : ""
                  }`}
                >
                  <RadioGroupItem value={chart.id} className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center">
                      <chart.icon className="h-4 w-4 mr-2" />
                      <span className="font-medium">{chart.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {chart.description}
                    </p>
                    {selectedChartType === chart.id && (
                      <div className="mt-4 border rounded-lg p-4 bg-muted/50">
                        {chart.preview()}
                      </div>
                    )}
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddChart(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddChart} disabled={!selectedChartType}>
              Add Graph
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}