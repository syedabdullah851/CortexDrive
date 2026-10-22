'use client';

import React, { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';

function StatusBadge({ status }: { status: string }) {
  if (!status) return null;
  const map: Record<string, { label: string; cls: string }> = {
    verified: { label: 'Verified', cls: 'bg-emerald-100 text-emerald-800' },
    needs_review: { label: 'Needs Review', cls: 'bg-amber-100 text-amber-800' },
    rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-800' },
    pending: { label: 'Pending', cls: 'bg-neutral-100 text-neutral-800' },
  };
  const p = map[status] ?? { label: status, cls: 'bg-neutral-100 text-neutral-800' };
  return <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${p.cls}`}>{p.label}</span>;
}

export default function VerificationPage() {
  const t = useTranslations('Verification');
  const tc = useTranslations('Common');
  const [cnic, setCnic] = useState<File | null>(null);
  const [license, setLicense] = useState<File | null>(null);
  const [docType, setDocType] = useState<'cnic' | 'driving_license'>('cnic');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<any[] | null>(null);
  const [rowsError, setRowsError] = useState<string | null>(null);

  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    async function load() {
      setRows(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setRowsError(tc('error')); return; }
        const { data, error } = await supabase.from('verifications').select('id,type,status,created_at').eq('user_id', user.id).order('created_at', { ascending: false });
        if (error) throw error;
        setRows(data || []);
      } catch (e: any) { setRowsError(e.message || String(e)); }
    }
    load();
  }, [supabase, tc]);

  async function uploadToStorage(file: File, userId: string, namePrefix: string) {
    const ts = Date.now();
    const path = `verifications/${userId}/${namePrefix}-${ts}-${file.name}`;
    const bucket = 'verifications';
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
    if (error) throw new Error(error.message);
    // store the storage path (data.path)
    return data.path;
  }

  async function submit() {
    setMessage(null);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(tc('errors.notSignedIn'));
      if (!cnic || (docType === 'driving_license' && !license)) throw new Error('Please select required files');

      // Upload files to private storage under verifications/{user.id}/...
      const cnicPath = await uploadToStorage(cnic!, user.id, 'cnic');
      let licensePath = null;
      if (docType === 'driving_license' && license) {
        licensePath = await uploadToStorage(license, user.id, 'license');
      }

      // Insert verification row
      const payload: any = {
        user_id: user.id,
        type: docType,
        doc_url: licensePath ?? cnicPath,
        selfie_url: null,
        status: 'pending',
      };

      const { data, error } = await supabase.from('verifications').insert(payload).select('*').single();
      if (error) throw new Error(error.message);

      setMessage(t('submitSuccess'));
      // reload rows
      const { data: list } = await supabase.from('verifications').select('id,type,status,created_at').eq('user_id', user.id).order('created_at', { ascending: false });
      setRows(list || []);
    } catch (e: any) {
      setMessage(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">{t('title')}</h1>

      <div className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">{t('fields.docType')}</label>
          <div className="flex gap-2">
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="doc" checked={docType === 'cnic'} onChange={() => setDocType('cnic')} />
              <span>{t('docTypes.cnic')}</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="doc" checked={docType === 'driving_license'} onChange={() => setDocType('driving_license')} />
              <span>{t('docTypes.drivingLicense')}</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block mb-1 font-medium">{t('fields.upload')}</label>
          <input type="file" accept="image/*" onChange={(e) => setCnic(e.target.files?.[0] ?? null)} />
        </div>

        {docType === 'driving_license' && (
          <div>
            <label className="block mb-1 font-medium">{t('fields.upload')}</label>
            <input type="file" accept="image/*" onChange={(e) => setLicense(e.target.files?.[0] ?? null)} />
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={submit} disabled={loading} className="px-4 py-2 bg-sky-600 text-white rounded">
            {loading ? tc('loading') : t('submit')}
          </button>
        </div>

        {message && <div className="text-sm text-neutral-700">{message}</div>}

        <div className="mt-6">
          <h2 className="text-lg font-semibold">{t('currentStatus.title')}</h2>
          {rowsError && <div className="text-sm text-red-600">{rowsError}</div>}
          {rows === null && <div className="text-sm text-neutral-500">{tc('loading')}</div>}
          {rows && rows.length === 0 && <div className="text-sm text-neutral-400">{t('currentStatus.empty')}</div>}
          {rows && rows.length > 0 && (
            <ul className="space-y-2 mt-2">
              {rows.map(r => (
                <li key={r.id} className="p-3 border rounded flex justify-between items-center">
                  <div>
                    <div className="text-sm text-neutral-400">{t('colWhen') ?? new Date(r.created_at).toLocaleString()}</div>
                    <div className="font-medium">{t(`status.${r.status}`) ?? r.status}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
