import { getViewer } from '@/lib/data';
import { getUsage } from '@/lib/tokens';
import { Sidebar } from '@/components/sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await getViewer();
  const usage = await getUsage(user.id);
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
      <Sidebar
        name={profile.pen_name || profile.full_name || user.email || ''}
        isAdmin={profile.role === 'admin'}
        unread={count ?? 0}
        usage={{ used: usage.tokensUsed, limit: usage.tokenLimit, plan: usage.planName, resets: usage.periodEnd }}
      />
      <main className="min-w-0 px-4 pb-16 pt-6 sm:px-8 lg:pt-10">{children}</main>
    </div>
  );
}
