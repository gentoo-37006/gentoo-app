import { DownloadsContent } from '@/components/downloads-content';
import { useAuth } from '@/lib/auth';

export default function DownloadsScreen() {
  const { session } = useAuth();

  return <DownloadsContent publicPage={!session} />;
}
