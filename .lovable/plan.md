

# Plan: Alta completa del antecedente histórico — Depto 708 (Mauricio López Rebollar)

## Operaciones de datos (INSERT/UPDATE via insert tool, sin cambios de schema)

### Paso 1: Crear oferta
```sql
INSERT INTO ofertas (id_persona_lead, id_propiedad, fecha_generacion, activo, email_creador, id_estatus_aprobacion)
VALUES (1431, 4942, '2021-11-11', false, 'jorge.mendoza@sozu.com', 1);
```

### Paso 2: Crear cuenta de cobranza (ya cancelada)
Con la oferta del paso 1:
```sql
INSERT INTO cuentas_cobranza (id_oferta, precio_final, fecha_compra, activo, id_propiedad, id_tipo_cancelacion, monto_cobro_cancelacion, url_evidencia_cancelacion)
VALUES (<oferta_id>, 2996833.85, '2021-11-11', false, 4942, 3, 259774.47, '<url_convenio_terminacion>');
```
- `monto_cobro_cancelacion = 259,774.47` (penalidad del 8.67%)
- `url_evidencia_cancelacion` = URL del convenio de terminación (pendiente que el usuario suba el archivo)

### Paso 3: Crear 21 acuerdos de pago
| Orden | Concepto (id) | Monto | Fecha | pago_completado |
|-------|--------------|-------|-------|-----------------|
| 1 | 1 (Apartado) | 20,000.00 | 2021-11-11 | true |
| 2 | 2 (Enganche) | 429,525.08 | 2021-11-29 | true |
| 3 | 5 (Parcialidad) | 24,973.62 | 2021-12-29 | true |
| 4 | 5 | 24,973.62 | 2022-01-29 | true |
| 5-20 | 5 | 24,937.62 c/u | 2022-02-28 a 2023-05-29 (mensual) | true |
| 21 | 3 (Contra entrega) | 2,097,783.69 | 2023-06-29 | false |

### Paso 4: Registrar 20 pagos con evidencia
Cada pago usa `url_recibo` con el link del Excel. Método de pago: Transferencia bancaria (5) o STP (6) según el Excel.

| Fecha | Monto | Método | url_recibo |
|-------|-------|--------|------------|
| 2021-11-11 | 20,000.00 | 5 (Transf) | https://api.sozu.com/storage/uploads/1713639246w80p...pdf |
| 2021-11-29 | 429,525.08 | 5 (Transf) | https://api.sozu.com/storage/uploads/17136397265Ef7...pdf |
| 2021-12-09 | 24,973.62 | 5 (Transf) | https://api.sozu.com/storage/uploads/1713640366uuv...pdf |
| 2022-01-06 | 24,973.62 | 5 (Transf) | https://api.sozu.com/storage/uploads/1713640905JcA...pdf |
| 2022-02-09 | 24,937.62 | 5 (Transf) | https://api.sozu.com/storage/uploads/1713641475r4l...pdf |
| 2022-03-08 | 24,937.62 | 5 (Transf) | https://api.sozu.com/storage/uploads/1713642384ehN...pdf |
| 2022-04-09 | 24,937.62 | 6 (STP) | https://api.sozu.com/storage/uploads/1713803968y3O...pdf |
| 2022-05-09 | 24,937.62 | 5 (Transf) | https://api.sozu.com/storage/uploads/1713804267C6J...pdf |
| 2022-06-08 | 24,937.62 | 6 (STP) | https://api.sozu.com/storage/uploads/MBAN010022060...pdf |
| 2022-07-10 | 24,937.62 | 6 (STP) | https://api.sozu.com/storage/uploads/1713804555Swr...pdf |
| 2022-08-09 | 24,937.62 | 6 (STP) | https://api.sozu.com/storage/uploads/MBAN010022080...pdf |
| 2022-09-06 | 24,937.62 | 6 (STP) | https://api.sozu.com/storage/uploads/MBAN010022090...pdf |
| 2022-10-11 | 24,937.62 | 6 (STP) | https://api.sozu.com/storage/uploads/MBAN010022101...pdf |
| 2022-11-10 | 24,937.62 | 6 (STP) | https://api.sozu.com/storage/uploads/1713804800ZAr...pdf |
| 2022-12-09 | 24,937.62 | 6 (STP) | https://api.sozu.com/storage/uploads/MBAN010022120...pdf |
| 2023-01-06 | 24,937.62 | 6 (STP) | https://api.sozu.com/storage/uploads/1713805077RoM...pdf |
| 2023-02-09 | 24,937.62 | 6 (STP) | https://api.sozu.com/storage/uploads/MBAN010023020...pdf |
| 2023-03-09 | 24,937.62 | 6 (STP) | https://api.sozu.com/storage/uploads/MBAN010023030...pdf |
| 2023-04-09 | 24,937.62 | 6 (STP) | https://api.sozu.com/storage/uploads/1713805334yyl...pdf |
| 2023-05-09 | 24,937.62 | 6 (STP) | https://api.sozu.com/storage/uploads/MBAN010023050...pdf |

Total: **$898,474.24**

### Paso 5: Crear aplicaciones de pago
Vincular cada pago al acuerdo correspondiente (en orden: pago 1→acuerdo 1, pago 2→acuerdo 2, etc.).

### Paso 6: Cancelar cuentas de productos
```sql
UPDATE cuentas_cobranza SET activo = false, id_tipo_cancelacion = 3 WHERE id IN (1165, 1166);
UPDATE ofertas SET activo = false WHERE id IN (1247, 1248);
```

### Paso 7: Actualizar estatus de Mauricio
```sql
UPDATE entidades_relacionadas SET id_tipo_entidad = 2 WHERE id = 2132;
```

### Paso 8: Documentos
Subir los 5 archivos al bucket `documentos` en Supabase Storage (ruta: `mauricio_1431/`):
- `708_INE.pdf`
- `708_Acta_de_Nacimiento.pdf`
- `708_Contrato.pdf`
- `708_Convenio_Terminacion.pdf`
- `708_Acuse_Cheque.pdf`

Luego actualizar docs existentes y crear nuevos registros vinculados a la nueva CC:
- Doc 2552 (INE): actualizar URL
- Doc 2549 (Acta): actualizar URL
- Nuevo: Contrato firmado (tipo 42), vinculado a nueva CC
- Nuevo: Convenio terminación (tipo 39), vinculado a nueva CC
- Nuevo: Cheque reembolso (tipo 31), vinculado a nueva CC
- Usar la URL del convenio como `url_evidencia_cancelacion` en la CC

## Resultado esperado
- CC cancelada de Mauricio con 20 pagos ($898,474.24), penalidad $259,774.47, devolución $898,474.24
- Historial de propietarios del 708 mostrará a Mauricio como propietario anterior
- Productos (CC 1165, 1166) cancelados
- Documentos vinculados al expediente

