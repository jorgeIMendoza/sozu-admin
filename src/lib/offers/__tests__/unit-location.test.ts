import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

// FloorPlanCanvas vive en el módulo de planos del admin, que arrastra el cliente
// de Supabase (y con él los `define` de Vite, ausentes en vitest). El canvas solo
// pinta la imagen del nivel: para este render smoke basta un marcador.
vi.mock('@/components/admin/PlanosPropertyModal', () => ({
  FloorPlanCanvas: () => createElement('canvas', { 'data-testid': 'floor-plan-canvas' }),
}));

import OfferUnitLocation from '@/components/offer/OfferUnitLocation';
import {
  MAX_NIVELES_VISIBLES,
  filasEdificio,
  nivelesVisibles,
  parseNivel,
  posicionEnNivel,
  resolveTotalNiveles,
  unidadSigueConvencion,
} from '../unit-location';

describe('parseNivel', () => {
  it('lee el número de piso venga como número o como texto de BD', () => {
    expect(parseNivel(7)).toBe(7);
    expect(parseNivel('7')).toBe(7);
    expect(parseNivel(' 11 ')).toBe(11);
    expect(parseNivel('Nivel 3')).toBe(3);
  });

  // 'PB' existe en propiedades.numero_piso: Number('PB') es NaN y dibujaría un
  // edificio de NaN niveles, así que la sección no debe montarse.
  it('devuelve null cuando no hay nivel que ubicar', () => {
    expect(parseNivel('PB')).toBeNull();
    expect(parseNivel('')).toBeNull();
    expect(parseNivel(0)).toBeNull();
    expect(parseNivel(null)).toBeNull();
    expect(parseNivel(undefined)).toBeNull();
    expect(parseNivel(Number.NaN)).toBeNull();
  });
});

describe('resolveTotalNiveles', () => {
  it('usa el total del edificio cuando es coherente', () => {
    expect(resolveTotalNiveles(13, 7)).toBe(13);
    expect(resolveTotalNiveles(7, 7)).toBe(7);
  });

  it('nunca deja la unidad fuera del edificio dibujado', () => {
    expect(resolveTotalNiveles(5, 11)).toBe(11);
    expect(resolveTotalNiveles(undefined, 11)).toBe(11);
    expect(resolveTotalNiveles(null, 11)).toBe(11);
    expect(resolveTotalNiveles(Number.NaN, 11)).toBe(11);
  });
});

describe('nivelesVisibles', () => {
  it('pinta el edificio completo, de arriba abajo, cuando cabe', () => {
    expect(nivelesVisibles(3, 5)).toEqual([5, 4, 3, 2, 1]);
    expect(nivelesVisibles(8, 8)).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('recorta a una ventana y el nivel de la unidad SIEMPRE está dentro', () => {
    // DAIKU (13) y Bottura (15): los dos edificios reales con plano de nivel.
    for (const total of [13, 15, 40]) {
      for (let nivel = 1; nivel <= total; nivel++) {
        const ventana = nivelesVisibles(nivel, total);
        expect(ventana.length).toBe(MAX_NIVELES_VISIBLES);
        expect(ventana).toContain(nivel);
        // Descendente y sin huecos.
        expect(ventana[0] - ventana[ventana.length - 1]).toBe(MAX_NIVELES_VISIBLES - 1);
        expect(ventana[0]).toBeLessThanOrEqual(total);
        expect(ventana[ventana.length - 1]).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('deja aire encima de la unidad cuando el edificio lo permite', () => {
    expect(nivelesVisibles(7, 13)).toEqual([10, 9, 8, 7, 6, 5, 4, 3]);
    // Cerca de la azotea la ventana se pega al último nivel.
    expect(nivelesVisibles(13, 13)).toEqual([13, 12, 11, 10, 9, 8, 7, 6]);
    // Cerca de planta baja se pega al nivel 1.
    expect(nivelesVisibles(1, 13)).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
  });
});

describe('posicionEnNivel', () => {
  it('usa la convención nivel*100 + posición', () => {
    expect(posicionEnNivel('709', 7)).toBe(9);
    expect(posicionEnNivel('1104', 11)).toBe(4);
    expect(posicionEnNivel('111', 1)).toBe(11);
  });

  it('cae a los últimos dos dígitos cuando el número no sigue la convención', () => {
    expect(posicionEnNivel('A-1207', 3)).toBe(7);
    expect(posicionEnNivel('', 7)).toBe(1);
    expect(posicionEnNivel('sin-digitos', 7)).toBe(1);
  });

  it('nunca devuelve una posición menor a 1', () => {
    for (const unidad of ['700', '100', '0', '900']) {
      expect(posicionEnNivel(unidad, 7)).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('filasEdificio', () => {
  it('pinta azotea solo cuando la ventana llega al último nivel', () => {
    expect(filasEdificio(3, 5)[0]).toEqual({ tipo: 'azotea' });
    expect(filasEdificio(13, 13)[0]).toEqual({ tipo: 'azotea' });
    // Nivel 7 de 13: la ventana llega al 10, faltan 3 arriba.
    expect(filasEdificio(7, 13)[0]).toEqual({ tipo: 'salto', count: 3 });
  });

  it('declara los niveles que quedan fuera arriba y abajo', () => {
    const filas = filasEdificio(7, 13);
    const saltos = filas.filter((f) => f.tipo === 'salto');
    expect(saltos).toEqual([
      { tipo: 'salto', count: 3 },  // 13, 12, 11
      { tipo: 'salto', count: 2 },  // 2, 1
    ]);
    expect(filas[filas.length - 1]).toEqual({ tipo: 'planta-baja' });
  });

  it('no inventa saltos cuando el edificio cabe completo', () => {
    const filas = filasEdificio(3, 5);
    expect(filas.filter((f) => f.tipo === 'salto')).toEqual([]);
    expect(filas.map((f) => (f.tipo === 'nivel' ? f.n : f.tipo))).toEqual([
      'azotea', 5, 4, 3, 2, 1, 'planta-baja',
    ]);
  });

  // La suma tiene que cerrar o el corte estaría afirmando otra altura.
  it('los niveles mostrados + los saltos suman el total del edificio', () => {
    for (const total of [1, 5, 8, 13, 15, 26, 40]) {
      for (let nivel = 1; nivel <= total; nivel++) {
        const filas = filasEdificio(nivel, total);
        const mostrados = filas.filter((f) => f.tipo === 'nivel').length;
        const omitidos = filas.reduce((acc, f) => acc + (f.tipo === 'salto' ? f.count : 0), 0);
        expect(mostrados + omitidos).toBe(total);
        expect(filas.some((f) => f.tipo === 'nivel' && f.n === nivel)).toBe(true);
        // Planta baja siempre cierra; azotea solo si se ve la punta.
        expect(filas[filas.length - 1].tipo).toBe('planta-baja');
        expect(filas.some((f) => f.tipo === 'azotea')).toBe(total <= MAX_NIVELES_VISIBLES || nivel + 3 >= total);
      }
    }
  });
});

describe('unidadSigueConvencion', () => {
  it('acepta los números nivel*100 + posición', () => {
    expect(unidadSigueConvencion('709', 7)).toBe(true);
    expect(unidadSigueConvencion('1104', 11)).toBe(true);
    expect(unidadSigueConvencion('111', 1)).toBe(true);
  });

  // 'V-504' en el nivel 7 (VITA): la rejilla pintaría vecinos 70x que no existen
  // en ese edificio y resaltaría un '504' ajeno a la serie.
  it('rechaza los números que no encajan con su nivel', () => {
    expect(unidadSigueConvencion('V-504', 7)).toBe(false);
    expect(unidadSigueConvencion('T-801', 10)).toBe(false);
    expect(unidadSigueConvencion('', 7)).toBe(false);
    expect(unidadSigueConvencion('sin-digitos', 7)).toBe(false);
  });
});

// Render smoke en servidor: no valida pixeles (para eso hace falta navegador),
// sí que el corte del edificio se arma y que la sección respeta sus gates.
describe('OfferUnitLocation (render)', () => {
  const base = {
    unitNumber: '709',
    unitDepto: '09',
    area: '38.60 m²',
    planoUbicacionUrl: 'https://ejemplo/plano-nivel-7.webp',
    planoUbicacionRegiones: [{ unit_number: '09', polygon: [[0, 0], [10, 0], [10, 10]] }],
  };

  it('dibuja la ventana de niveles, planta baja y el resumen de la unidad', () => {
    const html = renderToStaticMarkup(
      createElement(OfferUnitLocation, { ...base, level: '7', totalPisos: 13 }),
    );
    expect(html).toContain('Ubicación de tu departamento');
    expect(html).toContain('Unidad 09 · Nivel 7 de 13 · 38.60 m²');
    expect(html).toContain('PLANTA BAJA');
    // Ventana [10..3]: el nivel 7 está, el 13 y el 2 no…
    expect(html).toContain('NIVEL 7');
    expect(html).toContain('NIVEL 10');
    expect(html).not.toContain('NIVEL 13');
    expect(html).not.toContain('NIVEL 2<');
    // …y lo que no se ve queda declarado, no escondido.
    expect(html).toContain('3 niveles');
    expect(html).toContain('2 niveles');
  });

  it('no se monta sin nivel (planta baja o piso vacío)', () => {
    expect(renderToStaticMarkup(createElement(OfferUnitLocation, { ...base, level: 'PB' }))).toBe('');
    expect(renderToStaticMarkup(createElement(OfferUnitLocation, { ...base, level: undefined }))).toBe('');
  });

  it('cae a la rejilla cuando el nivel no tiene plano y los vecinos existen', () => {
    const html = renderToStaticMarkup(
      createElement(OfferUnitLocation, {
        level: '7',
        totalPisos: 13,
        unitNumber: '709',
        unitDepto: '09',
        area: '38.60 m²',
      }),
    );
    expect(html).toContain('Orden de las unidades del nivel');
    // Serie completa y coherente: la resaltada también usa nivel*100 + posición.
    expect(html).toContain('>701<');
    expect(html).toContain('>709<');
    expect(html).not.toContain('>09<');
  });

  it('no dibuja rejilla cuando el número de unidad no encaja con su nivel', () => {
    const html = renderToStaticMarkup(
      createElement(OfferUnitLocation, {
        level: '7',
        totalPisos: 26,
        unitNumber: 'V-504',
        unitDepto: '504',
        area: '99.72 m²',
      }),
    );
    expect(html).toContain('Este nivel aún no tiene plano cargado');
    expect(html).not.toContain('>701<');
    expect(html).not.toContain('>708<');
  });

  it('omite el "de N" cuando el edificio no reporta total de niveles', () => {
    const html = renderToStaticMarkup(
      createElement(OfferUnitLocation, { ...base, level: '7', totalPisos: undefined }),
    );
    expect(html).toContain('Unidad 09 · Nivel 7 · 38.60 m²');
    expect(html).not.toContain('Nivel 7 de');
  });
});
