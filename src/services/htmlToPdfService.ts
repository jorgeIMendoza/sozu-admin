import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';

interface OfferData {
  propertyId: number;
  offerId: number;
  propertyNumber: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  creatorEmail: string;
}

interface PropertyDetails {
  id: number;
  numero_propiedad: string;
  precio_lista: number;
  m2_reales: number | null;
  m2_escriturables: number | null;
  descripcion: string | null;
  numero_piso?: number | null;
  clabe_stp_tmp_apartado?: string | null;
  building?: {
    id: number;
    nombre: string;
  };
  model?: {
    id: number;
    nombre: string;
    descripcion: string | null;
    numero_recamaras: number | null;
    numero_completo_banos: number | null;
    numero_medio_bano: number | null;
  };
  vista?: {
    id: number;
    nombre: string;
  };
  projectData?: {
    id: number;
    nombre: string;
    url_imagen_portada?: string;
    mostrar_precio_m2_en_oferta?: boolean;
    mostrar_piso_en_oferta?: boolean;
    mostrar_seccion_efectivo_en_oferta?: boolean;
    mostrar_estacionamientos_en_oferta?: boolean;
    mostrar_bodega_en_oferta?: boolean;
    mostrar_modelo_en_oferta?: boolean;
    mostrar_edificio_en_oferta?: boolean;
    precio_m2?: number;
  };
  ownerData?: {
    id: number;
    nombre_legal: string;
    email: string;
    telefono: string | null;
  };
}

interface PaymentScheme {
  id: number;
  nombre: string;
  porcentaje_enganche: number;
  numero_mensualidades: number;
  porcentaje_mensualidades: number;
  porcentaje_entrega: number;
  porcentaje_descuento_aumento: number;
  es_manual: boolean;
}

interface ProjectAmenity {
  id: number;
  nombre: string;
  url: string | null;
}

class HTMLToPDFService {
  private doc: jsPDF;
  private currentY: number = 0;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;

  constructor() {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  async generateOfferPDF(offerData: OfferData): Promise<void> {
    try {
      console.log('Starting PDF generation for offer:', offerData.offerId);

      // Fetch offer details from database
      const { data: offerDetails, error: offerError } = await supabase
        .from('ofertas')
        .select('*')
        .eq('id', offerData.offerId)
        .single();

      if (offerError || !offerDetails) {
        throw new Error('Error fetching offer details');
      }

      // Fetch all required data
      const [propertyDetails, paymentSchemes, amenities, creatorInfo, leadInfo, legalNotices, estacionamientos, bodegas] = await Promise.all([
        this.fetchPropertyDetails(offerData.propertyId),
        this.fetchPaymentSchemes(offerData.propertyId, offerData.offerId),
        this.fetchProjectAmenities(offerData.propertyId),
        this.fetchCreatorInfo(offerDetails.email_creador),
        this.fetchLeadInfo(offerDetails.id_persona_lead),
        this.fetchLegalNotices(offerData.propertyId),
        this.fetchEstacionamientos(offerData.propertyId),
        this.fetchBodegas(offerData.propertyId)
      ]);

      console.log('Data fetched successfully, generating PDF...');

      // Transform data for the template
      const templateOfferData = {
        id: offerData.offerId,
        fecha_generacion: offerDetails.fecha_generacion,
        propertyNumber: offerData.propertyNumber,
        leadName: offerData.leadName,
        leadEmail: offerData.leadEmail,
      };

      // Generate PDF pages
      await this.generateCoverPage(templateOfferData, propertyDetails, creatorInfo, leadInfo);
      this.addNewPage(); // Página 2: Opciones de pago
      this.generatePaymentOptionsPage(propertyDetails, paymentSchemes);
      this.addNewPage(); // Página 3: Datos bancarios
      await this.generateBankingDataPage(propertyDetails, legalNotices);

      // Generate filename
      const projectName = propertyDetails.projectData?.nombre || 'Proyecto';
      const propertyNumber = propertyDetails.numero_propiedad || 'N/A';
      const offerNumber = offerData.offerId.toString().padStart(6, '0') || '000000';
      
      const cleanProjectName = projectName.replace(/[^a-zA-Z0-9]/g, '_');
      const cleanPropertyNumber = propertyNumber.replace(/[^a-zA-Z0-9]/g, '_');
      
      const filename = `Oferta_${cleanPropertyNumber}_${cleanProjectName}_${offerNumber}.pdf`;

      // Download the PDF
      this.doc.save(filename);
      console.log('PDF generated successfully:', filename);

    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  private async generateCoverPage(
    offerData: any,
    propertyDetails: PropertyDetails,
    creatorInfo: any,
    leadInfo: any
  ): Promise<void> {
    this.currentY = this.margin;

    // Title
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('OFERTA DE COMPRA VENTA', this.pageWidth / 2, this.currentY, { align: 'center' });
    this.currentY += 15;

    // Offer number and date
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Oferta N°: ${this.formatOfferNumber(offerData.id)}`, this.pageWidth / 2, this.currentY, { align: 'center' });
    this.currentY += 8;
    
    const fecha = new Date(offerData.fecha_generacion).toLocaleDateString('es-MX');
    this.doc.text(`Fecha: ${fecha}`, this.pageWidth / 2, this.currentY, { align: 'center' });
    this.currentY += 20;

    // Project image
    if (propertyDetails.projectData?.url_imagen_portada) {
      try {
        await this.addImageToPDF(propertyDetails.projectData.url_imagen_portada, this.margin, this.currentY, 170, 100);
        this.currentY += 110;
      } catch (error) {
        console.log('Could not load project image');
        this.currentY += 20;
      }
    }

    // Property details section
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('DETALLES DE LA PROPIEDAD', this.margin, this.currentY);
    this.currentY += 12;

    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    
    // Project name
    if (propertyDetails.projectData?.nombre) {
      this.doc.text(`Proyecto: ${propertyDetails.projectData.nombre}`, this.margin, this.currentY);
      this.currentY += 8;
    }

    // Building
    if (propertyDetails.building?.nombre && propertyDetails.projectData?.mostrar_edificio_en_oferta) {
      this.doc.text(`Edificio: ${propertyDetails.building.nombre}`, this.margin, this.currentY);
      this.currentY += 8;
    }

    // Property number
    this.doc.text(`Departamento: ${propertyDetails.numero_propiedad}`, this.margin, this.currentY);
    this.currentY += 8;

    // Model
    if (propertyDetails.model?.nombre && propertyDetails.projectData?.mostrar_modelo_en_oferta) {
      this.doc.text(`Modelo: ${propertyDetails.model.nombre}`, this.margin, this.currentY);
      this.currentY += 8;
    }

    // Floor
    if (propertyDetails.numero_piso && propertyDetails.projectData?.mostrar_piso_en_oferta) {
      this.doc.text(`Piso: ${propertyDetails.numero_piso}`, this.margin, this.currentY);
      this.currentY += 8;
    }

    // Areas
    if (propertyDetails.m2_reales) {
      this.doc.text(`Área real: ${propertyDetails.m2_reales} m²`, this.margin, this.currentY);
      this.currentY += 8;
    }

    if (propertyDetails.m2_escriturables) {
      this.doc.text(`Área escriturable: ${propertyDetails.m2_escriturables} m²`, this.margin, this.currentY);
      this.currentY += 8;
    }

    // Price
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`Precio: ${this.formatCurrency(propertyDetails.precio_lista)}`, this.margin, this.currentY);
    this.currentY += 8;

    // Price per m2
    if (propertyDetails.projectData?.mostrar_precio_m2_en_oferta && propertyDetails.projectData?.precio_m2) {
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`Precio por m²: ${this.formatCurrency(propertyDetails.projectData.precio_m2)}`, this.margin, this.currentY);
      this.currentY += 15;
    }

    // Contact information
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('INFORMACIÓN DE CONTACTO', this.margin, this.currentY);
    this.currentY += 12;

    // Lead info
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Cliente:', this.margin, this.currentY);
    this.currentY += 8;

    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Nombre: ${offerData.leadName}`, this.margin, this.currentY);
    this.currentY += 6;
    this.doc.text(`Email: ${offerData.leadEmail}`, this.margin, this.currentY);
    this.currentY += 10;

    // Creator info
    if (creatorInfo) {
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Agente:', this.margin, this.currentY);
      this.currentY += 8;

      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`Nombre: ${creatorInfo.nombre_legal || creatorInfo.email}`, this.margin, this.currentY);
      this.currentY += 6;
      this.doc.text(`Email: ${creatorInfo.email}`, this.margin, this.currentY);
      
      if (creatorInfo.telefono) {
        this.currentY += 6;
        this.doc.text(`Teléfono: ${creatorInfo.telefono}`, this.margin, this.currentY);
      }
    }
  }

  private generatePaymentOptionsPage(propertyDetails: PropertyDetails, paymentSchemes: PaymentScheme[]): void {
    this.currentY = this.margin;

    // Title
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('OPCIONES DE PAGO DISPONIBLES', this.pageWidth / 2, this.currentY, { align: 'center' });
    this.currentY += 20;

    if (paymentSchemes.length === 0) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text('No hay esquemas de pago disponibles para esta propiedad.', this.margin, this.currentY);
      return;
    }

    paymentSchemes.forEach((scheme, index) => {
      if (this.currentY > this.pageHeight - 60) {
        this.addNewPage();
        this.currentY = this.margin;
      }

      // Scheme title
      this.doc.setFontSize(16);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${index + 1}. ${scheme.nombre}`, this.margin, this.currentY);
      this.currentY += 12;

      // Calculate amounts
      const amounts = this.calculatePaymentAmounts(scheme, propertyDetails);

      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'normal');

      // Down payment
      this.doc.text(`Enganche (${scheme.porcentaje_enganche}%): ${this.formatCurrency(amounts.downPayment)}`, this.margin + 10, this.currentY);
      this.currentY += 8;

      // Monthly payments
      if (scheme.numero_mensualidades > 0) {
        this.doc.text(`${scheme.numero_mensualidades} mensualidades de: ${this.formatCurrency(amounts.monthlyPayment)}`, this.margin + 10, this.currentY);
        this.currentY += 8;
      }

      // Final payment
      if (scheme.porcentaje_entrega > 0) {
        this.doc.text(`Pago final (${scheme.porcentaje_entrega}%): ${this.formatCurrency(amounts.finalPayment)}`, this.margin + 10, this.currentY);
        this.currentY += 8;
      }

      // Total price
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`Precio final: ${this.formatCurrency(amounts.totalPrice)}`, this.margin + 10, this.currentY);
      this.currentY += 15;
      this.doc.setFont('helvetica', 'normal');

      // Add separator line
      if (index < paymentSchemes.length - 1) {
        this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
        this.currentY += 10;
      }
    });

    // Cash payment section
    if (propertyDetails.projectData?.mostrar_seccion_efectivo_en_oferta) {
      this.currentY += 20;
      
      if (this.currentY > this.pageHeight - 40) {
        this.addNewPage();
        this.currentY = this.margin;
      }

      this.doc.setFontSize(16);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('PAGO DE CONTADO', this.margin, this.currentY);
      this.currentY += 12;

      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`Precio de lista: ${this.formatCurrency(propertyDetails.precio_lista)}`, this.margin + 10, this.currentY);
      this.currentY += 8;
      this.doc.text('Beneficios del pago de contado:', this.margin + 10, this.currentY);
      this.currentY += 8;
      this.doc.text('• Sin intereses', this.margin + 20, this.currentY);
      this.currentY += 6;
      this.doc.text('• Proceso más rápido', this.margin + 20, this.currentY);
      this.currentY += 6;
      this.doc.text('• Posibles descuentos adicionales', this.margin + 20, this.currentY);
    }
  }

  private async generateBankingDataPage(propertyDetails: PropertyDetails, legalNotices: string[]): Promise<void> {
    this.currentY = this.margin;

    // Title
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('DATOS BANCARIOS', this.pageWidth / 2, this.currentY, { align: 'center' });
    this.currentY += 20;

    // Banking information
    if (propertyDetails.clabe_stp_tmp_apartado) {
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Información para apartado temporal:', this.margin, this.currentY);
      this.currentY += 12;

      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`CLABE: ${propertyDetails.clabe_stp_tmp_apartado}`, this.margin, this.currentY);
      this.currentY += 8;

      this.doc.text('Esta CLABE es únicamente para el apartado temporal de la propiedad.', this.margin, this.currentY);
      this.currentY += 8;
      this.doc.text('Para los pagos del esquema seleccionado, se proporcionarán datos bancarios específicos.', this.margin, this.currentY);
      this.currentY += 20;
    }

    // Owner information
    if (propertyDetails.ownerData) {
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Información del propietario:', this.margin, this.currentY);
      this.currentY += 12;

      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`Nombre: ${propertyDetails.ownerData.nombre_legal}`, this.margin, this.currentY);
      this.currentY += 8;
      this.doc.text(`Email: ${propertyDetails.ownerData.email}`, this.margin, this.currentY);
      this.currentY += 8;
      
      if (propertyDetails.ownerData.telefono) {
        this.doc.text(`Teléfono: ${propertyDetails.ownerData.telefono}`, this.margin, this.currentY);
        this.currentY += 20;
      }
    }

    // Legal notices
    if (legalNotices.length > 0) {
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('AVISOS LEGALES', this.margin, this.currentY);
      this.currentY += 12;

      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');

      legalNotices.forEach((notice) => {
        if (this.currentY > this.pageHeight - 30) {
          this.addNewPage();
          this.currentY = this.margin;
        }

        const lines = this.doc.splitTextToSize(notice, this.pageWidth - (2 * this.margin));
        lines.forEach((line: string) => {
          this.doc.text(line, this.margin, this.currentY);
          this.currentY += 5;
        });
        this.currentY += 5;
      });
    }

    // Footer
    this.currentY = this.pageHeight - 30;
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'italic');
    this.doc.text('Esta oferta tiene una validez de 30 días a partir de la fecha de generación.', this.pageWidth / 2, this.currentY, { align: 'center' });
  }

  private addNewPage(): void {
    this.doc.addPage();
    this.currentY = this.margin;
  }

  private async addImageToPDF(imageUrl: string, x: number, y: number, width: number, height: number): Promise<void> {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      // Create a canvas to convert the image
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imgData = canvas.toDataURL('image/jpeg', 0.8);
        this.doc.addImage(imgData, 'JPEG', x, y, width, height);
      }
    } catch (error) {
      console.error('Error adding image to PDF:', error);
      throw error;
    }
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private formatOfferNumber(offerId: number): string {
    return `OF-${offerId.toString().padStart(6, '0')}`;
  }

  private calculatePaymentAmounts(scheme: PaymentScheme, propertyDetails: PropertyDetails) {
    const basePrice = propertyDetails.precio_lista;
    const adjustmentFactor = 1 + (scheme.porcentaje_descuento_aumento / 100);
    const totalPrice = basePrice * adjustmentFactor;

    const downPayment = totalPrice * (scheme.porcentaje_enganche / 100);
    const finalPayment = totalPrice * (scheme.porcentaje_entrega / 100);
    const monthlyAmount = totalPrice * (scheme.porcentaje_mensualidades / 100);
    const monthlyPayment = scheme.numero_mensualidades > 0 ? monthlyAmount / scheme.numero_mensualidades : 0;

    return {
      totalPrice,
      downPayment,
      monthlyPayment,
      finalPayment,
    };
  }

  // Data fetching methods (keeping the same implementation)
  private async fetchPropertyDetails(propertyId: number): Promise<PropertyDetails> {
    console.log('Fetching property details for ID:', propertyId);

    const { data: propiedad, error: propiedadError } = await supabase
      .from('propiedades')
      .select(`
        id,
        numero_propiedad,
        precio_lista,
        m2_reales,
        m2_escriturables,
        descripcion,
        numero_piso,
        clabe_stp_tmp_apartado,
        id_edificio_modelo,
        id_vista,
        id_entidad_relacionada_dueno
      `)
      .eq('id', propertyId)
      .single();

    if (propiedadError) {
      console.error('Error fetching property:', propiedadError);
      throw propiedadError;
    }

    let building = null;
    let model = null;
    let projectData = null;

    // Get building and model data
    if (propiedad.id_edificio_modelo) {
      const { data: edificioModelo } = await supabase
        .from('edificios_modelos')
        .select('id_edificio, id_modelo')
        .eq('id', propiedad.id_edificio_modelo)
        .single();

      if (edificioModelo) {
        // Get building data
        const { data: edificioData } = await supabase
          .from('edificios')
          .select('id, nombre, id_proyecto')
          .eq('id', edificioModelo.id_edificio)
          .single();

        if (edificioData) {
          building = {
            id: edificioData.id,
            nombre: edificioData.nombre,
          };

          // Get project data
          if (edificioData.id_proyecto) {
            const { data: proyecto } = await supabase
              .from('proyectos')
              .select(`
                id, 
                nombre, 
                url_imagen_portada,
                mostrar_precio_m2_en_oferta,
                mostrar_piso_en_oferta,
                mostrar_seccion_efectivo_en_oferta,
                mostrar_estacionamientos_en_oferta,
                mostrar_bodega_en_oferta,
                mostrar_modelo_en_oferta,
                mostrar_edificio_en_oferta,
                precio_m2
              `)
              .eq('id', edificioData.id_proyecto)
              .single();

            if (proyecto) {
              projectData = proyecto;
            }
          }
        }

        // Get model data
        const { data: modeloData } = await supabase
          .from('modelos')
          .select('id, nombre, descripcion, numero_recamaras, numero_completo_banos, numero_medio_bano')
          .eq('id', edificioModelo.id_modelo)
          .single();

        if (modeloData) {
          model = {
            id: modeloData.id,
            nombre: modeloData.nombre,
            descripcion: modeloData.descripcion,
            numero_recamaras: modeloData.numero_recamaras,
            numero_completo_banos: modeloData.numero_completo_banos,
            numero_medio_bano: modeloData.numero_medio_bano,
          };
        }
      }
    }

    // Get vista data
    let vista = null;
    if (propiedad.id_vista) {
      const { data: vistaData } = await supabase
        .from('vistas')
        .select('id, nombre')
        .eq('id', propiedad.id_vista)
        .single();

      if (vistaData) {
        vista = vistaData;
      }
    }

    // Get owner data
    let ownerData = null;
    if (propiedad.id_entidad_relacionada_dueno) {
      const { data: entidadData } = await supabase
        .from('entidades_relacionadas')
        .select('id_persona')
        .eq('id', propiedad.id_entidad_relacionada_dueno)
        .single();

      if (entidadData?.id_persona) {
        const { data: personaData } = await supabase
          .from('personas')
          .select('id, nombre_legal, email, telefono')
          .eq('id', entidadData.id_persona)
          .single();

        if (personaData) {
          ownerData = {
            id: personaData.id,
            nombre_legal: personaData.nombre_legal,
            email: personaData.email,
            telefono: personaData.telefono,
          };
        }
      }
    }

    return {
      id: propiedad.id,
      numero_propiedad: propiedad.numero_propiedad,
      precio_lista: propiedad.precio_lista,
      m2_reales: propiedad.m2_reales,
      m2_escriturables: propiedad.m2_escriturables,
      descripcion: propiedad.descripcion,
      numero_piso: propiedad.numero_piso,
      clabe_stp_tmp_apartado: propiedad.clabe_stp_tmp_apartado,
      building,
      model,
      vista,
      projectData,
      ownerData,
    };
  }

  private async fetchPaymentSchemes(propertyId: number, offerId: number): Promise<PaymentScheme[]> {
    console.log('Fetching payment schemes for property:', propertyId, 'and offer:', offerId);

    // First, get the specific payment scheme selected for this offer
    const { data: offerData } = await supabase
      .from('ofertas')
      .select('id_esquema_pago_seleccionado')
      .eq('id', offerId)
      .maybeSingle();

    // If there's a specific payment scheme selected (manual or pre-defined), return only that one
    if (offerData?.id_esquema_pago_seleccionado) {
      const { data: specificScheme, error: specificError } = await supabase
        .from('esquemas_pago')
        .select('*')
        .eq('id', offerData.id_esquema_pago_seleccionado)
        .eq('activo', true)
        .maybeSingle();

      if (specificError) throw specificError;
      console.log('Found specific payment scheme for offer:', specificScheme);
      return specificScheme ? [specificScheme] : [];
    }

    // Fallback: If no specific scheme selected, get the project ID from the property
    const { data: propertyData } = await supabase
      .from('propiedades')
      .select('id_edificio_modelo')
      .eq('id', propertyId)
      .single();

    if (!propertyData?.id_edificio_modelo) {
      console.log('No building model found for property');
      return [];
    }

    const { data: edificioModelo } = await supabase
      .from('edificios_modelos')
      .select('id_edificio')
      .eq('id', propertyData.id_edificio_modelo)
      .single();

    if (!edificioModelo?.id_edificio) {
      console.log('No building found for property');
      return [];
    }

    const { data: edificio } = await supabase
      .from('edificios')
      .select('id_proyecto')
      .eq('id', edificioModelo.id_edificio)
      .single();

    if (!edificio?.id_proyecto) {
      console.log('No project found for property');
      return [];
    }

    const projectId = edificio.id_proyecto;

    const { data: schemes, error } = await supabase
      .from('esquemas_pago')
      .select('*')
      .eq('id_proyecto', projectId)
      .eq('activo', true)
      .order('id');

    if (error) {
      console.error('Error fetching payment schemes:', error);
      return [];
    }

    return schemes || [];
  }

  private async fetchProjectAmenities(propertyId: number): Promise<ProjectAmenity[]> {
    console.log('Fetching project amenities for property:', propertyId);

    // First get the project ID from the property
    const { data: propertyData } = await supabase
      .from('propiedades')
      .select('id_edificio_modelo')
      .eq('id', propertyId)
      .single();

    if (!propertyData?.id_edificio_modelo) {
      console.log('No building model found for property');
      return [];
    }

    const { data: edificioModelo } = await supabase
      .from('edificios_modelos')
      .select('id_edificio')
      .eq('id', propertyData.id_edificio_modelo)
      .single();

    if (!edificioModelo?.id_edificio) {
      console.log('No building found for property');
      return [];
    }

    const { data: edificio } = await supabase
      .from('edificios')
      .select('id_proyecto')
      .eq('id', edificioModelo.id_edificio)
      .single();

    if (!edificio?.id_proyecto) {
      console.log('No project found for property');
      return [];
    }

    const projectId = edificio.id_proyecto;

    // Join amenidades_proyectos with amenidades to get the actual amenity data
    const { data: amenities, error } = await supabase
      .from('amenidades_proyectos')
      .select(`
        amenidades:id_amenidad (
          id,
          nombre,
          url
        )
      `)
      .eq('id_proyecto', projectId)
      .eq('activo', true);

    if (error) {
      console.error('Error fetching project amenities:', error);
      return [];
    }

    // Transform the nested structure to flat array
    const transformedAmenities = amenities
      ?.map(item => item.amenidades)
      .filter(amenity => amenity !== null)  // Just filter out null values
      .map(amenity => ({
        id: amenity.id,
        nombre: amenity.nombre,
        url: amenity.url
      })) || [];

    return transformedAmenities;
  }

  private async fetchCreatorInfo(creatorEmail: string): Promise<any> {
    console.log('Fetching creator info for email:', creatorEmail);

    const { data: personData, error } = await supabase
      .from('personas')
      .select('id, nombre_legal, email, telefono')
      .eq('email', creatorEmail)
      .maybeSingle();

    if (error) {
      console.error('Error fetching creator info:', error);
      return null;
    }

    return personData;
  }

  private async fetchLeadInfo(leadId: number | null): Promise<any> {
    if (!leadId) {
      console.log('No lead ID provided');
      return null;
    }

    console.log('Fetching lead info for ID:', leadId);

    const { data: leadData, error } = await supabase
      .from('personas')
      .select('id, nombre_legal, email, telefono')
      .eq('id', leadId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching lead info:', error);
      return null;
    }

    return leadData;
  }

  private async fetchLegalNotices(propertyId: number): Promise<string[]> {
    console.log('Fetching legal notices for property:', propertyId);

    // Get project ID from property
    const { data: propertyData } = await supabase
      .from('propiedades')
      .select('id_edificio_modelo')
      .eq('id', propertyId)
      .single();

    if (!propertyData?.id_edificio_modelo) return [];

    const { data: edificioModelo } = await supabase
      .from('edificios_modelos')
      .select('id_edificio')
      .eq('id', propertyData.id_edificio_modelo)
      .single();

    if (!edificioModelo?.id_edificio) return [];

    const { data: edificio } = await supabase
      .from('edificios')
      .select('id_proyecto')
      .eq('id', edificioModelo.id_edificio)
      .single();

    if (!edificio?.id_proyecto) return [];

    const { data: notices, error } = await supabase
      .from('avisos_legales')
      .select('contenido')
      .eq('id_proyecto', edificio.id_proyecto)
      .eq('activo', true)
      .order('orden');

    if (error) {
      console.error('Error fetching legal notices:', error);
      return [];
    }

    return notices?.map(notice => notice.contenido) || [];
  }

  private async fetchEstacionamientos(propertyId: number): Promise<any[]> {
    console.log('Fetching parking spaces for property:', propertyId);

    const { data: estacionamientos, error } = await supabase
      .from('estacionamientos')
      .select('*')
      .eq('id_propiedad', propertyId)
      .eq('activo', true);

    if (error) {
      console.error('Error fetching parking spaces:', error);
      return [];
    }

    return estacionamientos || [];
  }

  private async fetchBodegas(propertyId: number): Promise<any[]> {
    console.log('Fetching storage units for property:', propertyId);

    const { data: bodegas, error } = await supabase
      .from('bodegas')
      .select('*')
      .eq('id_propiedad', propertyId)
      .eq('activo', true);

    if (error) {
      console.error('Error fetching storage units:', error);
      return [];
    }

    return bodegas || [];
  }
}

// Export the main function
export async function generateOfferPDF(offerData: OfferData): Promise<void> {
  const service = new HTMLToPDFService();
  await service.generateOfferPDF(offerData);
}
