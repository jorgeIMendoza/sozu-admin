-- Delete the completed firma for jorge.mendoza@sozu.com (carta de cumplimiento)
DELETE FROM firmas_digitales WHERE id = 6;

-- Also clean up the cancelled firmas for the same user
DELETE FROM firmas_digitales WHERE id IN (3, 4, 5);