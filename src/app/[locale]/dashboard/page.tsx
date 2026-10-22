// "use server" - server component
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import AppShell from '@/components/AppShell';
import BackButton from '@/components/BackButton';
import SOSButtonClientWrapper from '@/modules/safety/SOSButtonClientWrapper';
import InstructorEarnings from '@/modules/earning/InstructorEarnings';

export default async function DashboardPage({ params }: { params: { locale: string } }) {
  const supabase = await getSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect(`/${params.locale}/signin`);
  const user = session.user;

  // fetch profile
  const { data: profile } = await supabase
    .from('users')
    .select('full_name,city,role')
    .eq('id', user.id)
    .maybeSingle();

  // wallet balance
  let balance: number | null = null;
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id,balance')
    .eq('user_id', user.id)
    .maybeSingle();

  if (wallet?.balance !== undefined && wallet?.balance !== null) balance = wallet.balance;
  if (balance === null) {
    // fallback: no transactions query by user_id because transactions table has no user_id column
    balance = 0;
  }
  if (balance === null) balance = 0;
  const safeBalance: number = balance ?? 0;

  // verification badge
  const { data: ver } = await supabase
    .from('verifications')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle();
  const verified = ver?.status === 'verified';

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto bg-slate-800 p-6 rounded">
        <BackButton />
        <h1 className="text-2xl text-white">Dashboard</h1>
        <div className="mt-4 text-white">
          <div><strong>Name:</strong> {profile?.full_name || user.email}</div>
          <div><strong>City:</strong> {profile?.city || '—'}</div>
          <div><strong>Role:</strong> {profile?.role || '—'}</div>
          <div><strong>Verified:</strong> {verified ? 'Yes' : 'No'}</div>
          <div className="mt-4"><strong>Wallet:</strong> PKR {safeBalance.toFixed(2)}</div>
        </div>

        {profile?.role === 'instructor' ? (
          <InstructorEarnings instructorId={user.id} locale={params.locale} />
        ) : null}

        <nav className="mt-6 grid grid-cols-2 gap-2">
          <a href={`/${params.locale}/verification`} className="p-2 bg-slate-700 rounded text-white">Verification</a>
          <a href={`/${params.locale}/marketplace`} className="p-2 bg-slate-700 rounded text-white">Marketplace</a>
          <a href={`/${params.locale}/wallet`} className="p-2 bg-slate-700 rounded text-white">Wallet</a>
          <a href={`/${params.locale}/ai-tutor`} className="p-2 bg-slate-700 rounded text-white">AI Tutor</a>
          {/* vehicle link removed intentionally */}
          <a href={`/${params.locale}/sos`} className="p-2 bg-slate-700 rounded text-white">SOS</a>

          <div className="col-span-2 mt-4">
            {/* Mount client SOSButton via the existing client wrapper */}
            <SOSButtonClientWrapper />
          </div>

          <a href={`/${params.locale}/security`} className="p-2 bg-slate-700 rounded text-white">Security</a>
        </nav>
      </div>
    </AppShell>
  );
}