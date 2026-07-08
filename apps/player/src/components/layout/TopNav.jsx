import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Clapperboard, Library, Menu, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'ライブラリ', icon: Clapperboard },
  { to: '/library', label: '管理', icon: Library },
];

function isActive(pathname, to) {
  if (to === '/') return pathname === '/' || pathname === '/player';
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavLinks({ onNavigate, className }) {
  const { pathname } = useLocation();

  return (
    <nav className={cn('flex items-center gap-1', className)}>
      {navItems.map((item) => {
        const active = isActive(pathname, item.to);
        const Icon = item.icon;
        return (
          <Button
            key={item.to}
            asChild
            variant={active ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              'gap-2 px-3',
              active ? 'text-foreground' : 'text-muted-foreground'
            )}
            onClick={() => onNavigate?.()}
          >
            <Link to={item.to}>
              <Icon data-icon="inline-start" />
              {item.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}

export default function TopNav({ cinema = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const onPlayer = pathname === '/player';

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-colors duration-300',
        cinema || onPlayer
          ? 'border-transparent bg-background/40 backdrop-blur-md'
          : 'border-border/60 bg-background/85 backdrop-blur-md'
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4 md:h-16 md:px-6">
        <Link
          to="/"
          className="group flex min-w-0 items-center gap-2.5 text-foreground no-underline"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background transition-transform duration-300 group-hover:scale-105">
            <Play className="size-4 fill-current" />
          </span>
          <span className="truncate text-lg font-semibold tracking-tight md:text-xl">
            MKV Player
          </span>
        </Link>

        <div className="ms-auto hidden md:block">
          <NavLinks />
        </div>

        <div className="ms-auto md:hidden">
          <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="メニュー">
                <Menu />
              </Button>
            </DialogTrigger>
            <DialogContent
              className="fixed inset-x-4 top-20 z-50 w-auto max-w-none translate-x-0 translate-y-0 rounded-2xl p-4"
              showCloseButton
            >
              <DialogTitle className="sr-only">ナビゲーション</DialogTitle>
              <NavLinks
                className="flex-col items-stretch"
                onNavigate={() => setMenuOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
