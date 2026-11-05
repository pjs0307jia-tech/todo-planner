create schema if not exists planner_private;
revoke all on schema planner_private from public, anon, authenticated;
grant usage on schema planner_private to service_role;

create table planner_private.pin_accounts (
  owner_hash text primary key,
  password_hash text not null,
  failed_attempts integer not null default 0,
  retry_at timestamptz
);
create table planner_private.pin_sessions (
  token_hash text primary key,
  owner_hash text not null references planner_private.pin_accounts(owner_hash) on delete cascade,
  expires_at timestamptz not null
);
alter table planner_private.pin_accounts enable row level security;
alter table planner_private.pin_sessions enable row level security;
grant select, update on planner_private.pin_accounts to service_role;
grant select, insert, delete on planner_private.pin_sessions to service_role;

create function public.planner_pin_login(p_owner_hash text, p_password text, p_token_hash text)
returns text
language plpgsql security invoker set search_path = ''
as $$
declare
  account planner_private.pin_accounts%rowtype;
  checked_at timestamptz;
  attempts integer;
begin
  if p_password is null or p_password !~ '^[0-9]{4}$'
      or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return 'invalid_credentials';
  end if;

  select * into account
    from planner_private.pin_accounts where owner_hash = p_owner_hash for update;
  if not found then return 'invalid_credentials'; end if;

  checked_at := clock_timestamp();
  if account.failed_attempts >= 5 and account.retry_at > checked_at then
    return 'too_many_attempts';
  end if;

  if extensions.crypt(p_password, account.password_hash) is distinct from account.password_hash then
    attempts := case when account.retry_at > checked_at then account.failed_attempts else 0 end;
    update planner_private.pin_accounts
      set failed_attempts = attempts + 1, retry_at = checked_at + interval '1 hour'
      where owner_hash = p_owner_hash;
    return 'invalid_credentials';
  end if;

  update planner_private.pin_accounts set failed_attempts = 0, retry_at = null
    where owner_hash = p_owner_hash;
  delete from planner_private.pin_sessions where owner_hash = p_owner_hash and expires_at <= checked_at;
  insert into planner_private.pin_sessions(token_hash, owner_hash, expires_at)
    values (p_token_hash, p_owner_hash, checked_at + interval '12 hours');
  return 'ok';
end
$$;

create function public.planner_pin_session(p_owner_hash text, p_token_hash text, p_revoke boolean)
returns boolean
language plpgsql security invoker set search_path = ''
as $$
begin
  if p_revoke then
    delete from planner_private.pin_sessions
      where owner_hash = p_owner_hash and token_hash = p_token_hash;
    return found;
  end if;
  return exists (
    select 1 from planner_private.pin_sessions
      where owner_hash = p_owner_hash and token_hash = p_token_hash and expires_at > now()
  );
end
$$;

revoke all on function public.planner_pin_login(text, text, text) from public, anon, authenticated;
revoke all on function public.planner_pin_session(text, text, boolean) from public, anon, authenticated;
grant execute on function public.planner_pin_login(text, text, text) to service_role;
grant execute on function public.planner_pin_session(text, text, boolean) to service_role;
