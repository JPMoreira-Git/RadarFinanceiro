import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  ArrowDownUp,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Plus,
  Settings2,
  WalletCards,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Visão geral", path: "/" },
  { icon: ArrowDownUp, label: "Lançamentos", path: "/lancamentos" },
  { icon: Plus, label: "Novo lançamento", path: "/novo" },
  { icon: Settings2, label: "Configurações", path: "/configuracoes" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 256;
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f6] px-6">
        <div className="flex w-full max-w-md flex-col items-center gap-7 rounded-[2rem] border border-[#dde4df] bg-white p-9 text-center shadow-[0_20px_70px_rgba(26,58,46,0.08)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#173f35] text-white shadow-lg shadow-[#173f35]/15">
            <WalletCards className="h-7 w-7" />
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#9a6b43]">Fluxo</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-[#173f35]">Seu dinheiro, em harmonia.</h1>
            <p className="mt-3 text-sm leading-6 text-[#6b7b74]">Entre para acompanhar as decisões financeiras da família em um só lugar.</p>
          </div>
          <Button onClick={() => startLogin()} size="lg" className="h-12 w-full rounded-xl bg-[#173f35] text-white shadow-lg shadow-[#173f35]/15 hover:bg-[#235b4c]">
            Entrar no Fluxo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = { children: React.ReactNode; setSidebarWidth: (width: number) => void };

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find((item) => item.path === location) ?? menuItems[0];
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = event.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-20 justify-center border-b border-[#dfe7e2]">
            <div className="flex w-full items-center gap-3 px-2">
              <button onClick={toggleSidebar} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#173f35] text-white transition-colors hover:bg-[#235b4c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9a6b43]" aria-label="Alternar navegação">
                <PanelLeft className="h-4 w-4" />
              </button>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold tracking-tight text-[#173f35]">Fluxo</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9a6b43]">Controle familiar</p>
                </div>
              )}
            </div>
          </SidebarHeader>
          <SidebarContent className="gap-0 pt-5">
            <p className="px-5 pb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b9c94] group-data-[collapsible=icon]:hidden">Navegação</p>
            <SidebarMenu className="px-3 py-1">
              {menuItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.label} className={`h-11 rounded-xl font-medium transition-all ${isActive ? "bg-[#e5f0eb] text-[#173f35] shadow-sm" : "text-[#687a72] hover:bg-[#f0f5f2] hover:text-[#173f35]"}`}>
                      <item.icon className={`h-[18px] w-[18px] ${isActive ? "text-[#9a6b43]" : ""}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="border-t border-[#dfe7e2] p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[#f0f5f2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9a6b43] group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-9 w-9 shrink-0 border border-[#cbdad1] bg-[#dfeee7]"><AvatarFallback className="bg-[#dfeee7] text-xs font-bold text-[#173f35]">{user?.name?.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-semibold leading-none text-[#173f35]">{user?.name || "Usuário"}</p><p className="mt-1.5 truncate text-xs text-[#8b9c94]">Conta pessoal</p></div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl"><DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" /><span>Sair</span></DropdownMenuItem></DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div className={`absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-[#9a6b43]/20 ${isCollapsed ? "hidden" : ""}`} onMouseDown={() => !isCollapsed && setIsResizing(true)} style={{ zIndex: 50 }} />
      </div>
      <SidebarInset>
        {isMobile && <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#dfe7e2] bg-[#f7f8f6]/95 px-4 backdrop-blur"><div className="flex items-center gap-3"><SidebarTrigger className="h-9 w-9 rounded-xl bg-white" /><div><p className="font-display text-lg font-semibold tracking-tight text-[#173f35]">{activeMenuItem.label}</p><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9a6b43]">Fluxo</p></div></div><div className="h-2 w-2 rounded-full bg-[#9a6b43]" /></div>}
        <main className="min-h-screen flex-1 bg-[#f7f8f6] pb-24 md:pb-8">{children}</main>
      </SidebarInset>
    </>
  );
}
