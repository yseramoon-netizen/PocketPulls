-- Unknown Pulls account gateway verification

select
  to_regprocedure('public.check_player_username_available(text)')
    as username_check,
  to_regprocedure('public.complete_player_registration()')
    as registration_completion;

select
  public.check_player_username_available('verification_name_123')
    as username_check_callable;

notify pgrst, 'reload schema';
