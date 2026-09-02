'use client';

import { BarChart3, Inbox, LayoutDashboard, Settings, Users } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/page-header';
import { SidebarNav } from '@/components/sidebar-nav';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Row, Section } from '@/features/design-system/components/section';

const SECTIONS = [
  {
    items: [
      // Points at the gallery's own route so the active state is visible here. The
      // component derives it from the route and nothing else, so there is no way to
      // fake it for a specimen — and no reason to want one.
      { href: '/design', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/inbox', label: 'Inbox', icon: Inbox, count: 12 },
      { href: '/contacts', label: 'Contacts', icon: Users },
    ],
  },
  {
    label: 'Manage',
    items: [
      { href: '/reports', label: 'Reports', icon: BarChart3 },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function NavigationSection() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Section
      id="navigation"
      title="Navigation"
      description="Active state comes from the route, so deep links and back-navigation highlight correctly."
    >
      {/* Fixed height rather than the real full-height rail: this is a specimen in a
          scrolling page, not the shell. The shell itself is `AppShell`. Tall enough to
          show every item without scrolling inside the box — a clipped final item reads
          as a layout bug rather than as a specimen. */}
      <div className="flex h-[34rem] overflow-hidden rounded-xl border">
        <SidebarNav
          sections={SECTIONS}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          onSearch={() => {}}
          header={
            !collapsed ? (
              <span className="truncate text-sm font-semibold">Acme Dental</span>
            ) : (
              <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-xs font-semibold">
                A
              </span>
            )
          }
          footer={
            !collapsed ? (
              <p className="text-muted-foreground truncate text-xs">alex@acme.example</p>
            ) : null
          }
        />

        <div className="flex-1 overflow-y-auto">
          <PageHeader
            title="Members"
            description="Who can see and reply to conversations."
            breadcrumbs={[
              { label: 'Home', href: '/' },
              { label: 'Settings', href: '/settings' },
              { label: 'Members' },
            ]}
            actions={<Button size="sm">Invite</Button>}
          />
          <p className="text-muted-foreground p-6 text-sm">
            Page content. The header is sticky and does not repeat sidebar navigation.
          </p>
        </div>
      </div>

      <Row label="Breadcrumb — only past two levels; the current page is not a link">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Settings</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Members</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Row>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="text-muted-foreground pt-3 text-sm">
          Overview panel
        </TabsContent>
        <TabsContent value="activity" className="text-muted-foreground pt-3 text-sm">
          Activity panel
        </TabsContent>
      </Tabs>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="one">
          <AccordionTrigger>How does escalation work?</AccordionTrigger>
          <AccordionContent className="text-muted-foreground text-sm">
            A conversation is handed to a human and the AI stops replying until it is
            released.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="two">
          <AccordionTrigger>What happens outside business hours?</AccordionTrigger>
          <AccordionContent className="text-muted-foreground text-sm">
            The AI takes a message and tells the customer when someone will reply.
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">1</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" isActive>
              2
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">3</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </Section>
  );
}
