-- UltimateCAD Banking installation check
select
  to_regclass('public.bank_accounts') as bank_accounts,
  to_regclass('public.bank_transactions') as bank_transactions,
  to_regclass('public.bank_transfer_requests') as bank_transfer_requests,
  to_regprocedure('public.create_character_bank_account(uuid,text,text)') as create_account_rpc,
  to_regprocedure('public.transfer_between_bank_accounts(uuid,text,numeric,text)') as transfer_rpc;
