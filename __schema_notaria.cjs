const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:35b530e3b308babfa9605df6fb7492bd@45.232.252.100:5433/postgres' });
client.connect().then(async () => {
  // 1. Columns of usuarios table
  const u = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' ORDER BY ordinal_position`);
  console.log('USUARIOS:', u.rows.map(r=>r.column_name+'('+r.data_type+')'));

  // 2. Definition of get_current_user_profile function
  const fn = await client.query(`SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname='get_current_user_profile'`);
  console.log('FUNC:', fn.rows.map(r=>r.def));

  // 3. notarios table - do any have email matching known users?
  const n = await client.query(`SELECT id, nombre, notaria, email FROM public.notarios WHERE activo=true LIMIT 10`);
  console.log('NOTARIOS:', n.rows);

  // 4. Check if usuarios has any id_notario or similar column
  const link = await client.query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_name LIKE '%notari%' ORDER BY table_name`);
  console.log('NOTARI COLS:', link.rows);

  // 5. Check cuentas_cobranza with id_notario values
  const cc = await client.query(`SELECT id_notario, COUNT(*) as cnt FROM public.cuentas_cobranza WHERE id_notario IS NOT NULL AND activo=true GROUP BY id_notario ORDER BY cnt DESC LIMIT 10`);
  console.log('CUENTAS BY NOTARIO:', cc.rows);

  // 6. Get roles list
  const roles = await client.query(`SELECT id, nombre FROM public.roles ORDER BY id`);
  console.log('ROLES:', roles.rows);

  await client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
