import { type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface ChartConfig {
  [key: string]: {
    label: string;
    color: string;
  };
}

interface ChartContainerProps {
  config: ChartConfig;
  children: ReactNode;
}

export interface ChartTooltipProps {
  content: (props: any) => ReactNode;
}

export function ChartContainer({ config, children }: ChartContainerProps) {
  return (
    <div className="p-2">
      <div className="mb-4 flex items-center gap-4">
        {Object.entries(config).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: value.color }}
            />
            <div className="text-sm text-muted-foreground">{value.label}</div>
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

export function ChartTooltip({ content }: ChartTooltipProps) {
  const RenderContent = content;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <RenderContent />
        </TooltipTrigger>
        <TooltipContent>
          <RenderContent />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}