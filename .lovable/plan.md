
Objetivo: permitir reenvíos manuales del aviso cuando corresponda haciendo que la clave de idempotencia cambie por corrida solo para destinatarios manuales, sin romper la protección anti-duplicado de los envíos reales a clientes.

Diagnóstico confirmado
- En `supabase/functions/evaluar-triggers-evento/index.ts`, la clave manual hoy es estable:
  `trigger:{id}:offset:{offset}:fecha:{fechaObjetivo}:manual:{email}`
- Esa clave choca contra el `UNIQUE (id_trigger, clave_entidad)` de `avisos_envios_evento`.
- Resultado: si el aviso ya se envió una vez a esos destinatarios manuales para esa fecha objetivo, cualquier corrida posterior queda bloqueada como “ya enviado”, aunque sí se quiera reenviar manualmente.
- La lógica de clientes reales usa otra clave (`acuerdo:{id}:offset:{offset}`) y esa sí debe seguir siendo estable para evitar duplicados reales.

Qué se va a cambiar
1. Usar el identificador de corrida existente como parte de la clave manual
- Aprovechar `executionId`, que ya se crea al inicio de cada corrida en `avisos_ejecuciones`.
- Construir la clave manual con ese identificador, por ejemplo:
  `trigger:{id}:offset:{offset}:fecha:{fechaObjetivo}:manual:{email}:exec:{executionId}`
- Aplicarlo únicamente en el bloque de `manualAccum` / envío consolidado manual.

2. Mantener intacta la idempotencia para clientes reales
- No modificar la clave:
  `acuerdo:{id}:offset:{offset}`
- Así se conserva la protección actual contra reenvíos accidentales al cliente final.

3. Ajustar el comportamiento del lote manual consolidado
- Al cambiar la clave por corrida, el bloque que hoy entra en:
  `ya enviado, omitiendo lote consolidado`
  dejará de dispararse por una corrida anterior.
- Cada ejecución manual podrá registrar sus propios inserts en `avisos_envios_evento` y enviar nuevamente a los destinatarios configurados.
- La consolidación del lote manual se mantiene; solo cambia la semilla de idempotencia.

4. Preservar trazabilidad clara
- Seguir registrando cada corrida en `avisos_ejecuciones`.
- Mantener el `executionId` como referencia implícita de esa corrida.
- Si conviene para auditoría futura, enriquecer `summary.details` y/o `payloadN8N` con:
  - `execution_id`
  - `clave_entidad_base` sin sufijo de corrida
  para distinguir “misma intención” vs “corrida distinta”.

Archivos a modificar
- `supabase/functions/evaluar-triggers-evento/index.ts`

Implementación propuesta
- Localizar el punto donde se arma `manualAccum.set(...)`.
- Reemplazar `claveEntidad` manual para concatenar `executionId`.
- Asegurar que `executionId` exista antes de construir destinatarios manuales; hoy ya se crea al inicio del loop por `offset`, por lo que encaja sin rediseño mayor.
- Mantener sin cambios:
  - inserciones/updates de `avisos_ejecuciones`
  - `UNIQUE` de `avisos_envios_evento`
  - claves de clientes reales
  - lógica de canal/email/WhatsApp

Impacto esperado
- Un envío manual podrá reenviarse en una corrida posterior aunque ya exista uno previo del mismo aviso/offset/fecha.
- Los avisos reales a clientes seguirán protegidos contra duplicados.
- El log mostrará nuevas ejecuciones y nuevos registros manuales por cada corrida permitida.

Base de datos
- No se requiere migración para este ajuste.
- El cambio se apoya en tablas y columnas existentes:
  - `avisos_ejecuciones.id`
  - `avisos_envios_evento.clave_entidad`

Validación posterior
- Probar una corrida manual del mismo aviso dos veces.
- Verificar que:
  1. ambas corridas generen registros nuevos en `avisos_envios_evento`,
  2. ambas aparezcan en `avisos_ejecuciones`,
  3. los envíos a clientes reales sigan omitiéndose cuando ya exista la clave estable del acuerdo.
