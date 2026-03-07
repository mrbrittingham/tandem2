"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarGroup,
  SidebarItem,
} from "@tandem/ui-kit";

/* ── Icon components (inline SVGs to avoid extra deps in layout) ── */

function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7.5 9 3l6 4.5V15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7.5Z" />
      <path d="M7 16V9h4v7" />
    </svg>
  );
}

function IconInbox() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9h3.6a1 1 0 0 1 .8.4l1.2 1.6a1 1 0 0 0 .8.4h1.2a1 1 0 0 0 .8-.4l1.2-1.6a1 1 0 0 1 .8-.4H15" />
      <rect x="3" y="3" width="12" height="12" rx="2" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 14V4a2 2 0 0 1 2-2h10v12H5a2 2 0 0 0-2 2Z" />
      <path d="M3 14a2 2 0 0 1 2-2h10v4H5a2 2 0 0 1-2-2Z" />
    </svg>
  );
}

function IconBot() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="6" width="10" height="8" rx="2" />
      <path d="M9 6V4" />
      <circle cx="7" cy="10" r="0.5" fill="currentColor" />
      <circle cx="11" cy="10" r="0.5" fill="currentColor" />
      <path d="M7.5 12.5h3" />
    </svg>
  );
}

function IconPalette() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="7" />
      <circle cx="7" cy="7" r="1" fill="currentColor" />
      <circle cx="11" cy="7" r="1" fill="currentColor" />
      <circle cx="6" cy="10.5" r="1" fill="currentColor" />
      <path d="M12 10c0 1.5-.7 3-3 3s-2-1.5-2-1.5" />
    </svg>
  );
}

function IconHandoff() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4 8 10" />
      <path d="M14 4h-4" />
      <path d="M14 4v4" />
      <path d="M4 14l6-6" />
    </svg>
  );
}

function IconPlug() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3v3" />
      <path d="M11 3v3" />
      <path d="M5 6h8v3a4 4 0 0 1-8 0V6Z" />
      <path d="M9 13v3" />
    </svg>
  );
}

function IconMapPin() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 16s-5-4.35-5-8a5 5 0 0 1 10 0c0 3.65-5 8-5 8Z" />
      <circle cx="9" cy="8" r="1.5" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="2.5" />
      <path d="M9 2v1.5M9 14.5V16M2 9h1.5M14.5 9H16M4 4l1.05 1.05M12.95 12.95 14 14M14 4l-1.05 1.05M5.05 12.95 4 14" />
    </svg>
  );
}

const navConfig = [
  {
    group: "Core",
    items: [
      { label: "Overview", href: "/overview", icon: <IconHome /> },
      { label: "Inbox", href: "/conversations", icon: <IconInbox /> },
      { label: "Knowledge", href: "/knowledge", icon: <IconBook /> },
      { label: "Assistant", href: "/intents", icon: <IconBot /> },
    ],
  },
  {
    group: "Configure",
    items: [
      { label: "Appearance", href: "/widget", icon: <IconPalette /> },
      { label: "Handoff", href: "/handoff", icon: <IconHandoff /> },
      { label: "Integrations", href: "/integrations", icon: <IconPlug /> },
    ],
  },
  {
    group: "Manage",
    items: [
      { label: "Locations", href: "/locations", icon: <IconMapPin /> },
      { label: "Settings", href: "/settings", icon: <IconSettings /> },
    ],
  },
];

export function ConsoleSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      {navConfig.map((section) => (
        <SidebarGroup key={section.group} label={section.group}>
          {section.items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <SidebarItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={isActive}
                as={Link}
              />
            );
          })}
        </SidebarGroup>
      ))}
    </Sidebar>
  );
}
