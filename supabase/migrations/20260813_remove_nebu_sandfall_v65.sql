-- Remove Nebu Sandfall and all of its server-side progress and reward state.

drop function if exists public.claim_endless_duat_wish(uuid, uuid);
drop function if exists public.forge_endless_duat_fragment(uuid);
drop function if exists public.record_endless_duat_heartbeat(uuid, integer);

drop table if exists public.player_duat_wish_claims;
drop table if exists public.player_duat_progress;
drop table if exists public.player_duat_accounts;