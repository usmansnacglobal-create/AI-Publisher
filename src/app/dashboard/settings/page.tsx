import { getViewer } from '@/lib/data';
import { Settings } from './settings';

export const metadata = { title: 'Settings' };

export default async function SettingsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const { supabase, user, profile } = await getViewer();
  let avatarUrl: string | null = null;
  if (profile.avatar_path) avatarUrl = (await supabase.storage.from('avatars').createSignedUrl(profile.avatar_path, 3600)).data?.signedUrl ?? null;
  return <Settings tab={searchParams.tab ?? 'profile'} profile={profile} email={user.email ?? ''} avatarUrl={avatarUrl} />;
}
