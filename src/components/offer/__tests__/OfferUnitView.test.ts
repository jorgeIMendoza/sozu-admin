import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import OfferUnitView from '../OfferUnitView';

const IMG = 'https://ejemplo/vistas/oriente.jpg';

describe('OfferUnitView', () => {
  it('muestra la imagen, el nombre de la vista y el disclaimer', () => {
    const html = renderToStaticMarkup(
      createElement(OfferUnitView, { imageUrl: IMG, view: 'Oriente', level: '7' }),
    );
    expect(html).toContain('Vista tentativa del departamento');
    expect(html).toContain(IMG);
    expect(html).toContain('Oriente');
    expect(html).toContain('no del nivel 7 en particular');
  });

  // 9 de las 28 vistas del catálogo no tienen archivo (todas las de Mutuo Vive).
  // El nombre de la orientación ya sale en "Datos de la propiedad", así que aquí
  // no hay nada que mostrar.
  it('no se monta sin imagen, aunque haya nombre de vista', () => {
    expect(
      renderToStaticMarkup(createElement(OfferUnitView, { view: 'Poniente', level: '3' })),
    ).toBe('');
    expect(renderToStaticMarkup(createElement(OfferUnitView, { imageUrl: '' }))).toBe('');
  });

  // El catálogo mezcla orientaciones con lugares ('Country', 'Interior'), así que
  // el texto nunca debe afirmar que el nombre es una orientación.
  it('habla de "la vista X", no de "la orientación X"', () => {
    const html = renderToStaticMarkup(
      createElement(OfferUnitView, { imageUrl: IMG, view: 'Country', level: '7' }),
    );
    expect(html).toContain('de la vista Country');
    expect(html).not.toContain('orientación Country');
  });

  it('funciona sin nombre de vista y sin nivel', () => {
    const html = renderToStaticMarkup(createElement(OfferUnitView, { imageUrl: IMG }));
    expect(html).toContain('Imagen de referencia del desarrollo');
    expect(html).not.toContain('en particular');
    expect(html).toContain('alt="Vista tentativa del departamento"');
  });

  it('describe la vista en el alt cuando se conoce', () => {
    const html = renderToStaticMarkup(
      createElement(OfferUnitView, { imageUrl: IMG, view: 'Sur' }),
    );
    expect(html).toContain('alt="Vista tentativa hacia Sur"');
  });
});
