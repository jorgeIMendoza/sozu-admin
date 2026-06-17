import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface MetricCardProps {
  label: string;
  value: string;
  tooltip?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export default function MetricCard({ label, value, tooltip, trend, className = '' }: MetricCardProps) {
  return (
    <div className={`metric-card group ${className}`}>
      <p className="metric-label flex items-center gap-1">
        {label}
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 cursor-help text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </p>
      <p className="metric-value mt-3">{value}</p>
      {trend && trend !== 'neutral' && (
        <span className={`trend-chip mt-2 ${
          trend === 'up' ? 'trend-chip-up' : 'trend-chip-down'
        }`}>
          {trend === 'up' ? '↑' : '↓'}
        </span>
      )}
    </div>
  );
}
