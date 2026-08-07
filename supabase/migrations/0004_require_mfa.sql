-- TOTP doğrulamasını veritabanı seviyesinde zorunlu kıl.
--
-- Arayüzde 6 haneli kod istemek tek başına güvenlik sağlamaz: şifreyi bilen
-- biri aal1 seviyesindeki oturum jetonuyla PostgREST'e doğrudan istek atıp
-- tüm veriyi okuyabilir. Kural burada uygulanmalı.
--
-- Politika RESTRICTIVE: mevcut `*_owner` politikalarının yerine geçmez,
-- onlarla AND'lenir. Yani hem "kendi kaydın olacak" hem "aal2 olacak".
--
-- Kullanıcının doğrulanmış faktörü YOKSA aal1 kabul edilir — aksi hâlde
-- kayıt olan kimse hiçbir şey yapamaz ve TOTP kurulumuna da geçemezdi.
-- Faktör doğrulandığı anda aal2 zorunlu hâle gelir.

create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select array[(select auth.jwt() ->> 'aal')] <@ (
    select case
      when count(id) > 0 then array['aal2']
      else array['aal1', 'aal2']
    end
    from auth.mfa_factors
    where user_id = (select auth.uid()) and status = 'verified'
  );
$$;

comment on function public.mfa_satisfied is
  'Doğrulanmış TOTP faktörü olan kullanıcı için oturumun aal2 olmasını şart koşar.';

do $$
declare
  t text;
begin
  foreach t in array array[
    'mangas', 'food_entries', 'nutrition_targets', 'media_entries',
    'projects', 'project_features', 'project_notes', 'project_tasks',
    'project_activities', 'github_installations', 'github_repositories',
    'github_commits', 'github_pull_requests', 'github_issues',
    'github_workflow_runs', 'github_releases', 'github_sync_states',
    'ai_project_snapshots'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_require_mfa', t);
    execute format(
      'create policy %I on public.%I as restrictive to authenticated
         using (public.mfa_satisfied()) with check (public.mfa_satisfied())',
      t || '_require_mfa', t
    );
  end loop;
end $$;
