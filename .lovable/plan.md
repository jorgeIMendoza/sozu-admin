
# Fix: Routing en agentes.sozu.com

## Problema
1. `agentes.sozu.com/` redirige a `/auth/login` en lugar de mostrar la landing
2. `agentes.sozu.com/agentes` muestra 404

## Causa raiz
El routing actual solo maneja la ruta `/` para el subdominio de agentes. Todas las demas rutas (como `/auth/login`, `/agentes`, etc.) siguen el flujo normal de la app, lo cual causa redirecciones no deseadas.

## Solucion

### Cambio en `src/App.tsx`

Cuando el hostname es `agentes.sozu.com`, renderizar un set de rutas completamente separado que SOLO muestre la landing page para cualquier ruta:

```text
Si isAgentesSubdomain:
  /           -> AgentesLanding
  /auth/login -> AgentesLanding  (en vez de mostrar login)
  *           -> AgentesLanding  (cualquier otra ruta)

Si NO es agentes subdomain:
  (routing actual sin cambios)
```

Esto se logra envolviendo las `<Routes>` en un condicional:

```tsx
{isAgentesSubdomain ? (
  <Routes>
    <Route path="*" element={<AgentesLanding />} />
  </Routes>
) : (
  <Routes>
    {/* ...todas las rutas existentes sin cambios... */}
  </Routes>
)}
```

Con un solo `<Route path="*">` se captura cualquier ruta en el subdominio de agentes y siempre muestra la landing.

### DNS
Para configurar `agentes.sozu.com`:
- Agregar un **A record** apuntando a `185.158.133.1`
- Agregar el **TXT record** de verificacion que Lovable te indique
- **NO marcar** este dominio como "Primary" en Lovable (para que no redirija a otro dominio)

## Archivos a modificar
- `src/App.tsx` - Separar rutas por subdominio
