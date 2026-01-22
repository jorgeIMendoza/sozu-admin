-- Drop the old function version with different signature to resolve overloading conflict
DROP FUNCTION IF EXISTS get_cuentas_cobranza_paginadas(
    INTEGER, INTEGER, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER[], TEXT[], BOOLEAN, INTEGER[], INTEGER[]
);