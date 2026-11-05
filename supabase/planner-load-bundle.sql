create function public.planner_load_bundle(p_owner_hash text, p_token_hash text)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'state', coalesce(snapshot.state, '{}'::jsonb),
    'updated_at', snapshot.updated_at,
    'rows', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'todo_id', item.todo_id,
        'mode', item.mode,
        'todo_date', item.todo_date,
        'payload', item.payload,
        'deleted_at', item.deleted_at,
        'server_updated_at', item.server_updated_at
      )), '[]'::jsonb)
      from public.planner_todo_items as item
      where item.owner_hash = p_owner_hash
    )
  )
  from planner_private.pin_sessions as session
  left join public.planner_state as snapshot on snapshot.owner_hash = session.owner_hash
  where session.token_hash = p_token_hash
    and session.owner_hash = p_owner_hash
    and session.expires_at > now()
$$;

revoke all on function public.planner_load_bundle(text, text) from public, anon, authenticated;
grant execute on function public.planner_load_bundle(text, text) to service_role;
