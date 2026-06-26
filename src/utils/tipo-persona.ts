export type TipoPersonaNorm = 'pf' | 'pm' | 'pe';
export type TipoComprador = 'PERSONA_FISICA' | 'PERSONA_MORAL' | 'COPROPIEDAD' | 'EXTRANJERO';

/** Maps any stored variant to canonical 'pf' | 'pm' | 'pe'. Unknown/null defaults to 'pf'. */
export function normalizeTipoPersona(raw: string | null | undefined): TipoPersonaNorm {
  if (!raw) return 'pf';
  const v = raw.toLowerCase().trim();
  if (v === 'pm' || v === 'moral' || v === 'persona_moral' || v === 'persona moral') return 'pm';
  if (
    v === 'pe' ||
    v === 'extranjera' ||
    v === 'extranjero' ||
    v === 'persona_extranjera' ||
    v === 'persona extranjera'
  )
    return 'pe';
  // 'pf', 'fisica', 'física', 'persona_fisica', 'persona física', or anything else → pf
  return 'pf';
}

const LABELS: Record<TipoPersonaNorm, string> = {
  pf: 'Persona física',
  pm: 'Persona moral',
  pe: 'Persona extranjera',
};

export function getTipoPersonaLabel(raw: string | null | undefined): string {
  return LABELS[normalizeTipoPersona(raw)];
}

export function deriveTipoComprador(
  compradores: Array<{ tipo_persona?: string | null; id_pais_nacimiento?: string | null }>,
): TipoComprador {
  if (compradores.length > 1) return 'COPROPIEDAD';
  const p = compradores[0];
  if (!p) return 'PERSONA_FISICA';
  if (p.id_pais_nacimiento && p.id_pais_nacimiento !== 'MX') return 'EXTRANJERO';
  const norm = normalizeTipoPersona(p.tipo_persona);
  if (norm === 'pe') return 'EXTRANJERO';
  if (norm === 'pm') return 'PERSONA_MORAL';
  return 'PERSONA_FISICA';
}
