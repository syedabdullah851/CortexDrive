import React from 'react';
import { redirect } from 'next/navigation';
import AdminPanel from '@/modules/admin/AdminPanel';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';

export default async function AdminPage({ params }: { params: { locale: string } }){
  const t = getTranslations('Admin');
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Gate: user must be in public.admins
  if (!user) redirect(`/${params.locale}/signin`);
  const { data: admins } = await supabase.from('admins').select('user_id').eq('user_id', user.id).limit(1);
  if (!admins || admins.length===0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold">{t('adminNotAuthorized')}</h1>
        <p className="text-neutral-500 mt-2">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      {/* AdminPanel is a client component */}
      <AdminPanel/>
    </div>
  );
}
