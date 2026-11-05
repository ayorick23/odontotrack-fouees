/**
 * Íconos de la app (Phosphor, identidad visual 2026-11).
 *
 * Todo el código importa los íconos desde aquí, nunca directo de la
 * librería: para cambiar el ícono de algo se toca una sola línea. Los
 * nombres de la izquierda son los que ya usaba el código (venían de
 * lucide); los de la derecha, el dibujo de Phosphor elegido.
 *
 * Grosor: por defecto "regular". En el menú y en las tarjetas se usa
 * `weight="duotone"` (y "fill" en el ítem activo).
 */
export type { Icon as AppIcon, IconProps as AppIconProps } from "@phosphor-icons/react";

export {
  // Navegación y secciones
  SquaresFourIcon as LayoutDashboard,
  CalendarDotsIcon as CalendarDays,
  CalendarDotsIcon as CalendarClock,
  CalendarPlusIcon as CalendarPlus,
  AddressBookIcon as AddressBook,
  UserSwitchIcon as UserSwitch,
  EyeIcon as Eye,
  StudentIcon as Student,
  GraduationCapIcon as GraduationCap,
  UsersThreeIcon as UsersThree,
  BooksIcon as Books,
  BookOpenIcon as BookOpen,
  ShieldIcon as Shield,
  ShieldCheckIcon as ShieldCheck,
  HeadsetIcon as Headset,
  ToothIcon as Tooth,

  // Personas
  UsersIcon as Users,
  UserCheckIcon as UserCheck,
  UserPlusIcon as UserPlus,
  UserMinusIcon as UserX,
  UserGearIcon as UserCog,
  StethoscopeIcon as Stethoscope,

  // Acciones
  PlusIcon as Plus,
  PencilSimpleIcon as Pencil,
  PencilSimpleSlashIcon as PencilOff,
  TrashIcon as Trash2,
  FloppyDiskIcon as Save,
  DownloadSimpleIcon as Download,
  ArrowCounterClockwiseIcon as Undo2,
  MagnifyingGlassIcon as Search,
  MagnifyingGlassMinusIcon as SearchX,
  FunnelXIcon as FilterX,
  SignOutIcon as LogOut,
  ArrowUpRightIcon as ArrowUpRight,
  CameraIcon as Camera,
  CursorClickIcon as MousePointerClick,
  KeyIcon as KeyRound,
  LockIcon as Lock,
  LockOpenIcon as LockOpen,
  EyeSlashIcon as EyeOff,

  // Estados y avisos
  CheckIcon as Check,
  CheckIcon,
  CheckCircleIcon as CircleCheckBig,
  CheckCircleIcon as CircleCheckIcon,
  SealCheckIcon as BadgeCheck,
  ClipboardTextIcon as ClipboardCheck,
  ListChecksIcon as ClipboardList,
  WarningIcon as AlertTriangle,
  WarningIcon as TriangleAlertIcon,
  XCircleIcon as OctagonXIcon,
  InfoIcon,
  CircleNotchIcon as Loader2Icon,
  HourglassMediumIcon as Hourglass,
  ClockIcon as Clock,
  ClockIcon as Clock3,
  ClockCounterClockwiseIcon as History,
  ConfettiIcon as PartyPopper,
  EnvelopeSimpleIcon as MailCheck,
  BellIcon as Bell,
  CircleIcon as Circle,

  // Archivos
  FileTextIcon as FileText,
  FolderOpenIcon as FolderOpen,
  ImageIcon as Image,
  TrayIcon as Inbox,

  // Flechas y controles
  ArrowDownIcon as ArrowDown,
  ArrowUpIcon as ArrowUp,
  CaretDownIcon as ChevronDown,
  CaretDownIcon as ChevronDownIcon,
  CaretUpIcon as ChevronUpIcon,
  CaretLeftIcon as ChevronLeft,
  CaretRightIcon as ChevronRight,
  CaretUpDownIcon as ChevronsUpDown,
  XIcon as X,

  // Tema
  SunIcon as Sun,
  MoonIcon as Moon,
} from "@phosphor-icons/react";
