import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';

export default function AccessDeniedCard({ description, ...props }) {
  return (
    <Alert variant="destructive" className="border-destructive/30 bg-destructive/10" {...props}>
      <ShieldAlert />
      <AlertTitle>アクセスが拒否されました</AlertTitle>
      <AlertDescription>
        {description ||
          'Cloudflare Access で許可されたメールアドレスでログインしてください。'}
      </AlertDescription>
    </Alert>
  );
}
