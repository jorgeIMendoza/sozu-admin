

## Changes

### 1. `src/App.tsx` - Add `inmobiliarias.sozu.com` subdomain check

Update the hostname detection to also recognize `inmobiliarias.sozu.com`. When the hostname is `inmobiliarias.sozu.com`, the root route (`/`) should redirect to `/auth/login` (same behavior as `admin.sozu.com`).

```typescript
const isRegistroSubdomain = window.location.hostname === 'registro.sozu.com';
const isInmobiliariasSubdomain = window.location.hostname === 'inmobiliarias.sozu.com';
```

No route change needed for `inmobiliarias.sozu.com` since the default behavior already redirects `/` to `/admin` which goes to login. It will work as-is.

### 2. `src/pages/public/RegistroInmobiliaria.tsx` - Two changes

**a) Remove the "Ya tienes cuenta?" link** (around line 230-235):
Delete the entire `<div className="text-center pt-2">` block containing the "Ya tienes cuenta? Inicia sesion" link.

**b) Update the success screen redirect**: Change the "Volver al inicio de sesion" link in the success screen (around line 145) from `/auth/login` to the absolute URL `https://inmobiliarias.sozu.com/auth/login`:

```tsx
<a href="https://inmobiliarias.sozu.com/auth/login">
  <Button variant="outline">
    <ArrowLeft className="w-4 h-4 mr-2" />
    Volver al inicio de sesión
  </Button>
</a>
```

This uses an `<a>` tag instead of React Router's `<Link>` since it navigates to a different subdomain.

### Summary
- The "Ya tienes cuenta?" link is removed from the registration form
- After successful registration, the button redirects to `inmobiliarias.sozu.com/auth/login`
- `inmobiliarias.sozu.com` works like `admin.sozu.com` (redirects to login) with no code changes needed since the default routing already handles it

