-- UltimateCAD DMV access permissions
-- Ensures permission records exist and grants them to top-level roles.

insert into public.permissions (key,name,description,category)
values
  ('dmv.view','View DMV','View DMV applications, tests and issued licences.','DMV'),
  ('dmv.manage','Manage DMV','Approve applications and manage issued licences.','DMV')
on conflict (key) do update
set name=excluded.name,
    description=excluded.description,
    category=excluded.category;

insert into public.role_permissions(role_id,permission_key,allowed)
select r.id,p.permission_key,true
from public.roles r
join (
  values
    ('Founder','dmv.view'),
    ('Founder','dmv.manage'),
    ('Owner','dmv.view'),
    ('Owner','dmv.manage'),
    ('Community Admin','dmv.view'),
    ('Community Admin','dmv.manage'),
    ('Agency Director','dmv.view'),
    ('Department Command','dmv.view')
) as p(role_name,permission_key)
  on p.role_name=r.name
on conflict(role_id,permission_key)
do update set allowed=true;
