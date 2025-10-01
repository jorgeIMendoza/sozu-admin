import { forwardRef } from 'react';

interface OfferData {
  id: number;
  fecha_generacion: string;
  email_creador: string;
  id_persona_lead: number;
  id_propiedad: number;
  id_esquema_pago_seleccionado: number | null;
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
  ownerStpBankAccount?: {
    numero_cuenta: string;
    cuenta_clabe: string;
    cuenta_swift: string;
    banco_nombre: string;
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

interface OfferPDFTemplateSozuProps {
  offerData: {
    id: number;
    fecha_generacion: string;
    propertyNumber: string;
    leadName: string;
    leadEmail: string;
  };
  propertyDetails: PropertyDetails;
  paymentSchemes: PaymentScheme[];
  amenities: ProjectAmenity[];
  creatorInfo: any;
  leadInfo: any;
  legalNotices: string[];
  estacionamientos: any[];
  bodegas: any[];
}

export const OfferPDFTemplateSozu = forwardRef<HTMLDivElement, OfferPDFTemplateSozuProps>(
  ({ offerData, propertyDetails, paymentSchemes, amenities, creatorInfo, leadInfo, legalNotices, estacionamientos, bodegas }, ref) => {
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
      }).format(amount);
    };

    const formatOfferNumber = (offerId: number) => {
      return `OC-${offerId.toString().padStart(6, '0')}`;
    };

    const selectedPaymentScheme = paymentSchemes[0];
    
    const filteredPaymentSchemes = selectedPaymentScheme?.es_manual 
      ? paymentSchemes.filter(scheme => scheme.es_manual)
      : paymentSchemes.filter(scheme => !scheme.es_manual);

    const calculatePaymentAmounts = (scheme: PaymentScheme) => {
      const basePrice = propertyDetails.precio_lista;
      const discount = basePrice * (scheme.porcentaje_descuento_aumento / 100);
      const finalPrice = basePrice - discount;
      
      return {
        enganche: finalPrice * (scheme.porcentaje_enganche / 100),
        mensualidad: (finalPrice * (scheme.porcentaje_mensualidades / 100)) / scheme.numero_mensualidades,
        entrega: finalPrice * (scheme.porcentaje_entrega / 100),
        finalPrice,
        discount
      };
    };

    return (
      <div ref={ref} className="bg-white" style={{ width: '2550px', minHeight: '3300px', fontFamily: 'Arial, sans-serif', position: 'relative' }}>
        {/* Header Section */}
        <div style={{ padding: '60px 80px 40px 80px' }}>
          {/* Logo and Title Area */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
            <div>
              <h1 style={{ fontSize: '48px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '12px', lineHeight: '1.2' }}>
                {propertyDetails.projectData?.nombre || 'Dotar Expedición'}
              </h1>
              <p style={{ fontSize: '24px', color: '#585858', fontWeight: '500' }}>
                Orden de Compra: {formatOfferNumber(offerData.id)}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '20px', color: '#585858', marginBottom: '4px' }}>
                Fecha: {new Date(offerData.fecha_generacion).toLocaleDateString('es-MX')}
              </p>
            </div>
          </div>

          {/* Property Image */}
          {propertyDetails.projectData?.url_imagen_portada && (
            <div style={{ marginBottom: '40px', borderRadius: '8px', overflow: 'hidden' }}>
              <img
                src={propertyDetails.projectData.url_imagen_portada}
                alt="Proyecto"
                style={{ width: '100%', height: '600px', objectFit: 'cover' }}
              />
            </div>
          )}

          {/* Property Information Section */}
          <div style={{ backgroundColor: '#f8f8f8', padding: '40px', borderRadius: '8px', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '36px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '30px', borderBottom: '3px solid #1a1a1a', paddingBottom: '15px' }}>
              Datos del Inmueble
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', fontSize: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #d0d0d0' }}>
                <span style={{ color: '#585858', fontWeight: '500' }}>Departamento:</span>
                <span style={{ color: '#1a1a1a', fontWeight: 'bold' }}>{propertyDetails.numero_propiedad}</span>
              </div>
              
              {propertyDetails.model && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #d0d0d0' }}>
                  <span style={{ color: '#585858', fontWeight: '500' }}>Modelo:</span>
                  <span style={{ color: '#1a1a1a', fontWeight: 'bold' }}>{propertyDetails.model.nombre}</span>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #d0d0d0' }}>
                <span style={{ color: '#585858', fontWeight: '500' }}>Recámaras:</span>
                <span style={{ color: '#1a1a1a', fontWeight: 'bold' }}>{propertyDetails.model?.numero_recamaras || 'N/A'}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #d0d0d0' }}>
                <span style={{ color: '#585858', fontWeight: '500' }}>Baños:</span>
                <span style={{ color: '#1a1a1a', fontWeight: 'bold' }}>
                  {propertyDetails.model?.numero_completo_banos || 0} + {propertyDetails.model?.numero_medio_bano || 0} medios
                </span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #d0d0d0' }}>
                <span style={{ color: '#585858', fontWeight: '500' }}>M² Construidos:</span>
                <span style={{ color: '#1a1a1a', fontWeight: 'bold' }}>{propertyDetails.m2_reales?.toFixed(2) || 'N/A'} m²</span>
              </div>
              
              {propertyDetails.building && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #d0d0d0' }}>
                  <span style={{ color: '#585858', fontWeight: '500' }}>Edificio:</span>
                  <span style={{ color: '#1a1a1a', fontWeight: 'bold' }}>{propertyDetails.building.nombre}</span>
                </div>
              )}
              
              {propertyDetails.numero_piso && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #d0d0d0' }}>
                  <span style={{ color: '#585858', fontWeight: '500' }}>Piso:</span>
                  <span style={{ color: '#1a1a1a', fontWeight: 'bold' }}>{propertyDetails.numero_piso}</span>
                </div>
              )}
              
              {propertyDetails.vista && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #d0d0d0' }}>
                  <span style={{ color: '#585858', fontWeight: '500' }}>Vista:</span>
                  <span style={{ color: '#1a1a1a', fontWeight: 'bold' }}>{propertyDetails.vista.nombre}</span>
                </div>
              )}
            </div>

            {/* Price Section */}
            <div style={{ marginTop: '40px', padding: '30px', backgroundColor: '#fff', borderRadius: '8px', border: '2px solid #1a1a1a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '28px', color: '#585858', fontWeight: '600' }}>Precio de Lista:</span>
                <span style={{ fontSize: '42px', color: '#1a1a1a', fontWeight: 'bold' }}>{formatCurrency(propertyDetails.precio_lista)}</span>
              </div>
            </div>
          </div>

          {/* Payment Schemes Section */}
          {filteredPaymentSchemes.length > 0 && (
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '36px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '30px', borderBottom: '3px solid #1a1a1a', paddingBottom: '15px' }}>
                Esquemas de Pago
              </h2>
              
              {filteredPaymentSchemes.map((scheme, index) => {
                const amounts = calculatePaymentAmounts(scheme);
                return (
                  <div key={scheme.id} style={{ backgroundColor: index % 2 === 0 ? '#f8f8f8' : '#fff', padding: '30px', marginBottom: '20px', borderRadius: '8px', border: '1px solid #d0d0d0' }}>
                    <h3 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '25px' }}>
                      {scheme.nombre}
                      {scheme.porcentaje_descuento_aumento !== 0 && (
                        <span style={{ fontSize: '22px', color: scheme.porcentaje_descuento_aumento > 0 ? '#dc2626' : '#16a34a', marginLeft: '15px' }}>
                          ({scheme.porcentaje_descuento_aumento > 0 ? '+' : ''}{scheme.porcentaje_descuento_aumento}%)
                        </span>
                      )}
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '30px', fontSize: '20px' }}>
                      <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #d0d0d0' }}>
                        <p style={{ color: '#585858', marginBottom: '10px', fontWeight: '500' }}>Enganche ({scheme.porcentaje_enganche}%)</p>
                        <p style={{ color: '#1a1a1a', fontSize: '26px', fontWeight: 'bold' }}>{formatCurrency(amounts.enganche)}</p>
                      </div>
                      
                      <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #d0d0d0' }}>
                        <p style={{ color: '#585858', marginBottom: '10px', fontWeight: '500' }}>
                          Mensualidades ({scheme.numero_mensualidades} meses)
                        </p>
                        <p style={{ color: '#1a1a1a', fontSize: '26px', fontWeight: 'bold' }}>{formatCurrency(amounts.mensualidad)}</p>
                        <p style={{ color: '#585858', fontSize: '16px', marginTop: '5px' }}>
                          Total: {formatCurrency(amounts.mensualidad * scheme.numero_mensualidades)}
                        </p>
                      </div>
                      
                      <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #d0d0d0' }}>
                        <p style={{ color: '#585858', marginBottom: '10px', fontWeight: '500' }}>Contra Entrega ({scheme.porcentaje_entrega}%)</p>
                        <p style={{ color: '#1a1a1a', fontSize: '26px', fontWeight: 'bold' }}>{formatCurrency(amounts.entrega)}</p>
                      </div>
                    </div>
                    
                    <div style={{ marginTop: '25px', padding: '20px', backgroundColor: '#1a1a1a', borderRadius: '6px', textAlign: 'center' }}>
                      <span style={{ color: '#fff', fontSize: '22px', fontWeight: '500', marginRight: '15px' }}>Precio Final:</span>
                      <span style={{ color: '#fff', fontSize: '32px', fontWeight: 'bold' }}>{formatCurrency(amounts.finalPrice)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Amenities Section */}
          {amenities.length > 0 && (
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '36px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '30px', borderBottom: '3px solid #1a1a1a', paddingBottom: '15px' }}>
                Amenidades
              </h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '25px' }}>
                {amenities.map((amenity) => (
                  <div key={amenity.id} style={{ padding: '20px', backgroundColor: '#f8f8f8', borderRadius: '8px', textAlign: 'center', border: '1px solid #d0d0d0' }}>
                    {amenity.url && (
                      <img
                        src={amenity.url}
                        alt={amenity.nombre}
                        style={{ width: '60px', height: '60px', marginBottom: '15px', objectFit: 'contain' }}
                      />
                    )}
                    <p style={{ fontSize: '18px', color: '#1a1a1a', fontWeight: '500' }}>{amenity.nombre}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact Information */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '40px' }}>
            {/* Agent Contact */}
            <div style={{ backgroundColor: '#f8f8f8', padding: '30px', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '20px' }}>Agente</h3>
              <div style={{ fontSize: '20px', lineHeight: '1.8' }}>
                <p style={{ color: '#585858' }}>
                  <span style={{ fontWeight: '600' }}>Nombre:</span> {creatorInfo?.nombre || 'N/A'}
                </p>
                <p style={{ color: '#585858' }}>
                  <span style={{ fontWeight: '600' }}>Email:</span> {creatorInfo?.email || offerData.leadEmail}
                </p>
                {creatorInfo?.telefono && (
                  <p style={{ color: '#585858' }}>
                    <span style={{ fontWeight: '600' }}>Teléfono:</span> {creatorInfo.telefono}
                  </p>
                )}
              </div>
            </div>

            {/* Client Contact */}
            <div style={{ backgroundColor: '#f8f8f8', padding: '30px', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '20px' }}>Cliente</h3>
              <div style={{ fontSize: '20px', lineHeight: '1.8' }}>
                <p style={{ color: '#585858' }}>
                  <span style={{ fontWeight: '600' }}>Nombre:</span> {leadInfo?.nombre_legal || offerData.leadName}
                </p>
                <p style={{ color: '#585858' }}>
                  <span style={{ fontWeight: '600' }}>Email:</span> {leadInfo?.email || offerData.leadEmail}
                </p>
                {leadInfo?.telefono && (
                  <p style={{ color: '#585858' }}>
                    <span style={{ fontWeight: '600' }}>Teléfono:</span> {leadInfo.telefono}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Banking Information */}
          {propertyDetails.ownerStpBankAccount && (
            <div style={{ backgroundColor: '#1a1a1a', padding: '40px', borderRadius: '8px', marginBottom: '40px' }}>
              <h2 style={{ fontSize: '36px', fontWeight: 'bold', color: '#fff', marginBottom: '30px' }}>
                Datos Bancarios
              </h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', fontSize: '20px', color: '#fff' }}>
                <div style={{ padding: '20px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                  <p style={{ opacity: 0.8, marginBottom: '8px', fontSize: '18px' }}>Banco:</p>
                  <p style={{ fontWeight: 'bold', fontSize: '24px' }}>{propertyDetails.ownerStpBankAccount.banco_nombre}</p>
                </div>
                
                <div style={{ padding: '20px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                  <p style={{ opacity: 0.8, marginBottom: '8px', fontSize: '18px' }}>Beneficiario:</p>
                  <p style={{ fontWeight: 'bold', fontSize: '24px' }}>{propertyDetails.ownerData?.nombre_legal || 'N/A'}</p>
                </div>
                
                <div style={{ padding: '20px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                  <p style={{ opacity: 0.8, marginBottom: '8px', fontSize: '18px' }}>CLABE:</p>
                  <p style={{ fontWeight: 'bold', fontSize: '24px', fontFamily: 'monospace' }}>{propertyDetails.ownerStpBankAccount.cuenta_clabe}</p>
                </div>
                
                <div style={{ padding: '20px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                  <p style={{ opacity: 0.8, marginBottom: '8px', fontSize: '18px' }}>Cuenta:</p>
                  <p style={{ fontWeight: 'bold', fontSize: '24px', fontFamily: 'monospace' }}>{propertyDetails.ownerStpBankAccount.numero_cuenta}</p>
                </div>
              </div>
            </div>
          )}

          {/* Legal Notices */}
          {legalNotices.length > 0 && (
            <div style={{ borderTop: '2px solid #585858', paddingTop: '30px' }}>
              <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '20px' }}>
                Avisos Legales
              </h3>
              {legalNotices.map((notice, index) => (
                <p key={index} style={{ fontSize: '16px', color: '#585858', marginBottom: '15px', lineHeight: '1.6', textAlign: 'justify' }}>
                  {notice}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ position: 'absolute', bottom: '60px', left: '80px', right: '80px', textAlign: 'center', borderTop: '2px solid #585858', paddingTop: '20px' }}>
          <p style={{ fontSize: '18px', color: '#585858' }}>
            Datos del Comprador: {offerData.leadName} | Email: {offerData.leadEmail}
          </p>
        </div>
      </div>
    );
  }
);

OfferPDFTemplateSozu.displayName = 'OfferPDFTemplateSozu';
