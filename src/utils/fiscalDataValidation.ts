/**
 * Utility functions for validating fiscal data completeness
 */

export interface FiscalData {
  rfc?: string | null;
  regimen?: string | null;
  uso_cfdi?: string | null;
  direccion_fiscal_calle?: string | null;
  direccion_fiscal_num_ext?: string | null;
  direccion_fiscal_num_int?: string | null;
  direccion_fiscal_colonia?: string | null;
  direccion_fiscal_codigo_postal?: string | null;
  direccion_fiscal_id_pais?: string | null;
  direccion_fiscal_id_estado?: number | null;
  direccion_fiscal_id_municipio?: number | null;
}

/**
 * Validates if fiscal data is complete
 */
export function isFiscalDataComplete(data: FiscalData | null | undefined): boolean {
  if (!data) return false;

  return !!(
    data.rfc &&
    data.regimen &&
    data.uso_cfdi &&
    data.direccion_fiscal_calle &&
    data.direccion_fiscal_colonia &&
    data.direccion_fiscal_codigo_postal &&
    data.direccion_fiscal_id_pais &&
    data.direccion_fiscal_id_estado &&
    data.direccion_fiscal_id_municipio
  );
}

/**
 * Validates if all compradores have complete fiscal data
 */
export function areAllCompradoresFiscalDataComplete(
  compradoresData: FiscalData[]
): { isComplete: boolean; incompleteCount: number } {
  if (!compradoresData || compradoresData.length === 0) {
    return { isComplete: false, incompleteCount: 0 };
  }

  const incompleteCount = compradoresData.filter(
    (data) => !isFiscalDataComplete(data)
  ).length;

  return {
    isComplete: incompleteCount === 0,
    incompleteCount,
  };
}
