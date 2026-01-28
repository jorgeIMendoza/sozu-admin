import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========== BASE64 ENCODED ICONS ==========
// These are the property feature icons encoded as base64 PNG
const ICONS_BASE64 = {
  recamaras: 'iVBORw0KGgoAAAANSUhEUgAAAFoAAABGCAYAAABw7wG9AAAACXBIWXMAAAsTAAALEwEAmpwYAAADp0lEQVR4nO2cz2sTQRTHv5tuNhhjQkUEFRQPehFRPIj/gH+A/4Dg0YtX8SJeBT2IB0E8iAcvXrzpRT2IB/FgWqMhP5om3SS7O+5kd7OzO5PMvtmZd3i/S9hJ8t6n03nzzptNAIIgCIIgCIIgCIIgCIIgiJjIbPsJpjQNRVOmzDT/LqM+f4+cV24s2P1r0CbbH3L2hLjFbrsJrNmW+xNbJrpR5J8ckWKKvD7LHqWx/B+n3LT7k5h1OFQVbbk/seXiJyLuixPdAJZ9Q87iR1yy+5OIbddiT/6wt31VRN0Y9eWPeGX3Jy5bE+2Kz8tT/K4L+9+w3rF91X6N1TvlDN8P1G3Zp+0/Rz2fHxH3pPyGbYD/D+s1lgv8N6x/RD2fHxH3pPwm9ir+NNbqXFbv+B+S/dv/idVai/cS/ySUK/o3+P9Y7zcf7u4ZMnv8X9Z7NZbqHDrIf8h6u/xfrFdq7+BF/FOuWO+3H+y+mSn+XdZ7LZbqLLjPfw7rPfIftl6svYMd8k+x3i4/xNqtxXuJ/xfKAf4j1rvld/H31nswk/wHrLfJf8B6qfYS/xCUy/pPuGq9V34Xfw+Nk38v6+3yH7BeqL3Ef4ZyWf85V6z3yu/Bd8b4P8B6W/I/sB6vvYA/B8ql/Ee4bL1XfpfNY/yfZb1V/gPW8yVJrZP4x1wu5T/GJesJ+V18a4z/E6w3yf+H9VjZMRNdsF7k/4py0P+MRDV+bxJLHJLfg8sZ+T/DelPyPxHjEv4xL1nvy/fhdmP8n2C9Sf5f1mNlx0x8xXqR/2vKIf8zL9HEN34jiYWiOqF0FBf8i5gO+J95iaZMYrmITii/i8UB/zMv0ZR5LBfRCeWJWCz4P/Ei/X5i+feMf0Fxvv5N+r3E8nf5b5n42u8llr/Kf8HEZ34PsfxN/gXeJn2/+WD3jOX/8X9g4iu/Syyf5L9i4ju/S7vKSZKc/x3FkP+ey6Z8n/RffuJ9v/lQ9xzL/+G/JuKW/3/L/R/+G5JH+X+w/i/fuxKN+c+4/F/+Aw/+9xK9+V+5/B/+Aw++K9GN+S+5/F/+Awe+u+jF/BOu/4f/gIPvQnRj/jPXu+T/YOK7Ed2Yf8z17vn/mPheRDfmv3C9a/5fJr4L0Y35b1zvnn/Die9CdGP+Ide74P/ncu//+P3E+/8/Lv/vt7j/dxL7+D3E/v7fLu73m2X3+u0WuuD/+/4vLvDfsPwvbtj/v+P++z+4wH/O8v9YrLG74r//+8v//T9c4b9k+R9c4f9k+X9c4X/n8u/Z/78r/o8s/5cLNLawpf+Rua9Z/x0XYOX/5QYN/59b2N/fctV2Nrf/D/8O/wUU3Fj9dwAAAABJRU5ErkJggg==',
  banos: 'iVBORw0KGgoAAAANSUhEUgAAAEoAAABKCAYAAAAc0MJxAAAACXBIWXMAAAsTAAALEwEAmpwYAAACsklEQVR4nO2cz0sUURzAv7uzM2v+iIhAopI6RNARQ+ga9Ad0jc5dxXPnrp6j/4P+g/AQFAQVQQfRQ9elQ0RQ/oLMH7u6O7uzO9NMO+vu7szO7Mz35r0PP/iyM/P9fpn3fd/3TQEAAAAAAAAAAAAAAAAAAAAAAMB/TV3xH/gXMI3nIfqSbTBXvEdeJFOxX+BfwDTeBOiLNoC54l/yIpmp/cJ/gdN4YqMO1IdsmXKB04ATeDqjPmYLXJlyidNgE3g6pj5mE3dZjvKUJnAcT2bUB20Fa8lRntIETuDJDPqwLRFJlqc0gZN4Mq0+bItEk+UpTeDEnsqgD9wC8Wh5ShPY8lRS/fCtYEeSpzSBrV4lJeRDt4AWOx1R/D7pD9sCtEg+mDSBJ7dFKr5IgR8RHSWcwHE8kcqPiI8UTuD4oZFCH9E/4gzglxb2OYoQ/aPZU/hLnAH83MIyRyFinxM/hT/GGOCP1kqO/EhxBvCDL8WS7E+cAfxoLRnyo8YZwI/WktFP/J/iBOBXa6nknc/sR3EA8Ks1+fFhzq7iAODH9nKgH8X1igOAH9srVP8hPOkMgB87S8ofbr4B/Gi9mO+Ht97ig+oA4MfuYqEfz34D/Nh+PdYPaT4D/NheNd+Pab4D/NhdzPejm18BP7aXI/xg59fAj+3l4/4YcA74sb28+kfBeQP4sb1C+EeaeeEH1cvLf9ScN34L/NhdIfyD5u3Aj92V1D/wfsIP8GMH5fwfzDPAj/3l5h8S+5fAj/2V1z+qfAt+7K/S/lHjS+DH/ir+7kfMN+DHAar1j7hfAz8O0Kr/lPqz4McB/ugnNMi/6z74sb+G9I84t4IfBxjBPzzeBH4coAX9A/PD4McKWq/9BfxYQkM/4MceWlb/wPw4+HGA1vAPt7+CH2toLf5h9nPwYxUNsR9jvgZ/2/xf+g+6oAO/bvs4bQAAAABJRU5ErkJggg==',
  mediosBanos: 'iVBORw0KGgoAAAANSUhEUgAAAEoAAABKCAYAAAAc0MJxAAAACXBIWXMAAAsTAAALEwEAmpwYAAACMklEQVR4nO2bz07CQBDGv9oWsIIQQE+e9OjZs29gfAKf0DfxCbwaPRo9ePfgyYO3kvhPQSoU2m4dYktpaTu7zMx2fhd++fIluzuzOwMQBEEQBEEQBEEQBEEQBPHfaen/wL8B0/C/En/BbvFfeJFsRd6AdwOm4f4gvuA0+C++JFtR7oF/A6bhfK/OEL/gbvJx/CW+I1NxvsC/AdNwXoKT+Fe+IlNx3kD2A6bhvARH8S/xDJmK8wayHzAN5wP4gn+Bp8hUnA+Q/YBpOB/AA/wJPEGm4nyB7AdMw/kCnuDP4AkyFecTZD9gGs43cAd/Bs+QqTjfIPsB03BeggP4U0xBpuJ8hOwHTMN5C47g32Au/gYRwQ/IPsA03HfgCO4ZfgYhwE/IPkCt4LzL/3xfEAL8hPwPqBWcJ/mf7xshwE/I/4Bawflpkv/5vhEC/IT8D6gVnC/B+ZvvGyHAT8j/gFrB+Vqc3/m+EQL8hPwPqBWcr8H5ne8bIcBPyP+AWsH5Wpzf+b4RAvyE/A+oFZyvwfmd7xshwE/I/4BawflanN/5vhEC/IT8D6gVnK/F+Z3vGyHAT8j/gFrB+Vqc3/m+EQL8hPwPqBWcr8H5ne8bIcBPyP+AWsH5Wpyv+b4RAvyE/A+oFZyvwfmS7xshwE/I/4Bawfma70/xR8h/gVrBeZIfevNDhAC/If8HagXnS36I8EME/wfU6f+B5P+hK/4L/h+oE/8PIeAfwP+BOnE/If8HDfI/ELn9Bx3kU3hrZCbCAAAAAElFTkSuQmCC',
  estacionamiento: 'iVBORw0KGgoAAAANSUhEUgAAAFoAAABaCAYAAAA4qEECAAAACXBIWXMAAAsTAAALEwEAmpwYAAACG0lEQVR4nO3dQU7CQBSA4b+xujAuPYArT+BxPIjewIMoehFXXsGVGxei7mADJiQkzGuZmXbmfQkrSMr8tJ1OSwciIiIiIiIiIiIiIiIyKZvJX+B/otL+E9QPdq2fi3/VR5L1r36C+sF+dfv8XPy7PpJ8QfUT1A/2q/3z8/Dv+khy+dVPUD/Yr/bPL8W/6yPJ51f/C/WD/er++a/4d30k+fvVT1A/2K/un/8S/66PJH+/+l+oH+xX98/Pxb/rI8nfr36C+sF+df/8XPy7PpL8/eonqB/sV/fPf8W/6yPJ36/+F+oH+9X987Px7/pI8ver/4X6wX51//xc/Ls+kvz96ieoH+xX989/xb/rI8nfr/4X6gf71f3zs/Hv+kjy96ufoH6wX90//xX/ro8kf7/6X6gf7Ff3z8/Gv+sjyd+vfoL6wX51//xX/Ls+kvz96n+hfrBf3T8/G/+ujyR/v/oJ6gf71f3zX/Hv+kjy96v/hfrBfnX//Gz8uz6S/P3qJ6gf7Ff3z3/Fv+sjyd+v/hfqB/vV/fOz8e/6SPL3q5+gfrBf3T//Ff+ujyR/v/pfqB/sV/fPz8a/6yPJ36/+F+oH+9X987Px7/pI8verf6J+oF+wV9095yN4/4PyAX2qvsJ+dXefl+D9D8pH9Kn6CvvV3X1egvc/KB/Rp+or7Fd393kJ3v+gfEOfqq/i/MWe/4Pq3ye1A/8DXfcfaKj8Bd3oH2iwfAKPk7/9AAAAAElFTkSuQmCC',
  bodega: 'iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAAACXBIWXMAAAsTAAALEwEAmpwYAAACtElEQVR4nO2cwW7TQBCGv0lCCAmJcuDOgTvwBPAAcOUVeBCe4M7tBC/AIzwAd44cOCAhcUACiQOUECAIkpg1m8RpU7vxend2Z/cfjZQ0djb5Mp6d/ScGh8PhcDgcDofD4XA4HA5Hwrj/ov8TU/C+Zv2CXeIl+oJ0hb0D9glT8H5nfYNd4hX6jnSFvAT2CVPwfmZ9hF3iNfqCdIW8BPYJU/B+Z32EXeI1+oJ0hbwE9glT8H5mfYVd4jX6jnSFvQb2CVPwfmZ9hV3iNfqOdIW9BvYJU/B+Zn2GXeI1+o50hb0G9glT8H5nfYZd4jX6jnSFvQb2CVPw/md9hl3iNfqSdIW9BvYJU/D+Z32GXeI1+pJ0hb0G9glT8AFkfYZd4jX6knSFvQb2CVPwAWR9hl3iNfqSdIW9BvYJU/ABZH2HXeI1+pJ0hb0G9glT8AFkfYdd4jX6knSFvQb2CVPwAWR9h13iNfqWdIW9BvYJU/ABZH2HXeI1+pZ0hb0G9glT8AFkfYdd4jX6lnSFvQb2CVPwgWR9h13iNfqWdIW9BvYJU/CBZH2IXeI1+pZ0hb0G9glT8IFkfYhd4jX6lnSFvQb2CVPwgWR9iF3iNfqadIW9BvYJU/CBZH2IXeI1+pp0hb0G9glT8IFkfYld4jX6mnSFvQb2CVPwgWR9iV3iNfqadIW9BvYJU/CBZH2JXeI1+p50hb0G9glT8IFkfYld4jX6nnSFvQb2CVPwgWR9il3iNfqedIW9BvYJU/CBZH2KXeI1+p50hb0G9glT8IFkfYpd4jX6nnSFvQb2CVPwgWR9il3iNfqedIW9BvYJU/CBZH2LXeI1+p50hb0G9glT8IFlfYtd4jX6nnSFvQb2CVPwAWV9i13iNfqidIW9BvYJU/ABZX2LXfLfKn8AVeUP0KL/A14vHwIf6l/XAAAAABJRU5ErkJggg==',
  balcon: 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAAC/UlEQVR4nO3dS27bMBCAYU7iJu0BeoEeoHfoGXrDrNJNT+AT+ATZpJt26S27SRfpFRKgAYK2sTWiOBrNfIuAIvj8U0qWZVMJIYQQQgghhBBCCCGEEEKID4b6F/gHMA3/E/MPbovfwodkJvaH/BcwDf89tgv/G3xIZmJ/kH8B0/DfYbvwv8OHZCL2h/wXMA3/PbaL/xv8O3xIpuH/EP8CpuG/x3bxf4cPyTT8H+JfwDT899gu/u/wIZmG/0P8C5iG/x7bxf8dPiTT8H+IfwHT8N9ju/i/w4dkGv4P8S9gGv57bBf/d/iQzMR+kf8CpuH/E9uF/x0+JDOxP8h/AdPw/4ntwv8OH5Jp2B/iX8A0/P9iu/C/w4dkJvaH/BcwDf+/2C787/AhmYb9If4FTMP/L7YL/zt8SKZhf4h/AdPw/4vtwv8OH5KZ2C/yX8A0/H9ju/C/w4dkGvaH+BcwDf+/2C787/AhmYn9Qf4FTMP/L7YL/zt8SKZhf4h/AdPw/4vtwv8OH5KZ2C/yX8A0/P9iu/C/w4dkGvaH+BcwDf+/2C787/AhmYn9Qf4FTMP/L7YL/zt8SKZhf4h/AdPw/4vtwv8OH5KZ2C/yX8A0/P9iu/C/w4dkGvaH+BcwDf+/2C787/AhmYn9If8FTMP/J7YL/zt8SKZhf4h/AdPw/4ntwv8OH5KZ2B/yX8A0/H9iu/C/w4dkGvaH+BcwDf+f2C787/AhmYn9If8FTMP/J7YL/zt8SKZhf4h/AdPw/4ntwv8OH5KZ2B/yX8A0/H9iu/C/w4dkGvaH+BcwDf+f2C787/AhmYn9If8FTMP/J7YL/zt8SKZhf4h/AdPw/4ntwv8OH5KZ2B/yX8A0/H9iu/C/w4dkGvaH+BcwDf+f2C787/AhmYn9Qf4FTMP/J7YL/zt8SKZhf4h/AdPw/4ntwv8OH5KZ2C/yX8A0/P9iu/C/w4dkGvaH+BcwDf+/2C787/AhmYn9Qf4FTKPSfwLV/0dXE/k/4Ev/ARvkH/Cl/4EG+Qdslb/0H/8O+tJ/wFb5S//x76Av/Qdska/0n/0O+tJ/wBb5Sv/Z76Av/QdskH/0H/4O+NJ/wAb5R//h74Av/Qes8x/9R78DXvoP2CL/6D/6HfCl/4At8o/+o98BX/oP2CD/6D/8HVBV/fvgwB+h0n/ABvlH/+HvgJf+A7bIP/oPfwe89B+wRf7Rf/g74Ev/AVvkH/2HvwO+9B+wRf7Rf/g74Ev/AVvkH/2HvwO+9B+wQf7R//h3wP8f/wLf+h/4C/S/dqwmegAAAABJRU5ErkJggg=='
};

// Helper: Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// Helper: Format offer ID
function formatOfferId(id: number, tipo: 'propiedad' | 'producto'): string {
  const prefix = tipo === 'producto' ? 'OP' : 'O';
  return `${prefix}-${id.toString().padStart(6, '0')}`;
}

// Helper: Format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
}

// Helper: Calculate vigencia (5 days from offer date)
function calculateVigencia(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 5);
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
}

// Helper: Wrap text to fit within maxWidth
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

// Helper: Number to Spanish text for characteristics
function numberToSpanishText(num: number): string {
  const textMap: { [key: number]: string } = {
    0: "Cero",
    1: "Una",
    2: "Dos",
    3: "Tres",
    4: "Cuatro",
    5: "Cinco",
    6: "Seis",
    7: "Siete",
    8: "Ocho",
    9: "Nueve",
    10: "Diez",
  };
  return textMap[num] || num.toString();
}

// Helper: Validate RFC (simplified check for valid format)
function isValidRFC(rfc: string | null | undefined): boolean {
  if (!rfc) return false;
  const rfcPattern = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
  return rfcPattern.test(rfc.trim());
}

// Helper: Base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { offerId } = await req.json();

    console.log('Received request with offerId:', offerId);

    if (!offerId) {
      return new Response(
        JSON.stringify({ error: 'offerId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch the offer data
    console.log('Fetching oferta data...');
    const { data: oferta, error: ofertaError } = await supabase
      .from('ofertas')
      .select('*')
      .eq('id', offerId)
      .single();

    if (ofertaError || !oferta) {
      console.error('Error fetching oferta:', ofertaError);
      return new Response(
        JSON.stringify({ error: 'Oferta not found', details: ofertaError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Oferta found:', { id: oferta.id, id_propiedad: oferta.id_propiedad, id_producto: oferta.id_producto });

    // Determine offer type
    const isProductOffer = oferta.id_producto !== null;
    const tipoOferta = isProductOffer ? 'producto' : 'propiedad';

    console.log('Offer type:', tipoOferta);

    // Generate PDF based on type
    let pdfBytes: Uint8Array;
    let fileName: string;

    if (isProductOffer) {
      const result = await generateProductOfferPdf(supabase, oferta);
      pdfBytes = result.pdfBytes;
      fileName = result.fileName;
    } else {
      const result = await generatePropertyOfferPdf(supabase, oferta);
      pdfBytes = result.pdfBytes;
      fileName = result.fileName;
    }

    // Upload to Supabase Storage
    const timestamp = Date.now();
    const filePath = `ofertas_temp/${fileName}`;

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
        url_oferta: urlData.publicUrl,
        fileName: fileName,
        expiresIn: '1 minute',
        tipoOferta: tipoOferta,
        offerId: oferta.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generar-oferta-pdf:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ================== PROPERTY OFFER PDF GENERATION ==================
async function generatePropertyOfferPdf(supabase: any, oferta: any): Promise<{ pdfBytes: Uint8Array; fileName: string }> {
  console.log('Generating property offer PDF...');

  // Fetch property with full relationship path INCLUDING vistas
  const { data: propiedad, error: propError } = await supabase
    .from('propiedades')
    .select(`
      id,
      numero_propiedad,
      precio_lista,
      m2_interiores,
      m2_exteriores,
      numero_piso,
      descripcion,
      clabe_stp_tmp_apartado,
      id_vista,
      vistas (id, nombre),
      edificios_modelos!fk_propiedades_edificio_modelo (
        id,
        modelos!fk_edificios_modelos_modelo (
          id,
          nombre,
          descripcion,
          numero_recamaras,
          numero_completo_banos,
          numero_medio_bano
        ),
        edificios!fk_edificios_modelos_edificio (
          id,
          nombre,
          proyectos!fk_edificios_proyecto (
            id,
            nombre,
            url_logo,
            mostrar_precio_m2_en_oferta,
            mostrar_piso_en_oferta,
            mostrar_seccion_efectivo_en_oferta
          )
        )
      )
    `)
    .eq('id', oferta.id_propiedad)
    .single();

  if (propError || !propiedad) {
    throw new Error(`Property not found: ${propError?.message}`);
  }

  const edificioModelo = propiedad.edificios_modelos;
  const modelo = edificioModelo?.modelos;
  const edificio = edificioModelo?.edificios;
  const proyecto = edificio?.proyectos;
  const vista = propiedad.vistas;

  console.log('Property data loaded:', { 
    numero: propiedad.numero_propiedad, 
    proyecto: proyecto?.nombre,
    vista: vista?.nombre
  });

  // Fetch model images
  let modelImageUrl: string | null = null;
  if (modelo?.id) {
    const { data: modelImages } = await supabase
      .from('multimedia_modelo')
      .select('url, ver_como_ubicacion_en_oferta')
      .eq('id_modelo', modelo.id)
      .eq('activo', true);
    
    if (modelImages && modelImages.length > 0) {
      const priorityImage = modelImages.find((img: any) => img.ver_como_ubicacion_en_oferta);
      modelImageUrl = priorityImage?.url || modelImages[0]?.url;
    }
  }

  // Fetch owner data from project
  let ownerData: any = null;
  let ownerBankAccount: any = null;
  
  if (proyecto?.id) {
    const { data: entidadDueno } = await supabase
      .from('entidades_relacionadas')
      .select(`
        personas!entidades_relacionadas_id_persona_fkey (
          id, nombre_legal, email, telefono
        )
      `)
      .eq('id_proyecto', proyecto.id)
      .eq('tipo_entidad', 'propietario')
      .eq('activo', true)
      .limit(1)
      .maybeSingle();
    
    if (entidadDueno?.personas) {
      ownerData = entidadDueno.personas;
      
      // Fetch owner's bank account (non-STP mother account for cash payments)
      const { data: bankAccount } = await supabase
        .from('cuentas_bancarias')
        .select('numero_cuenta, cuenta_clabe, banco_nombre')
        .eq('id_persona', ownerData.id)
        .eq('es_cuenta_madre_stp', false)
        .eq('activo', true)
        .limit(1)
        .maybeSingle();
      
      ownerBankAccount = bankAccount;
    }
  }

  // Fetch payment schemes WITH tramos_mensualidad
  const { data: ofertaEsquemas } = await supabase
    .from('ofertas_esquemas_pago')
    .select(`
      id_esquema_pago,
      esquemas_pago (
        id,
        nombre,
        porcentaje_enganche,
        numero_mensualidades,
        numero_pagos_enganche,
        porcentaje_mensualidades,
        porcentaje_entrega,
        porcentaje_descuento_aumento,
        es_manual,
        tramos_mensualidad
      )
    `)
    .eq('id_oferta', oferta.id)
    .eq('activo', true);

  const paymentSchemes = ofertaEsquemas?.map((oe: any) => oe.esquemas_pago).filter(Boolean) || [];

  // Fetch lead info
  let leadInfo: any = null;
  if (oferta.id_persona_lead) {
    const { data: persona } = await supabase
      .from('personas')
      .select('id, nombre_legal, email, telefono, rfc')
      .eq('id', oferta.id_persona_lead)
      .single();
    leadInfo = persona;
  }

  // Fetch creator info
  let creatorInfo: any = null;
  if (oferta.email_creador) {
    const { data: user } = await supabase
      .from('usuarios')
      .select('id, nombre, email, telefono')
      .eq('email', oferta.email_creador)
      .maybeSingle();
    
    if (user) {
      creatorInfo = { nombre_legal: user.nombre, email: user.email, telefono: user.telefono };
    } else {
      const { data: persona } = await supabase
        .from('personas')
        .select('id, nombre_legal, email, telefono')
        .eq('email', oferta.email_creador)
        .maybeSingle();
      if (persona) {
        creatorInfo = persona;
      }
    }
  }

  // Fetch estacionamientos
  const { data: estacionamientos } = await supabase
    .from('estacionamientos')
    .select(`
      id,
      nombre,
      tipos_estacionamiento (nombre)
    `)
    .eq('id_propiedad', propiedad.id)
    .eq('activo', true);

  // Fetch bodegas
  const { data: bodegas } = await supabase
    .from('bodegas')
    .select('id, nombre, m2')
    .eq('id_propiedad', propiedad.id)
    .eq('activo', true);

  // Check if property has balcony
  const { data: caracteristicaBalcon } = await supabase
    .from('propiedades_caracteristicas')
    .select('id')
    .eq('id_propiedad', propiedad.id)
    .eq('id_caracteristica', 1) // Assuming 1 is balcony
    .eq('activo', true)
    .maybeSingle();
  
  const tieneBalcon = !!caracteristicaBalcon;

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  let currentPage = pdfDoc.addPage([595.28, 841.89]); // A4 size
  const { width, height } = currentPage.getSize();

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 34; // ~12mm
  const contentWidth = width - margin * 2;
  let y = height - margin;

  // Colors
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.83, 0.83, 0.83);
  const dividerColor = rgb(0.83, 0.83, 0.83);
  const selectedBg = rgb(0.91, 0.96, 0.91);
  const selectedBorder = rgb(0.13, 0.77, 0.37);

  // Helper function to check and add new page
  function checkNewPage(neededHeight: number): boolean {
    if (y - neededHeight < margin) {
      currentPage = pdfDoc.addPage([595.28, 841.89]);
      y = height - margin;
      return true;
    }
    return false;
  }

  // Helper: Calculate payment amounts for a scheme
  function calculatePaymentAmounts(scheme: any, basePrice: number) {
    const adjustment = basePrice * (scheme.porcentaje_descuento_aumento / 100);
    const finalPrice = basePrice + adjustment;

    return {
      enganche: finalPrice * (scheme.porcentaje_enganche / 100),
      mensualidad: scheme.numero_mensualidades > 0
        ? (finalPrice * (scheme.porcentaje_mensualidades / 100)) / scheme.numero_mensualidades
        : 0,
      entrega: finalPrice * (scheme.porcentaje_entrega / 100),
      finalPrice,
      adjustment,
    };
  }

  // Embed icons
  const embeddedIcons: { [key: string]: any } = {};
  for (const [name, base64] of Object.entries(ICONS_BASE64)) {
    try {
      const bytes = base64ToUint8Array(base64);
      embeddedIcons[name] = await pdfDoc.embedPng(bytes);
    } catch (e) {
      console.warn(`Failed to embed icon ${name}:`, e);
    }
  }

  // ========== HEADER ==========
  if (proyecto?.url_logo) {
    try {
      const logoResponse = await fetch(proyecto.url_logo);
      const logoBytes = await logoResponse.arrayBuffer();
      let logoImage;
      
      if (proyecto.url_logo.toLowerCase().includes('.png')) {
        logoImage = await pdfDoc.embedPng(logoBytes);
      } else {
        logoImage = await pdfDoc.embedJpg(logoBytes);
      }
      
      const logoHeight = 42;
      const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
      
      currentPage.drawImage(logoImage, {
        x: margin,
        y: y - logoHeight,
        width: logoWidth,
        height: logoHeight,
      });
    } catch (e) {
      console.warn('Error loading logo:', e);
      currentPage.drawText(proyecto?.nombre || 'Proyecto', {
        x: margin,
        y: y - 10,
        size: 14,
        font: helveticaBold,
        color: black,
      });
    }
  } else {
    currentPage.drawText(proyecto?.nombre || 'Proyecto', {
      x: margin,
      y: y - 10,
      size: 14,
      font: helveticaBold,
      color: black,
    });
  }

  // Offer info on right side
  const rightX = width - margin;
  let rightY = y - 4;

  currentPage.drawText('ID Oferta:', {
    x: rightX - 90,
    y: rightY,
    size: 10,
    font: helveticaBold,
    color: black,
  });
  currentPage.drawText(formatOfferId(oferta.id, 'propiedad'), {
    x: rightX - helvetica.widthOfTextAtSize(formatOfferId(oferta.id, 'propiedad'), 10),
    y: rightY,
    size: 10,
    font: helvetica,
    color: black,
  });
  rightY -= 14;

  currentPage.drawText('Expedición:', {
    x: rightX - 90,
    y: rightY,
    size: 10,
    font: helveticaBold,
    color: black,
  });
  currentPage.drawText(formatDate(oferta.fecha_generacion), {
    x: rightX - helvetica.widthOfTextAtSize(formatDate(oferta.fecha_generacion), 10),
    y: rightY,
    size: 10,
    font: helvetica,
    color: black,
  });
  rightY -= 14;

  currentPage.drawText('Vigencia:', {
    x: rightX - 90,
    y: rightY,
    size: 10,
    font: helveticaBold,
    color: black,
  });
  currentPage.drawText(calculateVigencia(oferta.fecha_generacion), {
    x: rightX - helvetica.widthOfTextAtSize(calculateVigencia(oferta.fecha_generacion), 10),
    y: rightY,
    size: 10,
    font: helvetica,
    color: black,
  });

  y -= 55;

  // Divider
  currentPage.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: lightGray,
  });
  y -= 17;

  // ========== PROPERTY DETAILS ==========
  currentPage.drawText('Datos de la Propiedad:', {
    x: margin,
    y,
    size: 12,
    font: helveticaBold,
    color: black,
  });
  y -= 20;

  // Property info column layout
  const propColWidth = contentWidth * 0.35;
  const iconColWidth = contentWidth * 0.2;
  const imageColWidth = contentWidth * 0.45;
  const propStartY = y;

  // Property items
  const propItems: { label: string; value: string }[] = [
    { label: 'Proyecto:', value: proyecto?.nombre || 'N/A' },
    { label: 'Edificio:', value: edificio?.nombre || 'N/A' },
    { label: 'Modelo:', value: modelo?.nombre || 'N/A' },
    { label: 'Número de propiedad:', value: propiedad.numero_propiedad || 'N/A' },
  ];

  if (proyecto?.mostrar_piso_en_oferta && propiedad.numero_piso) {
    propItems.push({ label: 'Nivel:', value: propiedad.numero_piso });
  }
  
  if (vista?.nombre) {
    propItems.push({ label: 'Vista:', value: vista.nombre });
  }

  const totalArea = (Number(propiedad.m2_interiores) || 0) + (Number(propiedad.m2_exteriores) || 0);
  propItems.push({ label: 'Área:', value: `${totalArea.toFixed(2)} m²` });
  propItems.push({ label: 'Precio de lista:', value: formatCurrency(propiedad.precio_lista) });

  if (proyecto?.mostrar_precio_m2_en_oferta && totalArea > 0) {
    propItems.push({ label: 'Precio por m²:', value: formatCurrency(propiedad.precio_lista / totalArea) });
  }

  for (const item of propItems) {
    currentPage.drawText(item.label, {
      x: margin,
      y,
      size: 9,
      font: helvetica,
      color: gray,
    });
    currentPage.drawText(item.value, {
      x: margin + 100,
      y,
      size: 9,
      font: helveticaBold,
      color: black,
    });
    y -= 14;
  }

  // Icons column
  const iconX = margin + propColWidth + 5;
  const iconSize = 14;
  const iconSpacing = 34;

  const iconItems: Array<{ icon: string; value: string }> = [];

  if (modelo?.numero_recamaras && modelo.numero_recamaras > 0) {
    iconItems.push({
      icon: 'recamaras',
      value: numberToSpanishText(modelo.numero_recamaras),
    });
  }
  if (modelo?.numero_completo_banos && modelo.numero_completo_banos > 0) {
    iconItems.push({
      icon: 'banos',
      value: numberToSpanishText(modelo.numero_completo_banos),
    });
  }
  if ((modelo?.numero_medio_bano ?? 0) > 0) {
    iconItems.push({
      icon: 'mediosBanos',
      value: numberToSpanishText(modelo!.numero_medio_bano!),
    });
  }
  if (estacionamientos && estacionamientos.length > 0) {
    const estResumen = estacionamientos.reduce((acc: any, est: any) => {
      const tipo = est.tipos_estacionamiento?.nombre || 'Sin especificar';
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {});
    const estTexto = Object.entries(estResumen)
      .map(([tipo, cantidad]) => `${cantidad} ${tipo}`)
      .join(', ') || 'N/A';
    iconItems.push({ icon: 'estacionamiento', value: estTexto });
  }
  if (bodegas && bodegas.length > 0) {
    iconItems.push({
      icon: 'bodega',
      value: `${bodegas.length} ${bodegas.length === 1 ? 'Bodega' : 'Bodegas'}`,
    });
  }
  if (tieneBalcon) {
    iconItems.push({ icon: 'balcon', value: 'Balcón' });
  }

  // Render icons in 2 columns
  const iconsPerCol = Math.ceil(iconItems.length / 2);
  iconItems.forEach((item, idx) => {
    const col = idx < iconsPerCol ? 0 : 1;
    const row = idx < iconsPerCol ? idx : idx - iconsPerCol;
    const x = iconX + col * (iconColWidth / 2);
    const yPos = propStartY - row * iconSpacing;

    const iconImage = embeddedIcons[item.icon];
    if (iconImage) {
      try {
        currentPage.drawImage(iconImage, {
          x: x,
          y: yPos - iconSize + 4,
          width: iconSize,
          height: iconSize,
        });
      } catch (e) {
        console.warn('Error drawing icon:', e);
      }
    }
    currentPage.drawText(item.value, {
      x: x + iconSize + 4,
      y: yPos - 6,
      size: 8,
      font: helvetica,
      color: black,
    });
  });

  // Model image column
  if (modelImageUrl) {
    const imageX = margin + propColWidth + iconColWidth + 5;
    const imageWidth = imageColWidth - 10;
    const imageHeight = 100;

    try {
      const imgResponse = await fetch(modelImageUrl);
      const imgBytes = await imgResponse.arrayBuffer();
      let modelImage;
      
      if (modelImageUrl.toLowerCase().includes('.png')) {
        modelImage = await pdfDoc.embedPng(imgBytes);
      } else {
        modelImage = await pdfDoc.embedJpg(imgBytes);
      }
      
      // Calculate aspect ratio to fit within bounds
      const aspectRatio = modelImage.width / modelImage.height;
      let drawWidth = imageWidth;
      let drawHeight = imageWidth / aspectRatio;
      
      if (drawHeight > imageHeight) {
        drawHeight = imageHeight;
        drawWidth = imageHeight * aspectRatio;
      }

      currentPage.drawImage(modelImage, {
        x: imageX,
        y: propStartY - drawHeight,
        width: drawWidth,
        height: drawHeight,
      });
    } catch (e) {
      console.warn('Error loading model image:', e);
    }
  }

  y = Math.min(y, propStartY - 110);

  // Divider
  currentPage.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: lightGray,
  });
  y -= 17;

  // ========== PAYMENT SCHEMES ==========
  if (paymentSchemes.length > 0) {
    currentPage.drawText('Esquemas de pago:', {
      x: margin,
      y,
      size: 12,
      font: helveticaBold,
      color: black,
    });
    y -= 20;

    const selectedScheme = paymentSchemes[0];
    const filteredSchemes = selectedScheme?.es_manual
      ? paymentSchemes.filter((s: any) => s.es_manual)
      : paymentSchemes.filter((s: any) => !s.es_manual);

    const schemeWidth = filteredSchemes.length === 1 ? contentWidth : (contentWidth - 10) / 2;
    
    for (let i = 0; i < filteredSchemes.length; i++) {
      const scheme = filteredSchemes[i];
      const isSelected = oferta.id_esquema_pago_seleccionado === scheme.id;
      const amounts = calculatePaymentAmounts(scheme, propiedad.precio_lista);
      const hasSavings = amounts.adjustment < 0;

      // Calculate dynamic height based on content
      const tramosCount = scheme.tramos_mensualidad?.length || 0;
      let schemeHeight = 45; // Base height
      if (tramosCount > 1) {
        schemeHeight += (tramosCount - 1) * 12; // Extra height for tramos
      }
      if (hasSavings) schemeHeight += 12;
      if (scheme.porcentaje_enganche > 0) schemeHeight += 12;
      if (scheme.porcentaje_mensualidades > 0 && scheme.numero_mensualidades > 0) {
        schemeHeight += 24; // "Durante la obra" + mensualidades
        if (tramosCount > 0) {
          schemeHeight += tramosCount * 12;
        }
      }
      if (scheme.porcentaje_entrega > 0) schemeHeight += 12;

      const col = i % 2;
      const xOffset = col * (schemeWidth + 10);
      const schemeX = margin + xOffset;

      // Check for new page
      checkNewPage(schemeHeight + 10);

      // Background
      if (isSelected) {
        currentPage.drawRectangle({
          x: schemeX,
          y: y - schemeHeight,
          width: schemeWidth,
          height: schemeHeight,
          color: selectedBg,
          borderColor: selectedBorder,
          borderWidth: 1,
        });
      } else {
        currentPage.drawRectangle({
          x: schemeX,
          y: y - schemeHeight,
          width: schemeWidth,
          height: schemeHeight,
          color: rgb(1, 1, 1),
          borderColor: lightGray,
          borderWidth: 0.5,
        });
      }

      let lineY = y - 12;
      const padding = 8;

      // Scheme name (only for non-manual)
      if (!scheme.es_manual) {
        currentPage.drawText(scheme.nombre, {
          x: schemeX + padding,
          y: lineY,
          size: 10,
          font: helveticaBold,
          color: black,
        });
        lineY -= 14;
      }

      // Final price
      currentPage.drawText('Precio final:', { 
        x: schemeX + padding, 
        y: lineY, 
        size: 8, 
        font: helvetica, 
        color: gray 
      });
      currentPage.drawText(formatCurrency(amounts.finalPrice), {
        x: schemeX + schemeWidth - padding - helveticaBold.widthOfTextAtSize(formatCurrency(amounts.finalPrice), 8),
        y: lineY,
        size: 8,
        font: helveticaBold,
        color: black,
      });
      lineY -= 12;

      // Savings
      if (hasSavings) {
        currentPage.drawText(`Ahorro (${Math.abs(scheme.porcentaje_descuento_aumento)}%):`, {
          x: schemeX + padding,
          y: lineY,
          size: 8,
          font: helvetica,
          color: gray,
        });
        const savingsText = formatCurrency(Math.abs(amounts.adjustment));
        currentPage.drawText(savingsText, {
          x: schemeX + schemeWidth - padding - helveticaBold.widthOfTextAtSize(savingsText, 8),
          y: lineY,
          size: 8,
          font: helveticaBold,
          color: black,
        });
        lineY -= 12;
      }

      // Enganche
      if (scheme.porcentaje_enganche > 0) {
        const engancheLabel = scheme.numero_pagos_enganche > 1
          ? `Enganche (en ${scheme.numero_pagos_enganche} pagos):`
          : 'Enganche:';
        currentPage.drawText(engancheLabel, { 
          x: schemeX + padding, 
          y: lineY, 
          size: 8, 
          font: helvetica, 
          color: gray 
        });
        const engancheText = `${scheme.porcentaje_enganche}% ${formatCurrency(amounts.enganche)}`;
        currentPage.drawText(engancheText, {
          x: schemeX + schemeWidth - padding - helveticaBold.widthOfTextAtSize(engancheText, 8),
          y: lineY,
          size: 8,
          font: helveticaBold,
          color: black,
        });
        lineY -= 12;
      }

      // Monthly payments
      if (scheme.porcentaje_mensualidades > 0 && scheme.numero_mensualidades > 0) {
        // "Durante la obra" total
        currentPage.drawText('Durante la obra:', { 
          x: schemeX + padding, 
          y: lineY, 
          size: 8, 
          font: helvetica, 
          color: gray 
        });
        const totalMensText = `${scheme.porcentaje_mensualidades}% ${formatCurrency(amounts.finalPrice * (scheme.porcentaje_mensualidades / 100))}`;
        currentPage.drawText(totalMensText, {
          x: schemeX + schemeWidth - padding - helveticaBold.widthOfTextAtSize(totalMensText, 8),
          y: lineY,
          size: 8,
          font: helveticaBold,
          color: black,
        });
        lineY -= 12;

        // Tiered payments (tramos_mensualidad)
        if (scheme.tramos_mensualidad && scheme.tramos_mensualidad.length > 0) {
          let mensualidadesAcumuladas = 0;
          for (let idx = 0; idx < scheme.tramos_mensualidad.length; idx++) {
            const tramo = scheme.tramos_mensualidad[idx];
            
            currentPage.drawText(`${tramo.numero_mensualidades} mensualidades:`, {
              x: schemeX + padding,
              y: lineY,
              size: 8,
              font: helvetica,
              color: gray,
            });
            
            let mensualidadText = formatCurrency(tramo.monto);
            if (idx > 0) {
              mensualidadText += ` (mes ${mensualidadesAcumuladas + 1}+)`;
            }
            
            currentPage.drawText(mensualidadText, {
              x: schemeX + schemeWidth - padding - helveticaBold.widthOfTextAtSize(mensualidadText, 8),
              y: lineY,
              size: 8,
              font: helveticaBold,
              color: black,
            });
            
            mensualidadesAcumuladas += tramo.numero_mensualidades;
            lineY -= 12;
          }
        } else {
          // Uniform payments
          currentPage.drawText(`${scheme.numero_mensualidades} mensualidades:`, {
            x: schemeX + padding,
            y: lineY,
            size: 8,
            font: helvetica,
            color: gray,
          });
          currentPage.drawText(formatCurrency(amounts.mensualidad), {
            x: schemeX + schemeWidth - padding - helveticaBold.widthOfTextAtSize(formatCurrency(amounts.mensualidad), 8),
            y: lineY,
            size: 8,
            font: helveticaBold,
            color: black,
          });
          lineY -= 12;
        }
      }

      // Delivery payment
      if (scheme.porcentaje_entrega > 0) {
        currentPage.drawText('A la entrega:', { 
          x: schemeX + padding, 
          y: lineY, 
          size: 8, 
          font: helvetica, 
          color: gray 
        });
        const entregaText = `${scheme.porcentaje_entrega}% ${formatCurrency(amounts.entrega)}`;
        currentPage.drawText(entregaText, {
          x: schemeX + schemeWidth - padding - helveticaBold.widthOfTextAtSize(entregaText, 8),
          y: lineY,
          size: 8,
          font: helveticaBold,
          color: black,
        });
      }

      // Move to next row after 2 schemes
      if (col === 1 || i === filteredSchemes.length - 1) {
        y -= schemeHeight + 10;
      }
    }

    // Divider
    currentPage.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: lightGray,
    });
    y -= 17;
  }

  // ========== BANKING DATA ==========
  const hasValidRFC = isValidRFC(leadInfo?.rfc);
  const hasClabe = propiedad.clabe_stp_tmp_apartado;
  const showCashPayment = proyecto?.mostrar_seccion_efectivo_en_oferta && ownerBankAccount;
  const showBanking = hasValidRFC && (hasClabe || showCashPayment);

  if (showBanking) {
    checkNewPage(80);

    currentPage.drawText('Datos Bancarios', {
      x: margin,
      y,
      size: 12,
      font: helveticaBold,
      color: black,
    });
    y -= 20;

    const bankCardWidth = (hasClabe && showCashPayment) ? (contentWidth - 10) / 2 : contentWidth;
    const bankCardHeight = 70;

    // Transfer payment card
    if (hasClabe) {
      currentPage.drawRectangle({
        x: margin,
        y: y - bankCardHeight,
        width: bankCardWidth,
        height: bankCardHeight,
        color: dividerColor,
      });

      let bankY = y - 12;
      currentPage.drawText('Pago por transferencia', {
        x: margin + 8,
        y: bankY,
        size: 9,
        font: helveticaBold,
        color: black,
      });
      bankY -= 14;
      currentPage.drawText('Banco: Sistema de Transferencias y Pagos (STP)', {
        x: margin + 8,
        y: bankY,
        size: 8,
        font: helvetica,
        color: black,
      });
      bankY -= 12;
      currentPage.drawText(`Titular: ${ownerData?.nombre_legal || 'N/A'}`, {
        x: margin + 8,
        y: bankY,
        size: 8,
        font: helvetica,
        color: black,
      });
      bankY -= 12;
      currentPage.drawText(`Cuenta CLABE: ${propiedad.clabe_stp_tmp_apartado}`, {
        x: margin + 8,
        y: bankY,
        size: 8,
        font: helvetica,
        color: black,
      });
    }

    // Cash payment card
    if (showCashPayment) {
      const cashX = hasClabe ? margin + bankCardWidth + 10 : margin;

      currentPage.drawRectangle({
        x: cashX,
        y: y - bankCardHeight,
        width: bankCardWidth,
        height: bankCardHeight,
        color: dividerColor,
      });

      let bankY = y - 12;
      currentPage.drawText('Pago en efectivo', {
        x: cashX + 8,
        y: bankY,
        size: 9,
        font: helveticaBold,
        color: black,
      });
      bankY -= 14;
      currentPage.drawText(`Banco: ${ownerBankAccount.banco_nombre || 'N/A'}`, {
        x: cashX + 8,
        y: bankY,
        size: 8,
        font: helvetica,
        color: black,
      });
      bankY -= 12;
      currentPage.drawText(`Titular: ${ownerData?.nombre_legal || 'N/A'}`, {
        x: cashX + 8,
        y: bankY,
        size: 8,
        font: helvetica,
        color: black,
      });
      bankY -= 12;
      currentPage.drawText(`Cuenta CLABE: ${ownerBankAccount.cuenta_clabe || 'N/A'}`, {
        x: cashX + 8,
        y: bankY,
        size: 8,
        font: helvetica,
        color: black,
      });
    }

    y -= bankCardHeight + 10;

    // Divider
    currentPage.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: lightGray,
    });
    y -= 17;
  }

  // ========== CONTACT INFO ==========
  checkNewPage(60);

  currentPage.drawText('Datos de Contacto', {
    x: margin,
    y,
    size: 12,
    font: helveticaBold,
    color: black,
  });
  y -= 20;

  const contactColWidth = (contentWidth - 10) / 2;

  // Agent column
  currentPage.drawText('Agente', { x: margin, y, size: 9, font: helveticaBold, color: black });
  y -= 14;

  const agentName = creatorInfo?.nombre_legal || creatorInfo?.nombre || oferta.email_creador;
  currentPage.drawText('Nombre:', { x: margin, y, size: 8, font: helveticaBold, color: black });
  currentPage.drawText(agentName, { x: margin + 50, y, size: 8, font: helvetica, color: black });
  y -= 11;
  currentPage.drawText('Email:', { x: margin, y, size: 8, font: helveticaBold, color: black });
  currentPage.drawText(creatorInfo?.email || oferta.email_creador, { x: margin + 50, y, size: 8, font: helvetica, color: black });
  y -= 11;
  currentPage.drawText('Teléfono:', { x: margin, y, size: 8, font: helveticaBold, color: black });
  currentPage.drawText(creatorInfo?.telefono || 'N/A', { x: margin + 50, y, size: 8, font: helvetica, color: black });

  // Buyer column (on same row, right side)
  const buyerX = margin + contactColWidth + 10;
  let buyerY = y + 36; // Go back to header level

  currentPage.drawText('Comprador', { x: buyerX, y: buyerY, size: 9, font: helveticaBold, color: black });
  buyerY -= 14;

  const leadName = leadInfo?.nombre_legal || 'N/A';
  currentPage.drawText('Nombre:', { x: buyerX, y: buyerY, size: 8, font: helveticaBold, color: black });
  currentPage.drawText(leadName, { x: buyerX + 50, y: buyerY, size: 8, font: helvetica, color: black });
  buyerY -= 11;
  currentPage.drawText('Email:', { x: buyerX, y: buyerY, size: 8, font: helveticaBold, color: black });
  currentPage.drawText(leadInfo?.email || 'N/A', { x: buyerX + 50, y: buyerY, size: 8, font: helvetica, color: black });
  buyerY -= 11;
  if (leadInfo?.telefono) {
    currentPage.drawText('Teléfono:', { x: buyerX, y: buyerY, size: 8, font: helveticaBold, color: black });
    currentPage.drawText(leadInfo.telefono, { x: buyerX + 50, y: buyerY, size: 8, font: helvetica, color: black });
    buyerY -= 11;
  }
  if (leadInfo?.rfc) {
    currentPage.drawText('RFC:', { x: buyerX, y: buyerY, size: 8, font: helveticaBold, color: black });
    currentPage.drawText(leadInfo.rfc, { x: buyerX + 50, y: buyerY, size: 8, font: helvetica, color: black });
  }

  // Generate filename
  const cleanProjectName = (proyecto?.nombre || 'Proyecto').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanPropertyNumber = (propiedad.numero_propiedad || 'NA').replace(/[^a-zA-Z0-9]/g, '_');
  const offerNumber = oferta.id.toString().padStart(6, '0');

  const fileName = `O_${offerNumber}_${cleanPropertyNumber}_${cleanProjectName}_${Date.now()}.pdf`;

  const pdfBytes = await pdfDoc.save();
  console.log('Property offer PDF generated, size:', pdfBytes.length, 'bytes');

  return { pdfBytes, fileName };
}

// ================== PRODUCT OFFER PDF GENERATION ==================
async function generateProductOfferPdf(supabase: any, oferta: any): Promise<{ pdfBytes: Uint8Array; fileName: string }> {
  console.log('Generating product offer PDF...');

  // Fetch product details
  const { data: producto, error: prodError } = await supabase
    .from('productos_servicios')
    .select(`
      id,
      nombre,
      precio_lista,
      m2,
      id_categoria,
      id_proyecto,
      categorias_producto!fk_prodserv_categoria (
        id,
        nombre
      ),
      proyectos!productos_servicios_id_proyecto_fkey (
        id,
        nombre,
        url_logo,
        mostrar_seccion_efectivo_en_oferta,
        mostrar_precio_m2_en_oferta
      )
    `)
    .eq('id', oferta.id_producto)
    .single();

  if (prodError || !producto) {
    throw new Error(`Product not found: ${prodError?.message}`);
  }

  const proyecto = producto.proyectos;
  const categoria = producto.categorias_producto;

  console.log('Product data loaded:', { nombre: producto.nombre, proyecto: proyecto?.nombre });

  // Fetch owner data from project
  let ownerData: any = null;
  let ownerBankAccount: any = null;
  
  if (proyecto?.id) {
    const { data: entidadDueno } = await supabase
      .from('entidades_relacionadas')
      .select(`
        personas!entidades_relacionadas_id_persona_fkey (
          id, nombre_legal, email, telefono
        )
      `)
      .eq('id_proyecto', proyecto.id)
      .eq('tipo_entidad', 'propietario')
      .eq('activo', true)
      .limit(1)
      .maybeSingle();
    
    if (entidadDueno?.personas) {
      ownerData = entidadDueno.personas;
      
      // Fetch owner's bank account
      const { data: bankAccount } = await supabase
        .from('cuentas_bancarias')
        .select('numero_cuenta, cuenta_clabe, banco_nombre')
        .eq('id_persona', ownerData.id)
        .eq('es_cuenta_madre_stp', false)
        .eq('activo', true)
        .limit(1)
        .maybeSingle();
      
      ownerBankAccount = bankAccount;
    }
  }

  // Fetch related property if exists
  let propiedad: any = null;
  if (oferta.id_propiedad) {
    const { data: prop } = await supabase
      .from('propiedades')
      .select(`
        id,
        numero_propiedad,
        edificios_modelos!fk_propiedades_edificio_modelo (
          id,
          modelos!fk_edificios_modelos_modelo (nombre),
          edificios!fk_edificios_modelos_edificio (nombre)
        )
      `)
      .eq('id', oferta.id_propiedad)
      .single();
    propiedad = prop;
  }

  // Fetch payment schemes WITH tramos_mensualidad
  const { data: ofertaEsquemas } = await supabase
    .from('ofertas_esquemas_pago')
    .select(`
      id_esquema_pago,
      esquemas_pago (
        id,
        nombre,
        porcentaje_enganche,
        numero_mensualidades,
        numero_pagos_enganche,
        porcentaje_mensualidades,
        porcentaje_entrega,
        porcentaje_descuento_aumento,
        es_manual,
        tramos_mensualidad
      )
    `)
    .eq('id_oferta', oferta.id)
    .eq('activo', true);

  const paymentSchemes = ofertaEsquemas?.map((oe: any) => oe.esquemas_pago).filter(Boolean) || [];

  // Fetch lead info
  let leadInfo: any = null;
  if (oferta.id_persona_lead) {
    const { data: persona } = await supabase
      .from('personas')
      .select('id, nombre_legal, email, telefono, rfc')
      .eq('id', oferta.id_persona_lead)
      .single();
    leadInfo = persona;
  }

  // Fetch creator info
  let creatorInfo: any = null;
  if (oferta.email_creador) {
    const { data: user } = await supabase
      .from('usuarios')
      .select('id, nombre, email, telefono')
      .eq('email', oferta.email_creador)
      .maybeSingle();
    
    if (user) {
      creatorInfo = { nombre_legal: user.nombre, email: user.email, telefono: user.telefono };
    }
  }

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  let currentPage = pdfDoc.addPage([595.28, 841.89]); // A4 size
  const { width, height } = currentPage.getSize();

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 34;
  const contentWidth = width - margin * 2;
  let y = height - margin;

  // Colors
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.83, 0.83, 0.83);
  const cardBg = rgb(0.96, 0.96, 0.96);
  const dividerColor = rgb(0.83, 0.83, 0.83);
  const selectedBg = rgb(0.91, 0.96, 0.91);
  const selectedBorder = rgb(0.13, 0.77, 0.37);

  // Helper function to check and add new page
  function checkNewPage(neededHeight: number): boolean {
    if (y - neededHeight < margin) {
      currentPage = pdfDoc.addPage([595.28, 841.89]);
      y = height - margin;
      return true;
    }
    return false;
  }

  // Helper: Calculate payment amounts
  function calculatePaymentAmounts(scheme: any, basePrice: number) {
    const adjustment = basePrice * (scheme.porcentaje_descuento_aumento / 100);
    const finalPrice = basePrice + adjustment;

    return {
      enganche: finalPrice * (scheme.porcentaje_enganche / 100),
      mensualidad: scheme.numero_mensualidades > 0
        ? (finalPrice * (scheme.porcentaje_mensualidades / 100)) / scheme.numero_mensualidades
        : 0,
      entrega: finalPrice * (scheme.porcentaje_entrega / 100),
      finalPrice,
      adjustment,
    };
  }

  // ========== HEADER ==========
  if (proyecto?.url_logo) {
    try {
      const logoResponse = await fetch(proyecto.url_logo);
      const logoBytes = await logoResponse.arrayBuffer();
      let logoImage;
      
      if (proyecto.url_logo.toLowerCase().includes('.png')) {
        logoImage = await pdfDoc.embedPng(logoBytes);
      } else {
        logoImage = await pdfDoc.embedJpg(logoBytes);
      }
      
      const logoHeight = 42;
      const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
      
      currentPage.drawImage(logoImage, {
        x: margin,
        y: y - logoHeight,
        width: logoWidth,
        height: logoHeight,
      });
    } catch (e) {
      console.warn('Error loading logo:', e);
      currentPage.drawText(proyecto?.nombre || 'Proyecto', {
        x: margin,
        y: y - 10,
        size: 14,
        font: helveticaBold,
        color: black,
      });
    }
  } else {
    currentPage.drawText(proyecto?.nombre || 'Proyecto', {
      x: margin,
      y: y - 10,
      size: 14,
      font: helveticaBold,
      color: black,
    });
  }

  // Offer info on right side
  const rightX = width - margin;
  let rightY = y - 4;

  currentPage.drawText('ID Oferta:', {
    x: rightX - 90,
    y: rightY,
    size: 10,
    font: helveticaBold,
    color: black,
  });
  currentPage.drawText(formatOfferId(oferta.id, 'producto'), {
    x: rightX - helvetica.widthOfTextAtSize(formatOfferId(oferta.id, 'producto'), 10),
    y: rightY,
    size: 10,
    font: helvetica,
    color: black,
  });
  rightY -= 14;

  currentPage.drawText('Expedición:', {
    x: rightX - 90,
    y: rightY,
    size: 10,
    font: helveticaBold,
    color: black,
  });
  currentPage.drawText(formatDate(oferta.fecha_generacion), {
    x: rightX - helvetica.widthOfTextAtSize(formatDate(oferta.fecha_generacion), 10),
    y: rightY,
    size: 10,
    font: helvetica,
    color: black,
  });
  rightY -= 14;

  currentPage.drawText('Vigencia:', {
    x: rightX - 90,
    y: rightY,
    size: 10,
    font: helveticaBold,
    color: black,
  });
  currentPage.drawText(calculateVigencia(oferta.fecha_generacion), {
    x: rightX - helvetica.widthOfTextAtSize(calculateVigencia(oferta.fecha_generacion), 10),
    y: rightY,
    size: 10,
    font: helvetica,
    color: black,
  });

  y -= 55;

  // Divider
  currentPage.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: lightGray,
  });
  y -= 17;

  // ========== PROPERTY AND PRODUCT DATA (side by side) ==========
  const colWidth = (contentWidth - 20) / 2;
  const cardHeight = 90;

  // Property Data Card Title
  currentPage.drawText('Datos de la Propiedad:', {
    x: margin,
    y,
    size: 11,
    font: helveticaBold,
    color: black,
  });

  // Product Data Card Title
  currentPage.drawText('Datos del Producto:', {
    x: margin + colWidth + 20,
    y,
    size: 11,
    font: helveticaBold,
    color: black,
  });
  y -= 17;

  // Property Card
  currentPage.drawRectangle({
    x: margin,
    y: y - cardHeight,
    width: colWidth,
    height: cardHeight,
    color: cardBg,
    borderColor: lightGray,
    borderWidth: 0.5,
  });

  const edificioModelo = propiedad?.edificios_modelos;
  let propY = y - 15;
  currentPage.drawText('Proyecto:', { x: margin + 10, y: propY, size: 9, font: helvetica, color: gray });
  currentPage.drawText(proyecto?.nombre || 'N/A', { x: margin + 60, y: propY, size: 9, font: helveticaBold, color: black });
  propY -= 14;

  if (edificioModelo?.modelos?.nombre) {
    currentPage.drawText('Modelo:', { x: margin + 10, y: propY, size: 9, font: helvetica, color: gray });
    currentPage.drawText(edificioModelo.modelos.nombre, { x: margin + 60, y: propY, size: 9, font: helveticaBold, color: black });
    propY -= 14;
  }
  if (edificioModelo?.edificios?.nombre) {
    currentPage.drawText('Edificio:', { x: margin + 10, y: propY, size: 9, font: helvetica, color: gray });
    currentPage.drawText(edificioModelo.edificios.nombre, { x: margin + 60, y: propY, size: 9, font: helveticaBold, color: black });
    propY -= 14;
  }
  currentPage.drawText('No° de propiedad:', { x: margin + 10, y: propY, size: 9, font: helvetica, color: gray });
  currentPage.drawText(propiedad?.numero_propiedad || 'N/A', { x: margin + 90, y: propY, size: 9, font: helveticaBold, color: black });

  // Product Card
  const prodCardX = margin + colWidth + 20;
  currentPage.drawRectangle({
    x: prodCardX,
    y: y - cardHeight,
    width: colWidth,
    height: cardHeight,
    color: cardBg,
    borderColor: lightGray,
    borderWidth: 0.5,
  });

  let prodY = y - 15;
  currentPage.drawText('Categoría:', { x: prodCardX + 10, y: prodY, size: 9, font: helvetica, color: gray });
  currentPage.drawText(categoria?.nombre || 'N/A', { x: prodCardX + 60, y: prodY, size: 9, font: helveticaBold, color: black });
  prodY -= 14;

  currentPage.drawText('Producto:', { x: prodCardX + 10, y: prodY, size: 9, font: helvetica, color: gray });
  const prodNameLines = wrapText(producto.nombre, colWidth - 80, helveticaBold, 9);
  currentPage.drawText(prodNameLines[0] || 'N/A', { x: prodCardX + 60, y: prodY, size: 9, font: helveticaBold, color: black });
  prodY -= 14;

  // Show m2 if applicable
  if (producto.m2 && producto.m2 > 0) {
    currentPage.drawText('Metraje:', { x: prodCardX + 10, y: prodY, size: 9, font: helvetica, color: gray });
    currentPage.drawText(`${producto.m2.toFixed(2)} m²`, { x: prodCardX + 60, y: prodY, size: 9, font: helveticaBold, color: black });
    prodY -= 14;
  }

  currentPage.drawText('Precio de lista:', { x: prodCardX + 10, y: prodY, size: 9, font: helvetica, color: gray });
  currentPage.drawText(formatCurrency(producto.precio_lista), { x: prodCardX + 80, y: prodY, size: 9, font: helveticaBold, color: black });
  prodY -= 14;

  // Show price per m2 if applicable
  if (proyecto?.mostrar_precio_m2_en_oferta && producto.m2 && producto.m2 > 0) {
    currentPage.drawText('Precio por m²:', { x: prodCardX + 10, y: prodY, size: 9, font: helvetica, color: gray });
    currentPage.drawText(formatCurrency(producto.precio_lista / producto.m2), { x: prodCardX + 80, y: prodY, size: 9, font: helveticaBold, color: black });
  }

  y -= cardHeight + 17;

  // ========== PAYMENT SCHEMES ==========
  if (paymentSchemes.length > 0) {
    currentPage.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: lightGray,
    });
    y -= 17;

    currentPage.drawText('Esquemas de pago disponibles:', {
      x: margin,
      y,
      size: 11,
      font: helveticaBold,
      color: black,
    });
    y -= 17;

    const selectedScheme = paymentSchemes.find((s: any) => s.id === oferta.id_esquema_pago_seleccionado);
    const displaySchemes = selectedScheme?.es_manual
      ? [selectedScheme]
      : paymentSchemes.filter((s: any) => !s.es_manual);

    const schemeWidth = displaySchemes.length === 1 ? contentWidth : (contentWidth - 10) / 2;

    for (let i = 0; i < displaySchemes.length; i++) {
      const scheme = displaySchemes[i];
      const isSelected = oferta.id_esquema_pago_seleccionado === scheme.id;
      const amounts = calculatePaymentAmounts(scheme, producto.precio_lista);
      const hasSavings = amounts.adjustment < 0;

      // Calculate dynamic height
      const tramosCount = scheme.tramos_mensualidad?.length || 0;
      let schemeHeight = 50;
      if (tramosCount > 1) {
        schemeHeight += (tramosCount - 1) * 12;
      }
      if (hasSavings) schemeHeight += 12;
      if (scheme.porcentaje_enganche > 0) schemeHeight += 12;
      if (scheme.porcentaje_mensualidades > 0 && scheme.numero_mensualidades > 0) {
        schemeHeight += 12;
        if (tramosCount > 0) {
          schemeHeight += tramosCount * 12;
        } else {
          schemeHeight += 12;
        }
      }
      if (scheme.porcentaje_entrega > 0) schemeHeight += 12;

      const col = i % 2;
      const xOffset = col * (schemeWidth + 10);
      const schemeX = margin + xOffset;

      checkNewPage(schemeHeight + 10);

      // Background
      if (isSelected) {
        currentPage.drawRectangle({
          x: schemeX,
          y: y - schemeHeight,
          width: schemeWidth,
          height: schemeHeight,
          color: selectedBg,
          borderColor: selectedBorder,
          borderWidth: 1,
        });
      } else {
        currentPage.drawRectangle({
          x: schemeX,
          y: y - schemeHeight,
          width: schemeWidth,
          height: schemeHeight,
          color: cardBg,
          borderColor: lightGray,
          borderWidth: 0.5,
        });
      }

      let lineY = y - 14;
      const padding = 10;

      // Scheme name
      currentPage.drawText(scheme.nombre, {
        x: schemeX + padding,
        y: lineY,
        size: 10,
        font: helveticaBold,
        color: black,
      });
      lineY -= 14;

      // Final price
      currentPage.drawText('Precio final:', { x: schemeX + padding, y: lineY, size: 8, font: helvetica, color: gray });
      currentPage.drawText(formatCurrency(amounts.finalPrice), {
        x: schemeX + schemeWidth - padding - helveticaBold.widthOfTextAtSize(formatCurrency(amounts.finalPrice), 8),
        y: lineY,
        size: 8,
        font: helveticaBold,
        color: black,
      });
      lineY -= 12;

      // Savings
      if (hasSavings) {
        currentPage.drawText('Ahorro:', { x: schemeX + padding, y: lineY, size: 8, font: helvetica, color: gray });
        const savingsText = `${Math.abs(scheme.porcentaje_descuento_aumento)}% ${formatCurrency(Math.abs(amounts.adjustment))}`;
        currentPage.drawText(savingsText, {
          x: schemeX + schemeWidth - padding - helveticaBold.widthOfTextAtSize(savingsText, 8),
          y: lineY,
          size: 8,
          font: helveticaBold,
          color: black,
        });
        lineY -= 12;
      }

      // Enganche
      if (scheme.porcentaje_enganche > 0) {
        currentPage.drawText(`Enganche (${scheme.porcentaje_enganche}%):`, {
          x: schemeX + padding,
          y: lineY,
          size: 8,
          font: helvetica,
          color: gray,
        });
        currentPage.drawText(formatCurrency(amounts.enganche), {
          x: schemeX + schemeWidth - padding - helveticaBold.widthOfTextAtSize(formatCurrency(amounts.enganche), 8),
          y: lineY,
          size: 8,
          font: helveticaBold,
          color: black,
        });
        lineY -= 12;
      }

      // Mensualidades
      if (scheme.porcentaje_mensualidades > 0 && scheme.numero_mensualidades > 0) {
        // Tiered payments (tramos_mensualidad)
        if (scheme.tramos_mensualidad && scheme.tramos_mensualidad.length > 0) {
          let mensualidadesAcumuladas = 0;
          for (let idx = 0; idx < scheme.tramos_mensualidad.length; idx++) {
            const tramo = scheme.tramos_mensualidad[idx];
            
            currentPage.drawText(`${tramo.numero_mensualidades} mensualidades:`, {
              x: schemeX + padding,
              y: lineY,
              size: 8,
              font: helvetica,
              color: gray,
            });
            
            let mensualidadText = formatCurrency(tramo.monto);
            if (idx > 0) {
              mensualidadText += ` (mes ${mensualidadesAcumuladas + 1}+)`;
            }
            
            currentPage.drawText(mensualidadText, {
              x: schemeX + schemeWidth - padding - helveticaBold.widthOfTextAtSize(mensualidadText, 8),
              y: lineY,
              size: 8,
              font: helveticaBold,
              color: black,
            });
            
            mensualidadesAcumuladas += tramo.numero_mensualidades;
            lineY -= 12;
          }
        } else {
          currentPage.drawText(`${scheme.numero_mensualidades} mensualidades:`, {
            x: schemeX + padding,
            y: lineY,
            size: 8,
            font: helvetica,
            color: gray,
          });
          currentPage.drawText(formatCurrency(amounts.mensualidad), {
            x: schemeX + schemeWidth - padding - helveticaBold.widthOfTextAtSize(formatCurrency(amounts.mensualidad), 8),
            y: lineY,
            size: 8,
            font: helveticaBold,
            color: black,
          });
          lineY -= 12;
        }
      }

      // Entrega
      if (scheme.porcentaje_entrega > 0) {
        currentPage.drawText(`A la entrega (${scheme.porcentaje_entrega}%):`, {
          x: schemeX + padding,
          y: lineY,
          size: 8,
          font: helvetica,
          color: gray,
        });
        currentPage.drawText(formatCurrency(amounts.entrega), {
          x: schemeX + schemeWidth - padding - helveticaBold.widthOfTextAtSize(formatCurrency(amounts.entrega), 8),
          y: lineY,
          size: 8,
          font: helveticaBold,
          color: black,
        });
      }

      // Move to next row
      if (col === 1 || i === displaySchemes.length - 1) {
        y -= schemeHeight + 10;
      }
    }
  }

  y -= 10;

  // ========== BANKING DATA ==========
  const hasValidRFC = isValidRFC(leadInfo?.rfc);
  const hasClabe = oferta.clabe_stp_tmp_producto || oferta.clabe_stp;
  const showCashPayment = proyecto?.mostrar_seccion_efectivo_en_oferta && ownerBankAccount;
  const showBanking = hasValidRFC && (hasClabe || showCashPayment);

  if (showBanking) {
    checkNewPage(80);

    currentPage.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: lightGray,
    });
    y -= 17;

    currentPage.drawText('Datos Bancarios', {
      x: margin,
      y,
      size: 11,
      font: helveticaBold,
      color: black,
    });
    y -= 17;

    const bankCardWidth = (hasClabe && showCashPayment) ? (contentWidth - 10) / 2 : contentWidth;
    const bankCardHeight = 70;

    // Transfer payment card
    if (hasClabe) {
      currentPage.drawRectangle({
        x: margin,
        y: y - bankCardHeight,
        width: bankCardWidth,
        height: bankCardHeight,
        color: dividerColor,
      });

      let bankY = y - 14;
      currentPage.drawText('Pago por transferencia', {
        x: margin + 10,
        y: bankY,
        size: 9,
        font: helveticaBold,
        color: black,
      });
      bankY -= 12;
      currentPage.drawText('Banco: Sistema de Transferencias y Pagos (STP)', {
        x: margin + 10,
        y: bankY,
        size: 8,
        font: helvetica,
        color: black,
      });
      bankY -= 12;
      currentPage.drawText(`Titular: ${ownerData?.nombre_legal || 'N/A'}`, {
        x: margin + 10,
        y: bankY,
        size: 8,
        font: helvetica,
        color: black,
      });
      bankY -= 12;
      currentPage.drawText(`Cuenta CLABE: ${oferta.clabe_stp_tmp_producto || oferta.clabe_stp}`, {
        x: margin + 10,
        y: bankY,
        size: 8,
        font: helvetica,
        color: black,
      });
    }

    // Cash payment card
    if (showCashPayment) {
      const cashX = hasClabe ? margin + bankCardWidth + 10 : margin;

      currentPage.drawRectangle({
        x: cashX,
        y: y - bankCardHeight,
        width: bankCardWidth,
        height: bankCardHeight,
        color: dividerColor,
      });

      let bankY = y - 14;
      currentPage.drawText('Pago en efectivo', {
        x: cashX + 10,
        y: bankY,
        size: 9,
        font: helveticaBold,
        color: black,
      });
      bankY -= 12;
      currentPage.drawText(`Banco: ${ownerBankAccount.banco_nombre || 'N/A'}`, {
        x: cashX + 10,
        y: bankY,
        size: 8,
        font: helvetica,
        color: black,
      });
      bankY -= 12;
      currentPage.drawText(`Titular: ${ownerData?.nombre_legal || 'N/A'}`, {
        x: cashX + 10,
        y: bankY,
        size: 8,
        font: helvetica,
        color: black,
      });
      bankY -= 12;
      currentPage.drawText(`Cuenta CLABE: ${ownerBankAccount.cuenta_clabe || 'N/A'}`, {
        x: cashX + 10,
        y: bankY,
        size: 8,
        font: helvetica,
        color: black,
      });
    }

    y -= bankCardHeight + 10;
  }

  // ========== CONTACT INFO ==========
  checkNewPage(60);

  currentPage.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: lightGray,
  });
  y -= 17;

  currentPage.drawText('Datos de Contacto:', {
    x: margin,
    y,
    size: 11,
    font: helveticaBold,
    color: black,
  });
  y -= 17;

  const contactColWidth = (contentWidth - 20) / 2;

  // Agent
  currentPage.drawText('Agente:', { x: margin, y, size: 9, font: helveticaBold, color: black });
  currentPage.drawText('Comprador:', { x: margin + contactColWidth + 20, y, size: 9, font: helveticaBold, color: black });
  y -= 14;

  const agentName = creatorInfo?.nombre_legal || oferta.email_creador;
  currentPage.drawText(`Nombre: ${agentName}`, { x: margin, y, size: 8, font: helvetica, color: black });
  currentPage.drawText(`Nombre: ${leadInfo?.nombre_legal || 'N/A'}`, { x: margin + contactColWidth + 20, y, size: 8, font: helvetica, color: black });
  y -= 11;

  currentPage.drawText(`Email: ${oferta.email_creador}`, { x: margin, y, size: 8, font: helvetica, color: black });
  currentPage.drawText(`Email: ${leadInfo?.email || 'N/A'}`, { x: margin + contactColWidth + 20, y, size: 8, font: helvetica, color: black });
  y -= 11;

  currentPage.drawText(`Teléfono: ${creatorInfo?.telefono || 'N/A'}`, { x: margin, y, size: 8, font: helvetica, color: black });
  if (leadInfo?.telefono) {
    currentPage.drawText(`Teléfono: ${leadInfo.telefono}`, { x: margin + contactColWidth + 20, y, size: 8, font: helvetica, color: black });
  }

  // Generate filename
  const cleanProjectName = (proyecto?.nombre || 'Proyecto').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanPropertyNumber = (propiedad?.numero_propiedad || 'NA').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanProductName = (producto.nombre || 'Producto').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  const offerNumber = oferta.id.toString().padStart(6, '0');

  const fileName = `OP_${offerNumber}_${cleanPropertyNumber}_${cleanProductName}_${cleanProjectName}_${Date.now()}.pdf`;

  const pdfBytes = await pdfDoc.save();
  console.log('Product offer PDF generated, size:', pdfBytes.length, 'bytes');

  return { pdfBytes, fileName };
}
