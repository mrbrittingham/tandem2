/* ── Design tokens (import this CSS in consuming apps) ── */
// import "@tandem/ui-kit/src/tokens/tokens.css";

/* ── Chat widget (existing public API) ── */
export { ChatWidget } from "./ChatWidget";
export { resolveWidgetRuntimeConfig } from "./runtime-config";
export type {
	ChatWidgetProps,
	ThemeTokens,
	MessageDescriptor,
	MessageCTA,
} from "./ChatWidget";
export type { WidgetRuntimeConfig, WidgetRuntimeConfigInput } from "./runtime-config";

/* ── Primitives ── */
export {
	Button,
	Input,
	Textarea,
	Select,
	Switch,
	Checkbox,
	Badge,
	Avatar,
	Kbd,
	IconButton,
} from "./primitives";
export type {
	ButtonProps,
	InputProps,
	TextareaProps,
	SelectProps,
	SwitchProps,
	CheckboxProps,
	BadgeProps,
	AvatarProps,
	KbdProps,
	IconButtonProps,
} from "./primitives";

/* ── Feedback ── */
export { Skeleton, Spinner, Toaster, toast, EmptyState, ProgressBar } from "./feedback";
export type { SkeletonProps, SpinnerProps, ToasterProps, EmptyStateProps, ProgressBarProps } from "./feedback";

/* ── Layout ── */
export {
	AppShell,
	Sidebar,
	SidebarGroup,
	SidebarItem,
	SidebarProvider,
	useSidebar,
	Topbar,
	PageContainer,
	PageHeader,
	Card,
	Divider,
	Stack,
} from "./layout";
export type {
	AppShellProps,
	SidebarProps,
	SidebarGroupProps,
	SidebarItemProps,
	TopbarProps,
	PageContainerProps,
	PageHeaderProps,
	CardProps,
	DividerProps,
	StackProps,
} from "./layout";

/* ── Utilities ── */
export { cn } from "./lib/cn";

/* ── Overlays ── */
export {
  DialogRoot,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  PopoverRoot,
  PopoverTrigger,
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from "./overlay";
export type {
  DialogContentProps,
  PopoverContentProps,
  DropdownMenuContentProps,
  DropdownMenuItemProps,
  TooltipContentProps,
} from "./overlay";

/* ── Data ── */
export {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  TableEmpty,
  TableLoading,
  StatCard,
  ActivityFeed,
} from "./data";
export type {
  TableProps,
  TableHeaderCellProps,
  StatCardProps,
  ActivityFeedProps,
  ActivityFeedItemProps,
} from "./data";

/* ── Workflow ── */
export {
  Stepper,
  StatusPill,
  LogList,
  SplitPanel,
} from "./workflow";
export type {
  StepperProps,
  StepperStep,
  StatusPillProps,
  LogListProps,
  LogEntry,
  SplitPanelProps,
} from "./workflow";
