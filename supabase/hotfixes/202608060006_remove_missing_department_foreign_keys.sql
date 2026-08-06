-- UltimateCAD Economy schema compatibility hotfix
--
-- This file is only needed if part of the economy schema was created manually
-- before the failed transaction. The original migration uses BEGIN/COMMIT, so
-- Supabase normally rolled back the entire failed run.

do $$
begin
  if to_regclass('public.employment_records') is not null then
    alter table public.employment_records
      drop constraint if exists employment_records_department_id_fkey;
  end if;

  if to_regclass('public.payroll_runs') is not null then
    alter table public.payroll_runs
      drop constraint if exists payroll_runs_department_id_fkey;
  end if;
end
$$;
