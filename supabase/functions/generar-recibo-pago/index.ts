import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to convert number to words in Spanish
function convertirEntero(n: number): string {
  const unidades = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const especiales = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const decenas = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const centenas = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

  if (n === 0) return 'cero';
  if (n === 100) return 'cien';
  
  if (n < 10) return unidades[n];
  if (n < 20) return especiales[n - 10];
  if (n < 30) {
    if (n === 20) return 'veinte';
    return 'veinti' + unidades[n - 20];
  }
  if (n < 100) {
    const decena = Math.floor(n / 10);
    const unidad = n % 10;
    return decenas[decena] + (unidad > 0 ? ' y ' + unidades[unidad] : '');
  }
  if (n < 1000) {
    const centena = Math.floor(n / 100);
    const resto = n % 100;
    return centenas[centena] + (resto > 0 ? ' ' + convertirEntero(resto) : '');
  }
  if (n < 1000000) {
    const miles = Math.floor(n / 1000);
    const resto = n % 1000;
    if (miles === 1) {
      return 'mil' + (resto > 0 ? ' ' + convertirEntero(resto) : '');
    }
    return convertirEntero(miles) + ' mil' + (resto > 0 ? ' ' + convertirEntero(resto) : '');
  }
  if (n < 1000000000) {
    const millones = Math.floor(n / 1000000);
    const resto = n % 1000000;
    if (millones === 1) {
      return 'un millón' + (resto > 0 ? ' ' + convertirEntero(resto) : '');
    }
    return convertirEntero(millones) + ' millones' + (resto > 0 ? ' ' + convertirEntero(resto) : '');
  }
  return n.toString();
}

function numberToWordsWithPesos(num: number): string {
  const entero = Math.floor(num);
  const centavos = Math.round((num - entero) * 100);
  
  let resultado = convertirEntero(entero) + ' Pesos';
  if (centavos > 0) {
    resultado += ' ' + centavos.toString().padStart(2, '0') + '/100 M.N.';
  } else {
    resultado += ' 00/100 M.N.';
  }
  
  // Capitalize first letter
  return resultado.charAt(0).toUpperCase() + resultado.slice(1);
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatCuentaCobranzaId(id: number, tipo: string): string {
  const prefix = tipo === 'mantenimiento' ? 'MN' : 'CC';
  return `${prefix}-${id.toString().padStart(6, '0')}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate();
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} de ${month} de ${year}`;
}

function numberToWordsM2(num: number): string {
  const entero = Math.floor(num);
  const decimales = Math.round((num - entero) * 100);
  
  let resultado = convertirEntero(entero);
  if (decimales > 0) {
    resultado += ' punto ' + convertirEntero(decimales);
  }
  
  return resultado.charAt(0).toUpperCase() + resultado.slice(1);
}

function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    
    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pagoId } = await req.json();

    console.log('Received request with pagoId:', pagoId);

    if (!pagoId) {
      return new Response(
        JSON.stringify({ error: 'pagoId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch the payment data
    console.log('Fetching pago data...');
    const { data: pago, error: pagoError } = await supabase
      .from('pagos')
      .select('*')
      .eq('id', pagoId)
      .single();

    if (pagoError || !pago) {
      console.error('Error fetching pago:', pagoError);
      return new Response(
        JSON.stringify({ error: 'Pago not found', details: pagoError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Pago found:', { id: pago.id, monto: pago.monto, id_cuenta_cobranza: pago.id_cuenta_cobranza });

    // 2. Fetch the cuenta_cobranza
    console.log('Fetching cuenta_cobranza...');
    const { data: cuenta, error: cuentaError } = await supabase
      .from('cuentas_cobranza')
      .select('*')
      .eq('id', pago.id_cuenta_cobranza)
      .single();

    if (cuentaError || !cuenta) {
      console.error('Error fetching cuenta:', cuentaError);
      return new Response(
        JSON.stringify({ error: 'Cuenta cobranza not found', details: cuentaError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Cuenta found:', { id: cuenta.id, tipo: cuenta.tipo, id_oferta: cuenta.id_oferta, precio_final: cuenta.precio_final });

    // 3. Fetch the oferta
    console.log('Fetching oferta...');
    const { data: oferta, error: ofertaError } = await supabase
      .from('ofertas')
      .select('*')
      .eq('id', cuenta.id_oferta)
      .single();

    if (ofertaError || !oferta) {
      console.error('Error fetching oferta:', ofertaError);
      return new Response(
        JSON.stringify({ error: 'Oferta not found', details: ofertaError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Oferta found:', { id: oferta.id, id_propiedad: oferta.id_propiedad, id_producto_servicio: oferta.id_producto_servicio });

    // 4. Fetch compradores
    console.log('Fetching compradores...');
    const { data: compradores, error: compradoresError } = await supabase
      .from('compradores')
      .select(`
        id,
        es_titular,
        id_persona,
        personas:id_persona (
          id,
          nombre_legal,
          rfc,
          tipo_persona
        )
      `)
      .eq('id_oferta', oferta.id)
      .eq('activo', true);

    if (compradoresError) {
      console.error('Error fetching compradores:', compradoresError);
    }

    console.log('Compradores found:', compradores?.length || 0);

    // Get buyer info
    const titularComprador = compradores?.find((c: any) => c.es_titular) || compradores?.[0];
    const titularPersona = titularComprador?.personas;
    const nombreComprador = titularPersona?.nombre_legal || 'Sin nombre';
    const tipoPersona = titularPersona?.tipo_persona || 'fisica';
    
    // Determine title (Señor/Señora or company)
    const titulo = tipoPersona === 'moral' ? '' : 'la Señora ';

    // 5. Fetch property or product details
    let unidadNombre = '';
    let proyectoNombre = '';
    let m2Totales = 0;
    let proyectoData: any = null;

    if (oferta.id_propiedad) {
      console.log('Fetching propiedad...');
      const { data: propiedad, error: propiedadError } = await supabase
        .from('propiedades')
        .select(`
          id,
          numero_propiedad,
          numero_piso,
          m2_interiores,
          m2_exteriores,
          m2_loft,
          id_proyecto,
          id_edificio_modelo,
          proyectos:id_proyecto (
            id,
            nombre,
            url_logo,
            nombre_firmante_recibos,
            url_firma_recibos
          ),
          edificios_modelos:id_edificio_modelo (
            id,
            edificios:id_edificio (
              id,
              nombre
            )
          )
        `)
        .eq('id', oferta.id_propiedad)
        .single();

      if (!propiedadError && propiedad) {
        unidadNombre = propiedad.numero_propiedad || '';
        proyectoData = propiedad.proyectos;
        proyectoNombre = proyectoData?.nombre || '';
        
        // Calculate total m2
        const m2Int = Number(propiedad.m2_interiores) || 0;
        const m2Ext = Number(propiedad.m2_exteriores) || 0;
        const m2Loft = Number(propiedad.m2_loft) || 0;
        m2Totales = m2Int + m2Ext + m2Loft;
        
        console.log('Propiedad found:', { numero: propiedad.numero_propiedad, proyecto: proyectoNombre, m2: m2Totales });
      }
    } else if (oferta.id_producto_servicio) {
      console.log('Fetching producto...');
      const { data: producto, error: productoError } = await supabase
        .from('productos_servicios')
        .select(`
          id,
          nombre,
          m2,
          id_proyecto,
          proyectos:id_proyecto (
            id,
            nombre,
            url_logo,
            nombre_firmante_recibos,
            url_firma_recibos
          )
        `)
        .eq('id', oferta.id_producto_servicio)
        .single();

      if (!productoError && producto) {
        unidadNombre = producto.nombre || 'Producto';
        proyectoData = producto.proyectos;
        proyectoNombre = proyectoData?.nombre || '';
        m2Totales = Number(producto.m2) || 0;
        console.log('Producto found:', { nombre: producto.nombre, proyecto: proyectoNombre });
      }
    }

    // ============ Generate PDF ============
    console.log('Generating PDF with new format...');
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();

    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const margin = 60;
    const contentWidth = width - (margin * 2);
    let yPosition = height - 60;

    // Colors
    const black = rgb(0, 0, 0);
    const darkGray = rgb(0.3, 0.3, 0.3);

    // Try to load project logo (centered at top)
    if (proyectoData?.url_logo) {
      try {
        const logoResponse = await fetch(proyectoData.url_logo);
        const logoBytes = await logoResponse.arrayBuffer();
        let logoImage;
        
        if (proyectoData.url_logo.toLowerCase().includes('.png')) {
          logoImage = await pdfDoc.embedPng(logoBytes);
        } else {
          logoImage = await pdfDoc.embedJpg(logoBytes);
        }
        
        const logoHeight = 60;
        const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
        const logoX = (width - logoWidth) / 2;
        
        page.drawImage(logoImage, {
          x: logoX,
          y: yPosition - logoHeight,
          width: logoWidth,
          height: logoHeight,
        });
        yPosition -= logoHeight + 40;
      } catch (e) {
        console.error('Error loading logo:', e);
        yPosition -= 30;
      }
    } else {
      yPosition -= 30;
    }

    // ========== TITLE: RECIBO ==========
    const titleText = 'RECIBO';
    const titleWidth = helveticaBold.widthOfTextAtSize(titleText, 24);
    page.drawText(titleText, {
      x: (width - titleWidth) / 2,
      y: yPosition,
      size: 24,
      font: helveticaBold,
      color: black,
    });
    yPosition -= 50;

    // ========== BUENO POR ==========
    const montoFormateado = formatMoney(pago.monto);
    const montoEnLetras = numberToWordsWithPesos(pago.monto);
    const buenoPorText = `Bueno por: ${montoFormateado} (${montoEnLetras})`;
    
    const buenoPorLines = wrapText(buenoPorText, contentWidth, helveticaBold, 12);
    for (const line of buenoPorLines) {
      page.drawText(line, {
        x: margin,
        y: yPosition,
        size: 12,
        font: helveticaBold,
        color: black,
      });
      yPosition -= 18;
    }
    yPosition -= 15;

    // ========== MAIN PARAGRAPH ==========
    const fechaFormateada = formatDate(pago.fecha_pago);
    const precioTotal = Number(cuenta.precio_final) || 0;
    const precioTotalFormateado = formatMoney(precioTotal);
    const precioTotalEnLetras = numberToWordsWithPesos(precioTotal);
    const m2Formateado = m2Totales.toFixed(2);
    const m2EnLetras = numberToWordsM2(m2Totales);

    const mainParagraph = `Recibimos de ${titulo}${nombreComprador.toUpperCase()} la cantidad de ${montoFormateado} (${montoEnLetras}), el día ${fechaFormateada}, por concepto de depósito en garantía de cumplimiento de conformidad que tiene como objetivo la gestión para la adquisición de una unidad condominal del desarrollo inmobiliario ${proyectoNombre.toUpperCase()}, al efecto de adquirir siguiente la unidad condominal, cuyas características serán:`;

    const mainLines = wrapText(mainParagraph, contentWidth, helvetica, 11);
    for (const line of mainLines) {
      page.drawText(line, {
        x: margin,
        y: yPosition,
        size: 11,
        font: helvetica,
        color: black,
      });
      yPosition -= 16;
    }
    yPosition -= 15;

    // ========== NUMBERED LIST ==========
    const listItems = [
      `1. Unidad condominal: ${unidadNombre}`,
      `2. Metros estimados: ${m2Formateado} m² (${m2EnLetras} metros cuadrados)`,
      `3. Monto total de depósito en garantía de cumplimiento al que se compromete ${titulo}${nombreComprador.toUpperCase()}: ${precioTotalFormateado} (${precioTotalEnLetras})`
    ];

    for (const item of listItems) {
      const itemLines = wrapText(item, contentWidth - 20, helvetica, 11);
      for (let i = 0; i < itemLines.length; i++) {
        page.drawText(itemLines[i], {
          x: margin + (i === 0 ? 0 : 20),
          y: yPosition,
          size: 11,
          font: helvetica,
          color: black,
        });
        yPosition -= 16;
      }
      yPosition -= 5;
    }
    yPosition -= 15;

    // ========== LEGAL PARAGRAPHS ==========
    const legalParagraph1 = `La cantidad aquí entregada y recibida será aplicada al depósito en garantía de cumplimiento, al momento de la celebración del contrato de promesa de compraventa.`;
    
    const legal1Lines = wrapText(legalParagraph1, contentWidth, helvetica, 11);
    for (const line of legal1Lines) {
      page.drawText(line, {
        x: margin,
        y: yPosition,
        size: 11,
        font: helvetica,
        color: black,
      });
      yPosition -= 16;
    }
    yPosition -= 15;

    const legalParagraph2 = `Será obligación de la empresa mantener debidamente informado al aportante de la forma y términos en los que se lleve a cabo la gestión la adquisición de una unidad condominal del desarrollo inmobiliario ${proyectoNombre.toUpperCase()}.`;
    
    const legal2Lines = wrapText(legalParagraph2, contentWidth, helvetica, 11);
    for (const line of legal2Lines) {
      page.drawText(line, {
        x: margin,
        y: yPosition,
        size: 11,
        font: helvetica,
        color: black,
      });
      yPosition -= 16;
    }
    yPosition -= 40;

    // ========== ATENTAMENTE ==========
    page.drawText('ATENTAMENTE', {
      x: margin,
      y: yPosition,
      size: 11,
      font: helveticaBold,
      color: black,
    });
    yPosition -= 50;

    // ========== SIGNATURE SECTION ==========
    // Try to load signature/company logo
    if (proyectoData?.url_firma_recibos) {
      try {
        const firmaResponse = await fetch(proyectoData.url_firma_recibos);
        const firmaBytes = await firmaResponse.arrayBuffer();
        let firmaImage;
        
        if (proyectoData.url_firma_recibos.toLowerCase().includes('.png')) {
          firmaImage = await pdfDoc.embedPng(firmaBytes);
        } else {
          firmaImage = await pdfDoc.embedJpg(firmaBytes);
        }
        
        const firmaHeight = 40;
        const firmaWidth = (firmaImage.width / firmaImage.height) * firmaHeight;
        
        page.drawImage(firmaImage, {
          x: margin,
          y: yPosition - firmaHeight + 20,
          width: firmaWidth,
          height: firmaHeight,
        });
        yPosition -= firmaHeight + 20;
      } catch (e) {
        console.error('Error loading firma:', e);
        yPosition -= 20;
      }
    } else {
      yPosition -= 20;
    }

    // Signature line and name
    if (proyectoData?.nombre_firmante_recibos) {
      // Signature line (cursive-style representation)
      page.drawText('lf', {
        x: margin,
        y: yPosition,
        size: 14,
        font: helveticaOblique,
        color: darkGray,
      });
      yPosition -= 20;

      // Signer name
      page.drawText(proyectoData.nombre_firmante_recibos, {
        x: margin,
        y: yPosition,
        size: 11,
        font: helvetica,
        color: black,
      });
      yPosition -= 15;

      // Signer title
      page.drawText('Gerente de cobranza', {
        x: margin,
        y: yPosition,
        size: 10,
        font: helvetica,
        color: darkGray,
      });
    }

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();
    console.log('PDF generated, size:', pdfBytes.length, 'bytes');

    // Upload to Supabase Storage
    const cuentaFormateada = formatCuentaCobranzaId(cuenta.id, cuenta.tipo || 'propiedad');
    const fechaPago = new Date(pago.fecha_pago);
    const timestamp = Date.now();
    const fileName = `recibo_cuenta_${cuentaFormateada}_${fechaPago.toISOString().split('T')[0]}_${timestamp}.pdf`;
    const filePath = `recibos_temp/${fileName}`;

    console.log('Uploading PDF to storage:', filePath);
    const { error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload PDF', details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documentos')
      .getPublicUrl(filePath);

    console.log('PDF uploaded successfully:', urlData.publicUrl);

    // Schedule deletion after 1 minute
    setTimeout(async () => {
      try {
        await supabase.storage.from('documentos').remove([filePath]);
        console.log('Temporary file deleted:', filePath);
      } catch (e) {
        console.error('Error deleting temporary file:', e);
      }
    }, 60000);

    return new Response(
      JSON.stringify({
        success: true,
        url_recibo: urlData.publicUrl,
        fileName: fileName,
        expiresIn: '1 minute',
        pagoId: pago.id,
        monto: pago.monto,
        cuentaCobranzaId: cuenta.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generar-recibo-pago:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
