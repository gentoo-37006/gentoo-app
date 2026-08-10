import { DownloadsContent } from '@/components/downloads-content';
import { useAuth } from '@/lib/auth';

export default function DownloadsScreen() {
  const { session, profile } = useAuth();
  const standalone = !session || profile?.status !== 'approved';

  return (
    <DownloadsContent
      publicPage={standalone}
      returnToPending={Boolean(session && profile?.status !== 'approved')}
    />
  );
}
