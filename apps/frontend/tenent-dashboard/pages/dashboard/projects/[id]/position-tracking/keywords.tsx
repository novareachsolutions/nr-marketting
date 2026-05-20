import { useEffect } from 'react';
import { useRouter } from 'next/router';

// The Rankings Table now lives inline on the Position Tracking overview page.
// This route is kept solely to redirect any old bookmarks/links to the new
// combined page.
export default function RankingsTableRedirect() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  useEffect(() => {
    if (id) router.replace(`/dashboard/projects/${id}/position-tracking`);
  }, [id, router]);

  return null;
}
