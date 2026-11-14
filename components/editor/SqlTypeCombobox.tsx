'use client';

import { Check, ChevronsUpDown, CornerDownLeft } from 'lucide-react';
import { useState } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SQL_TYPES } from './factory';

/**
 * Seletor de tipo SQL: sempre lista todos os tipos, filtra conforme a digitação
 * e aceita um tipo livre (ex.: varchar(80)) que não esteja na lista.
 */
export default function SqlTypeCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const typed = search.trim().toLowerCase();
  const isCustom = typed && !SQL_TYPES.includes(typed);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={(o) => (setOpen(o), o || setSearch(''))}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label="Tipo da coluna"
          className="flex h-8 w-full min-w-0 items-center justify-between gap-1 rounded-md border border-input bg-background px-2 font-mono text-xs text-ink shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="truncate">{value || 'tipo'}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="end">
        <Command>
          <CommandInput placeholder="Buscar ou digitar tipo…" className="font-mono text-xs" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">Nenhum tipo encontrado.</CommandEmpty>
            {isCustom && (
              <CommandGroup heading="Tipo personalizado">
                <CommandItem value={`__custom ${typed}`} onSelect={() => pick(typed)} className="font-mono text-xs">
                  <CornerDownLeft /> Usar &ldquo;{typed}&rdquo;
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Tipos PostgreSQL">
              {SQL_TYPES.map((t) => (
                <CommandItem key={t} value={t} onSelect={() => pick(t)} className="font-mono text-xs">
                  <Check className={cn(value === t ? 'opacity-100' : 'opacity-0')} />
                  {t}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
