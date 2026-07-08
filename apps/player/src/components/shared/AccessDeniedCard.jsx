import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AccessDeniedCard({ description, ...props }) {
  return (
    <Alert variant="destructive" {...props}>
      <AlertTitle>Access denied</AlertTitle>
      <AlertDescription>
        {description || 'Cloudflare Access で許可されたメールアドレスでログインしてください。'}
      </AlertDescription>
    </Alert>
  );
}

