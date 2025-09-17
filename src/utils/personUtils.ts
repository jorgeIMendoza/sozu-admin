import { supabase } from "@/integrations/supabase/client";

interface TempBankAccount {
  tempId: string;
  id_banco: string;
  numero_cuenta: string;
  cuenta_clabe: string;
  cuenta_swift: string;
  url_evidencia: string;
  es_cuenta_fisica_para_stp: boolean;
}

interface TempBeneficiary {
  tempId: string;
  nombre_beneficiario: string;
  email: string;
  telefono: string;
  id_parentesco: string;
  porcentaje_participacion: string;
}

/**
 * Saves temporary bank accounts to the database after person creation
 */
export async function saveTempBankAccounts(personId: number, tempBankAccounts: TempBankAccount[]) {
  if (!tempBankAccounts || tempBankAccounts.length === 0) {
    return;
  }

  const bankAccountsToInsert = tempBankAccounts.map((account) => ({
    id_persona: personId,
    id_banco: parseInt(account.id_banco),
    numero_cuenta: account.numero_cuenta,
    cuenta_clabe: account.cuenta_clabe || null,
    cuenta_swift: account.cuenta_swift || null,
    url_evidencia: account.url_evidencia || null,
    es_cuenta_fisica_para_stp: account.es_cuenta_fisica_para_stp,
    activo: true
  }));

  const { error } = await supabase
    .from('cuentas_bancarias')
    .insert(bankAccountsToInsert);
  
  if (error) throw error;
}

/**
 * Saves temporary beneficiaries to the database after person creation
 */
export async function saveTempBeneficiaries(personId: number, tempBeneficiaries: TempBeneficiary[]) {
  if (!tempBeneficiaries || tempBeneficiaries.length === 0) {
    return;
  }

  const beneficiariesToInsert = tempBeneficiaries.map((beneficiary) => ({
    id_persona: personId,
    nombre_beneficiario: beneficiary.nombre_beneficiario,
    email: beneficiary.email || null,
    telefono: beneficiary.telefono || null,
    id_parentesco: parseInt(beneficiary.id_parentesco),
    porcentaje_participacion: parseFloat(beneficiary.porcentaje_participacion),
    activo: true
  }));

  const { error } = await supabase
    .from('beneficiarios')
    .insert(beneficiariesToInsert);
  
  if (error) throw error;
}

/**
 * Handles both bank accounts and beneficiaries saving after person creation
 */
export async function saveTempPersonData(
  personId: number, 
  tempBankAccounts?: TempBankAccount[], 
  tempBeneficiaries?: TempBeneficiary[]
) {
  // Save both types of data concurrently
  await Promise.all([
    saveTempBankAccounts(personId, tempBankAccounts || []),
    saveTempBeneficiaries(personId, tempBeneficiaries || [])
  ]);
}