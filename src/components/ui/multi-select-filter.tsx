import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface MultiSelectFilterProps {
  values: string[];
  onValuesChange: (values: string[]) => void;
  options: string[];
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export function MultiSelectFilter({
  values,
  onValuesChange,
  options,
  placeholder = "Seleccionar...",
  emptyText = "No se encontraron resultados.",
  searchPlaceholder = "Buscar...",
  disabled = false,
  className,
  icon,
}: MultiSelectFilterProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  // Filter options based on search - only show when searching
  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options.slice(0, 100); // Show all when no search
    const searchLower = search.toLowerCase().trim();
    return options.filter(option => 
      option.toLowerCase().includes(searchLower)
    ).slice(0, 100); // Limit results for performance
  }, [options, search]);

  const handleToggle = (option: string) => {
    if (values.includes(option)) {
      onValuesChange(values.filter(v => v !== option));
    } else {
      onValuesChange([...values, option]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValuesChange([]);
  };

  const displayText = React.useMemo(() => {
    if (values.length === 0) return placeholder;
    if (values.length === 1) {
      const val = values[0];
      return val.length > 25 ? val.substring(0, 22) + "..." : val;
    }
    return `${values.length} seleccionados`;
  }, [values, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            values.length === 0 && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <span className="flex items-center gap-2 truncate text-left">
            {icon}
            {displayText}
          </span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {values.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {values.length}
              </Badge>
            )}
            {values.length > 0 && (
              <X 
                className="h-3 w-3 opacity-50 hover:opacity-100 cursor-pointer" 
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="flex flex-col">
          {/* Search input */}
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          
          {/* Selected items badges */}
          {values.length > 0 && (
            <div className="flex flex-wrap gap-1 p-2 border-b max-h-[80px] overflow-y-auto">
              {values.map((value) => (
                <Badge 
                  key={value} 
                  variant="secondary" 
                  className="text-xs cursor-pointer hover:bg-destructive/10"
                  onClick={() => handleToggle(value)}
                >
                  {value.length > 20 ? value.substring(0, 17) + "..." : value}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          )}
          
          {/* Options list */}
          <ScrollArea className="max-h-[250px]">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              <div className="p-1">
                {filteredOptions.map((option) => (
                  <div
                    key={option}
                    onClick={() => handleToggle(option)}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                      values.includes(option) && "bg-accent/50"
                    )}
                  >
                    <Checkbox 
                      checked={values.includes(option)}
                      className="mr-2 h-4 w-4"
                    />
                    <span className="truncate flex-1">{option}</span>
                    {values.includes(option) && (
                      <Check className="h-4 w-4 shrink-0 text-primary ml-2" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          {values.length > 0 && (
            <div className="border-t p-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-xs"
                onClick={() => onValuesChange([])}
              >
                Limpiar selección
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
