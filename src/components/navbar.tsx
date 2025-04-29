import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="h-16 border-b px-6 flex items-center justify-between bg-background">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-semibold">PropertyHub</h1>
      </div>
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}