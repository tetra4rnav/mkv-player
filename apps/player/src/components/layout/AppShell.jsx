import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import SidebarNav from './SidebarNav.jsx';

export default function AppShell() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentLabel =
    pathname === '/'
      ? 'ブラウザ'
      : pathname === '/player'
        ? 'プレーヤー'
        : pathname === '/library'
          ? 'ライブラリ管理'
          : 'MKV Player';

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="hidden w-64 flex-col border-r bg-background md:flex">
        <div className="px-4 py-4">
          <div className="text-lg font-semibold">MKV Player</div>
          <div className="mt-1 text-xs text-muted-foreground">Dashboard</div>
        </div>

        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header + menu */}
        <div className="md:hidden border-b bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between px-3 py-3">
            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  メニュー
                </Button>
              </DialogTrigger>
              {/* Controlled so navigation closes the menu */}
              <DialogContent
                className="fixed left-0 top-0 z-50 h-full w-[280px] max-w-none translate-x-0 -translate-y-0 rounded-none p-0"
                showCloseButton={false}
              >
                <div className="px-4 py-4">
                  <div className="text-lg font-semibold">MKV Player</div>
                  <div className="mt-1 text-xs text-muted-foreground">Dashboard</div>
                </div>
                <SidebarNav onNavigate={() => setMenuOpen(false)} />
              </DialogContent>
            </Dialog>

            <div className="flex-1 px-3 text-sm font-semibold truncate">
              {currentLabel}
            </div>
            <div className="w-20" />
          </div>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

