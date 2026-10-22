'use client';
import React, { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useLocale } from 'next-intl';

import { useTranslations } from 'next-intl';

export default function AdminPanel() {
  const supabase = getSupabaseBrowserClient();
  const t = useTranslations('Admin');
  const locale = useLocale();
  const [tab, setTab] = useState<'verifications' | 'bookings' | 'wallet' | 'sos'>('verifications');
  const [verifs, setVerifs] = useState<any[]>([]);
  const [sosLogs, setSosLogs] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchVerifications(), fetchBookings(), fetchWalletTransactions(), fetchSos()])
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));

    const channel = supabase
      .channel('public:sos_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sos_logs' }, (payload) => {
        setSosLogs((s) => [payload.new, ...s]);
      })
      .subscribe();

    return () => void channel.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchVerifications() {
    const { data, error } = await supabase.from('verifications').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    setVerifs(data || []);
  }

  async function fetchBookings() {
    const { data, error } = await supabase.from('bookings').select('id,learner_id,instructor_id,slot_start,status,created_at').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    setBookings(data || []);
  }

  async function fetchWalletTransactions() {
    const { data, error } = await supabase.from('transactions').select('id,kind,amount,created_at,wallets(id,user_id,balance)').order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    setTransactions(data || []);
  }

  async function fetchSos() {
    const { data, error } = await supabase.from('sos_logs').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    setSosLogs(data || []);
  }

  async function act(id: string, action: 'approve' | 'reject') {
    await supabase.from('verifications').update({ status: action === 'approve' ? 'verified' : 'rejected' }).eq('id', id);
    await fetchVerifications();
  }

  return (
    <div className="mt-6">
      <div className="flex gap-2">
        <button className={`px-3 py-1 ${tab === 'verifications' ? 'bg-slate-700 text-white' : ''}`} onClick={() => setTab('verifications')}>{t('tabs.verifications')}</button>
        <button className={`px-3 py-1 ${tab === 'bookings' ? 'bg-slate-700 text-white' : ''}`} onClick={() => setTab('bookings')}>{t('tabs.bookings')}</button>
        <button className={`px-3 py-1 ${tab === 'wallet' ? 'bg-slate-700 text-white' : ''}`} onClick={() => setTab('wallet')}>{t('tabs.wallet')}</button>
        <button className={`px-3 py-1 ${tab === 'sos' ? 'bg-slate-700 text-white' : ''}`} onClick={() => setTab('sos')}>{t('tabs.sos')}</button>
      </div>

      {loading && <div className="mt-4 text-sm text-neutral-500">Loading…</div>}
      {error && <div className="mt-4 text-sm text-red-600">Error: {error}</div>}

      {tab === 'verifications' && (
        <div className="mt-4">
          {verifs.length === 0 ? (
            <div className="text-neutral-400">{t('emptyVerifications')}</div>
          ) : (
            verifs.map((v) => (
              <div key={v.id} className="border p-3 rounded mb-2 flex justify-between items-center">
                <div>
                  <div className="text-sm text-neutral-400">{v.type} — {v.status}</div>
                  <div className="font-medium">{v.doc_url}</div>
                  <div className="text-sm text-neutral-400">{new Date(v.created_at).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  {v.status === 'pending' && <button onClick={() => act(v.id, 'approve')} className="px-2 py-1 bg-emerald-600 rounded text-white">{t('approve')}</button>}
                  {v.status === 'pending' && <button onClick={() => act(v.id, 'reject')} className="px-2 py-1 bg-red-600 rounded text-white">{t('reject')}</button>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'bookings' && (
        <div className="mt-4">
          {bookings.length === 0 ? (
            <div className="text-neutral-400">{t('emptyBookings')}</div>
          ) : (
            bookings.map((b) => (
              <div key={b.id} className="border p-3 rounded mb-2">
                <div className="text-sm text-neutral-400">{b.status} — {new Date(b.created_at).toLocaleString()}</div>
                <div className="font-medium">Booking {b.id}</div>
                <div className="text-sm">Learner: {b.learner_id} — Instructor: {b.instructor_id}</div>
                <div className="text-sm">Slot: {b.slot_start}</div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'wallet' && (
        <div className="mt-4">
          {transactions.length === 0 ? (
            <div className="text-neutral-400">{t('emptyTransactions')}</div>
          ) : (
            transactions.map((t) => (
              <div key={t.id} className="border p-3 rounded mb-2">
                <div className="text-sm text-neutral-400">{t.kind} — {new Date(t.created_at).toLocaleString()}</div>
                <div className="font-medium">{t.amount} PKR</div>
                <div className="text-sm">Wallet: {t.wallet?.id ?? '—'} Owner: {t.wallet?.user_id ?? '—'}</div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'sos' && (
        <div className="mt-4">
          {sosLogs.length === 0 ? (
            <div className="text-neutral-400">{t('emptySos')}</div>
          ) : (
            sosLogs.map((s) => (
              <div key={s.id} className="border p-2 rounded mb-2">{s.user_id} — {s.note} — {new Date(s.created_at).toLocaleString()}</div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
