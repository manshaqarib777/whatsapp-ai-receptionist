'use client';

import { Bell, Inbox, Plus, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { CommandPalette } from '@/components/command-palette';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Row, Section } from '@/features/design-system/components/section';

export function OverlaysSection() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <Section
      id="overlays"
      title="Overlays"
      description="Focus is trapped, Escape closes, and focus returns to the trigger — all from Radix."
    >
      <Row>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete conversation?</DialogTitle>
              <DialogDescription>
                This removes the thread for everyone in Acme Dental. It cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost">Cancel</Button>
              <Button variant="destructive">
                <Trash2 aria-hidden="true" className="size-4" />
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Conversation details</SheetTitle>
              <SheetDescription>Contact, labels, and assignment.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Dropdown</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Assign to me</DropdownMenuItem>
            <DropdownMenuItem>Add label</DropdownMenuItem>
            <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Popover</Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 text-sm">
            <p className="font-medium">Business hours</p>
            <p className="text-muted-foreground">
              Outside these hours the AI takes a message instead of booking.
            </p>
          </PopoverContent>
        </Popover>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Notifications">
                <Bell aria-hidden="true" className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Notifications</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </Row>

      <Row label="Toasts — confirm what happened, never block the user">
        <Button variant="outline" onClick={() => toast.success('Message sent')}>
          Success
        </Button>
        <Button variant="outline" onClick={() => toast.error('Delivery failed')}>
          Error
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast('Conversation archived', {
              action: { label: 'Undo', onClick: () => toast('Restored') },
            })
          }
        >
          With undo
        </Button>
      </Row>

      <Row label="Command palette — ⌘K anywhere, or the button">
        <Button variant="outline" onClick={() => setPaletteOpen(true)}>
          Open palette
        </Button>
      </Row>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        actions={[
          {
            id: 'inbox',
            label: 'Go to inbox',
            icon: Inbox,
            group: 'Navigate',
            keywords: ['conversations', 'messages'],
            shortcut: 'G I',
            onSelect: () => toast('Inbox'),
          },
          {
            id: 'settings',
            label: 'Open settings',
            icon: Settings,
            group: 'Navigate',
            keywords: ['preferences', 'configuration'],
            onSelect: () => toast('Settings'),
          },
          {
            id: 'new',
            label: 'New conversation',
            icon: Plus,
            group: 'Actions',
            shortcut: '⌘N',
            onSelect: () => toast('New conversation'),
          },
        ]}
      />
    </Section>
  );
}
