
-- Fix submenus sequence first
SELECT setval(pg_get_serial_sequence('submenus', 'id'), (SELECT MAX(id) + 1 FROM submenus), false);
