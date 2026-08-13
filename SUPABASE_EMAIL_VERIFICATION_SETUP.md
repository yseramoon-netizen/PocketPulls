# Supabase email verification setup

The code fix prevents the deployed app from generating a localhost callback,
but the hosted Supabase project must also allow the deployed URL.

## 1. Set the Vercel production URL

In **Vercel > Project > Settings > Environment Variables**, add:

```text
NEXT_PUBLIC_SITE_URL=https://YOUR-PRODUCTION-DOMAIN
```

Apply it to **Production**, then redeploy the project. If the variable already
exists and contains `http://localhost:3000`, replace it.

## 2. Set the Supabase URL configuration

In **Supabase > Authentication > URL Configuration**:

- Set **Site URL** to `https://YOUR-PRODUCTION-DOMAIN`.
- Add `https://YOUR-PRODUCTION-DOMAIN/auth/callback` to **Redirect URLs**.
- Add `https://YOUR-PRODUCTION-DOMAIN/update-password` to **Redirect URLs**.
- Keep `http://localhost:3000/auth/callback` and
  `http://localhost:3000/update-password` only if local testing is still needed.

If Vercel preview deployments also need working emails, add the preview URL
pattern recommended by Supabase for your Vercel team, such as:

```text
https://*-YOUR-VERCEL-TEAM-SLUG.vercel.app/**
```

## 3. Update the hosted confirmation email template

In **Supabase > Authentication > Email Templates > Confirm signup**, replace
the existing button link with:

```html
<a href="{{ .ConfirmationURL }}">Confirm email address</a>
```

The full replacement template is included at:

```text
supabase/email-templates/confirm-signup.html
```

Copy that file's contents into the Supabase template editor if templates are
managed manually in the dashboard.

## 4. Test with a fresh link

Old confirmation emails keep the old localhost URL. Create a new test account
or use **Resend confirmation email** on the check-email page after updating the
settings and redeploying.
