

## Plan: Subdomain-based routing for registro.sozu.com

### Problem
When accessing `registro.sozu.com`, the app redirects to `/admin` (line in App.tsx: `<Route path="/" element={<Navigate to="/admin" replace />} />`), which triggers authentication and sends the user to login.

### Solution
Add a hostname check at the top of the `App` component. If `window.location.hostname` is `registro.sozu.com`, change the root route (`/`) to render `RegistroInmobiliaria` directly instead of redirecting to `/admin`.

### Changes

**File: `src/App.tsx`**

1. Detect the hostname at render time:
   ```typescript
   const isRegistroSubdomain = window.location.hostname === 'registro.sozu.com';
   ```

2. Change the root route conditionally:
   ```tsx
   <Route path="/" element={
     isRegistroSubdomain 
       ? <RegistroInmobiliaria /> 
       : <Navigate to="/admin" replace />
   } />
   ```

This is minimal and non-invasive. The `/registro-inmobiliaria` route remains available on all domains. The `admin.sozu.com` domain continues working exactly as before since its hostname won't match the check.

