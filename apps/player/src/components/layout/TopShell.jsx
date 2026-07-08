import { Outlet, useLocation } from 'react-router-dom';
import TopNav from './TopNav.jsx';
import { cn } from '@/lib/utils';

export default function TopShell() {
  const { pathname } = useLocation();
  const cinema = pathname === '/player';

  return (
    <div
      className={cn(
        'relative min-h-screen bg-background text-foreground',
        'before:pointer-events-none before:absolute before:inset-0 before:-z-10',
        'before:bg-[radial-gradient(ellipse_at_top,oklch(0.22_0.02_70)_0%,transparent_55%)]'
      )}
    >
      <TopNav cinema={cinema} />
      <div className={cn('min-h-[calc(100vh-3.5rem)]', cinema && 'md:min-h-[calc(100vh-4rem)]')}>
        <Outlet />
      </div>
    </div>
  );
}
