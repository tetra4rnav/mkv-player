import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'ブラウザ' },
  { to: '/player', label: 'プレーヤー' },
  { to: '/library', label: 'ライブラリ管理' },
];

function isActive(pathname, to) {
  if (to === '/') return pathname === '/';
  if (to === '/player') return pathname === '/player';
  if (to === '/library') return pathname === '/library';
  return pathname === to;
}

export default function SidebarNav({ onNavigate }) {
  const { pathname } = useLocation();

  return (
    <nav className="flex flex-col gap-1 px-2">
      {navItems.map((item) => {
        const active = isActive(pathname, item.to);

        return (
          <Button
            key={item.to}
            asChild
            variant={active ? 'default' : 'ghost'}
            className={cn('justify-start px-3', active ? '' : 'text-muted-foreground')}
            size="sm"
            onClick={() => onNavigate?.()}
          >
            <Link to={item.to}>{item.label}</Link>
          </Button>
        );
      })}
    </nav>
  );
}

