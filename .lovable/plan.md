
## Disable PWA Install Prompt

### Current State
- `PWAInstallPrompt` component is rendered at the root level in `App.tsx` (line 113)
- The component displays an install prompt box at the bottom-right when the browser fires the `beforeinstallprompt` event
- `AdminHeader` doesn't currently have an install button (only Theme Toggle, Notifications, and Settings)

### Solution
Add a **feature flag** to temporarily disable the PWA install functionality while keeping the code intact for future use.

### Changes Required

**File: `src/components/PWAInstallPrompt.tsx`**
- Add a feature flag constant at the top: `const PWA_INSTALL_ENABLED = false;`
- Modify the return statement to check this flag and return `null` if disabled
- Add a clear comment explaining it's temporarily disabled

**File: `src/App.tsx`**
- Add a comment next to the `<PWAInstallPrompt />` line explaining it's disabled via feature flag

### Benefits
- ✅ Feature is disabled without removing code
- ✅ Easy to re-enable in the future (just change the flag to `true`)
- ✅ Keeps all logic intact for when it's needed again
- ✅ Clean, minimal change with clear intent

### Files to Modify
1. `src/components/PWAInstallPrompt.tsx` - Add feature flag and early return
2. `src/App.tsx` - Add explanatory comment (optional, for context)
