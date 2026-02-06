

# Plan: Corregir Estatus Masivo de Propiedades de Margot

## Resumen

Se identificaron **177 propiedades** en el proyecto Margot que estan en estatus "Vendido" (5) pero ya estan completamente pagadas. Se dividen en dos grupos segun la presencia de documentos de entrega verificados.

---

## Grupo 1: Mover a Entregado (estatus 8) -- 45 propiedades

Estas propiedades cumplen TODAS las condiciones:
- Completamente pagadas (saldo <= $0.01)
- Datos de escritura completos (numero, fecha, notario)
- 8 o mas documentos de entrega verificados (categoria 7)

### Las 22 propiedades originales
201, 215, 305, 401, 406, 409, 414, 417, 513, 616, 704, 714, 904, 1013, 1017, 1115, 1203, 1220, 1607, 1613, 1715, 1719

### 23 propiedades adicionales que tambien cumplen todas las condiciones
504, 505, 511, 606, 614, 703, 801, 909, 1001, 1002, 1004, 1012, 1105, 1106, 1112, 1114, 1120, 1207, 1211, 1405, 1409, 1608, 1707

### ADVERTENCIA IMPORTANTE
Normalmente la transicion a estatus 8 (Entregado) se hace a traves de un webhook de N8N que:
1. Actualiza el estatus de la propiedad
2. Genera una cuenta de cobranza de mantenimiento
3. Crea una CLABE STP para mantenimiento

Al hacer la actualizacion directa en la base de datos, estas 45 propiedades NO tendran cuentas de mantenimiento generadas automaticamente. Si necesitan cuentas de mantenimiento, se tendrian que generar por separado despues.

---

## Grupo 2: Mover a Escrituracion (estatus 7) -- 132 propiedades

Estas propiedades estan completamente pagadas pero NO tienen los documentos de entrega completos. Se mueven de Vendido (5) a Escrituracion (7).

Son las 155 propiedades restantes MENOS las 23 adicionales del Grupo 1 = 132 propiedades.

---

## Seccion Tecnica

### Migracion 1: Actualizar 45 propiedades a Entregado (8)

```sql
UPDATE propiedades
SET id_estatus_disponibilidad = 8,
    fecha_actualizacion = NOW()
WHERE id IN (
  -- 22 originales
  5130, 4853, 4862, 4877, 4882, 4885, 4889, 4892,
  4906, 4928, 4935, 4953, 5096, 5044, 5049, 4941,
  4952, 5149, 5081, 5088, 5133, 5137,
  -- 23 adicionales
  4897, 4898, 4904, 4918, 4926, 4934, 4962, 5108,
  5020, 5022, 5026, 5042, 5061, 5127, 4932, 4939,
  5148, 4961, 4969, 5009, 5017, 5082, 5109
)
AND id_estatus_disponibilidad = 5
AND activo = true;
```

### Migracion 2: Actualizar 132 propiedades a Escrituracion (7)

```sql
UPDATE propiedades
SET id_estatus_disponibilidad = 7,
    fecha_actualizacion = NOW()
WHERE id IN (
  -- Todas las fully-paid menos las 45 de Entregado
  4842, 4844, 4845, 4849, 4850, 4852, 4854, 4855,
  4856, 4861, 4863, 4864, 4866, 4867, 4868, 4869,
  4870, 4873, 4874, 4878, 4879, 4881, 4883, 4886,
  4888, 4891, 4894, 4895, 4901, 4907, 4909, 4910,
  4911, 4912, 4914, 4917, 4921, 4922, 4925, 4929,
  4930, 4931, 4933, 4936, 4937, 4940, 4942, 4943,
  4944, 4945, 4946, 4947, 4948, 4950, 4951, 4954,
  4955, 4956, 4957, 4958, 4959, 4960, 4963, 4965,
  4968, 4970, 4972, 4982, 4984, 4988, 4992, 4998,
  4999, 5003, 5005, 5006, 5008, 5011, 5014, 5017,
  5019, 5021, 5024, 5028, 5029, 5032, 5034, 5037,
  5039, 5040, 5041, 5045, 5046, 5050, 5051, 5054,
  5056, 5057, 5058, 5063, 5064, 5065, 5069, 5072,
  5074, 5077, 5079, 5087, 5089, 5090, 5091, 5092,
  5093, 5102, 5107, 5111, 5114, 5117, 5118, 5122,
  5126, 5129, 5131, 5132, 5135, 5140, 5141, 5143,
  5152, 5153, 5154, 5157, 5158
)
AND id_estatus_disponibilidad = 5
AND activo = true;
```

Ambas migraciones incluyen la condicion de seguridad `AND id_estatus_disponibilidad = 5` para no afectar propiedades que ya hayan cambiado de estatus por otro proceso.

No se requieren cambios en el frontend. El `PropertyProgressTimeline.tsx` ya interpreta correctamente los estatus 7 y 8.

