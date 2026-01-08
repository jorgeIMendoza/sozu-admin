import { supabase } from "@/integrations/supabase/client";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface EstadoCuentaData {
  id_cuenta: number;
}

export class EstadoCuentaService {
  async generateEstadoCuenta(data: EstadoCuentaData): Promise<void> {
    try {
      // Fetch cuenta de cobranza details
      const { data: cuentaData, error: cuentaError } = await supabase
        .from("cuentas_cobranza")
        .select("*")
        .eq("id", data.id_cuenta)
        .single();

      if (cuentaError) throw cuentaError;

      // Fetch oferta details
      const { data: ofertaData, error: ofertaError } = await supabase
        .from("ofertas")
        .select("id_propiedad, id_producto")
        .eq("id", cuentaData.id_oferta)
        .single();

      if (ofertaError) throw ofertaError;

      // Fetch compradores
      const { data: compradores, error: compradoresError } = await supabase
        .from("compradores")
        .select("*, personas!compradores_id_persona_fkey(*)")
        .eq("id_cuenta_cobranza", data.id_cuenta)
        .eq("activo", true);

      if (compradoresError) throw compradoresError;

      // Fetch acuerdos de pago
      const { data: acuerdos, error: acuerdosError } = await supabase
        .from("acuerdos_pago")
        .select("*, conceptos_pago!acuerdos_pago_id_concepto_fkey(nombre)")
        .eq("id_cuenta_cobranza", data.id_cuenta)
        .eq("activo", true)
        .order("orden", { ascending: true });

      if (acuerdosError) throw acuerdosError;

      // Fetch pagos
      const { data: pagos, error: pagosError } = await supabase
        .from("pagos")
        .select(`
          *,
          metodos_pago!pagos_id_metodos_pago_fkey(nombre),
          aplicaciones_pago!fk_aplicaciones_pago_pago(
            monto,
            id_acuerdo_pago,
            es_multa
          )
        `)
        .eq("id_cuenta_cobranza", data.id_cuenta)
        .eq("activo", true)
        .order("fecha_pago", { ascending: true });

      if (pagosError) throw pagosError;

      // Fetch proyecto info
      let proyectoData = null;
      if (ofertaData.id_propiedad) {
        const { data: propiedadData } = await supabase
          .from("propiedades")
          .select("id_entidad_relacionada_dueno")
          .eq("id", ofertaData.id_propiedad)
          .maybeSingle();

        if (propiedadData) {
          const { data: entidadData } = await supabase
            .from("entidades_relacionadas")
            .select("id_proyecto")
            .eq("id", propiedadData.id_entidad_relacionada_dueno)
            .maybeSingle();

          if (entidadData) {
            const { data: proyecto } = await supabase
              .from("proyectos")
              .select("*")
              .eq("id", entidadData.id_proyecto)
              .maybeSingle();

            proyectoData = proyecto;
          }
        }
      }

      // Calculate totals
      const precioFinal = cuentaData.precio_final || 0;
      const totalPagado = (pagos || []).reduce((sum, pago) => {
        const aplicacionesNoPagadas = (pago.aplicaciones_pago || []).filter(
          (ap: any) => !ap.es_multa
        );
        return sum + aplicacionesNoPagadas.reduce((s: number, ap: any) => s + (ap.monto || 0), 0);
      }, 0);

      const totalMultas = (pagos || []).reduce((sum, pago) => {
        const aplicacionesMultas = (pago.aplicaciones_pago || []).filter(
          (ap: any) => ap.es_multa
        );
        return sum + aplicacionesMultas.reduce((s: number, ap: any) => s + (ap.monto || 0), 0);
      }, 0);

      const saldoPendiente = precioFinal - totalPagado;

      // Generate HTML
      await this.renderTemplate({
        cuenta: cuentaData,
        oferta: ofertaData,
        compradores: compradores || [],
        acuerdos: acuerdos || [],
        pagos: pagos || [],
        proyecto: proyectoData,
        precioFinal,
        totalPagado,
        totalMultas,
        saldoPendiente,
        id_cuenta: data.id_cuenta,
      });
    } catch (error) {
      console.error("Error generating estado de cuenta:", error);
      throw error;
    }
  }

  private async renderTemplate(data: any): Promise<void> {
    // Load template
    const response = await fetch("/templates/template-edc-1.html");
    const templateHtml = await response.text();

    // Create a temporary container
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.innerHTML = templateHtml;
    document.body.appendChild(container);

    // Format money - handle negative zero
    const formatMoney = (amount: number) => {
      // Fix -0 issue: if value is -0 or very close to 0, treat as 0
      const normalizedAmount = Math.abs(amount) < 0.01 ? 0 : amount;
      // Ensure no negative values for pending amounts (shouldn't happen but as safety)
      const safeAmount = normalizedAmount < 0 ? 0 : normalizedAmount;
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
      }).format(safeAmount);
    };

    // Format money allowing negative (for cases where it makes sense)
    const formatMoneyAllowNegative = (amount: number) => {
      // Fix -0 issue
      const normalizedAmount = Math.abs(amount) < 0.01 ? 0 : amount;
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
      }).format(normalizedAmount);
    };

    // Format date
    const formatDate = (date: string) =>
      new Date(date).toLocaleDateString("es-MX");

    // Populate company info
    const companyName = container.querySelector("#companyName");
    if (companyName) companyName.textContent = data.proyecto?.nombre || "N/A";

    const companyAddress = container.querySelector("#companyAddress");
    if (companyAddress)
      companyAddress.textContent = data.proyecto?.direccion || "N/A";

    // Populate account info
    const accountNumber = container.querySelector("#accountNumber");
    if (accountNumber)
      accountNumber.textContent = formatCuentaCobranzaId(
        data.cuenta.id,
        data.oferta.id_producto ? "Producto" : "Propiedad"
      );

    const clientName = container.querySelector("#clientName");
    if (clientName && data.compradores.length > 0) {
      clientName.textContent = data.compradores
        .map((c: any) => c.personas.nombre_legal)
        .join(", ");
    }

    const clientIdentifier = container.querySelector("#clientIdentifier");
    if (clientIdentifier && data.compradores.length > 0) {
      clientIdentifier.textContent =
        data.compradores[0].personas.rfc ||
        data.compradores[0].personas.curp ||
        "";
    }

    // Populate status
    const accountStatus = container.querySelector("#accountStatus");
    if (accountStatus)
      accountStatus.textContent = data.cuenta.es_aprobado
        ? "APROBADO"
        : "PENDIENTE";

    // Populate dates
    const period = container.querySelector("#period");
    if (period && data.acuerdos.length > 0) {
      const firstDate = data.acuerdos[0].fecha_pago;
      const lastDate = data.acuerdos[data.acuerdos.length - 1].fecha_pago;
      period.textContent = `${formatDate(firstDate)} — ${formatDate(lastDate)}`;
    }

    const issueDate = container.querySelector("#issueDate");
    if (issueDate) issueDate.textContent = formatDate(new Date().toISOString());

    // Populate summary
    const precioFinal = container.querySelector("#precioFinal");
    if (precioFinal) precioFinal.textContent = formatMoneyAllowNegative(data.precioFinal);

    const totalPagado = container.querySelector("#totalPagado");
    if (totalPagado) totalPagado.textContent = formatMoneyAllowNegative(data.totalPagado);

    const totalMultas = container.querySelector("#totalMultas");
    if (totalMultas) totalMultas.textContent = formatMoneyAllowNegative(data.totalMultas);

    const saldoPendiente = container.querySelector("#saldoPendiente");
    if (saldoPendiente)
      saldoPendiente.textContent = formatMoneyAllowNegative(data.saldoPendiente);

    // Populate acuerdos table
    const acuerdosTable = container.querySelector("#acuerdosTable");
    if (acuerdosTable) {
      acuerdosTable.innerHTML = data.acuerdos
        .map((acuerdo: any) => {
          // Calculate pagado for this acuerdo
          const pagadoAcuerdo = data.pagos.reduce((sum: number, pago: any) => {
            const aplicacionesAcuerdo = pago.aplicaciones_pago.filter(
              (ap: any) => ap.id_acuerdo_pago === acuerdo.id && !ap.es_multa
            );
            return (
              sum +
              aplicacionesAcuerdo.reduce(
                (s: number, ap: any) => s + (ap.monto || 0),
                0
              )
            );
          }, 0);

          // Calculate pending - ensure no negative zero
          let pendiente = acuerdo.monto - pagadoAcuerdo;
          // Normalize -0 to 0 and small negative values due to floating point
          if (Math.abs(pendiente) < 0.01) {
            pendiente = 0;
          } else if (pendiente < 0) {
            pendiente = 0; // If overpaid, show 0 pending
          }
          
          const estado = acuerdo.pago_completado ? "Pagado" : "Pendiente";

          return `
          <tr>
            <td>${acuerdo.orden}</td>
            <td>${acuerdo.conceptos_pago?.nombre || "N/A"}</td>
            <td>${acuerdo.fecha_pago ? formatDate(acuerdo.fecha_pago) : "N/A"}</td>
            <td class="right">${formatMoneyAllowNegative(acuerdo.monto)}</td>
            <td class="right">${formatMoneyAllowNegative(pagadoAcuerdo)}</td>
            <td class="right">${formatMoney(pendiente)}</td>
            <td>${estado}</td>
          </tr>
        `;
        })
        .join("");
    }

    // Populate pagos table - use the full payment amount (monto field)
    const pagosTable = container.querySelector("#pagosTable");
    if (pagosTable) {
      pagosTable.innerHTML = data.pagos
        .map((pago: any) => {
          // Use the pago.monto directly instead of summing aplicaciones
          // This shows the actual payment amount received
          const montoPago = pago.monto || 0;

          return `
          <tr>
            <td>${formatDate(pago.fecha_pago)}</td>
            <td>${pago.metodos_pago?.nombre || "N/A"}</td>
            <td>${pago.clave_rastreo || "N/A"}</td>
            <td class="right">${formatMoneyAllowNegative(montoPago)}</td>
          </tr>
        `;
        })
        .join("");
    }

    // Calculate total pagos from pago.monto
    const totalPagosReal = data.pagos.reduce((sum: number, pago: any) => sum + (pago.monto || 0), 0);
    
    const totalPagosFooter = container.querySelector("#totalPagosFooter");
    if (totalPagosFooter)
      totalPagosFooter.textContent = formatMoneyAllowNegative(totalPagosReal);

    // Populate notes
    const notes = container.querySelector("#notes");
    if (notes)
      notes.textContent =
        "Este estado de cuenta muestra el detalle de acuerdos de pago y pagos realizados.";

    // Generate PDF with multiple pages support
    await this.generatePDF(container, data.id_cuenta, data.oferta);

    // Cleanup
    document.body.removeChild(container);
  }

  private async generatePDF(container: HTMLElement, idCuenta: number, oferta: any): Promise<void> {
    const card = container.querySelector(".card") as HTMLElement;
    if (!card) return;

    // Set a fixed width for consistent rendering
    card.style.width = "850px";

    const canvas = await html2canvas(card, {
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: 900,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Calculate the image dimensions to fit the PDF width
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;
    
    // If content fits in one page
    if (imgHeight <= pdfHeight) {
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    } else {
      // Multi-page handling
      let heightLeft = imgHeight;
      let position = 0;
      const pageHeight = pdfHeight;
      
      // Add first page
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      // Add subsequent pages
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
    }
    
    // Format date as yyyy_mm_dd
    const formatDateForFilename = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}_${month}_${day}`;
    };

    // Determine account type for formatting
    const tipoCuenta = oferta?.id_producto ? 'Producto' : 'Propiedad';
    const cuentaFormatted = formatCuentaCobranzaId(idCuenta, tipoCuenta);
    
    // Get current date
    const fechaActual = new Date();
    const fechaFormatted = formatDateForFilename(fechaActual);

    // Save PDF with formatted name
    const fileName = `estado_cuenta_${cuentaFormatted}_${fechaFormatted}.pdf`;
    pdf.save(fileName);
  }
}
