// Technical Annexes mock data — plans, specs, and inventory per property

export interface PlanData {
  title: string;
  type: "ubicacion" | "arquitectonico";
  previewGradient: string; // fallback gradient
  previewImage?: string; // actual plan image path
  level?: string;
  model?: string;
  totalArea?: string;
  mainDimensions?: string;
}

export interface SpecCategory {
  category: string;
  items: string[];
}

export interface InventoryItem {
  category: string;
  items: { qty: number; description: string; location: string }[];
}

export interface TechnicalAnnex {
  propertyId: string;
  plans: PlanData[];
  specs: SpecCategory[];
  inventory: InventoryItem[];
}

export const technicalAnnexes: Record<string, TechnicalAnnex> = {
  "margot-707": {
    propertyId: "margot-707",
    plans: [
      {
        title: "Plano de ubicación",
        type: "ubicacion",
        previewGradient: "from-emerald-50 to-emerald-100",
        level: "Nivel 7",
        model: "Modelo A — Esquina",
        totalArea: "78.0 m²",
      },
      {
        title: "Plano arquitectónico",
        type: "arquitectonico",
        previewGradient: "from-slate-50 to-slate-100",
        totalArea: "78.0 m²",
        mainDimensions: "10.2 m × 7.65 m",
      },
    ],
    specs: [
      {
        category: "Estructura",
        items: [
          "Sistema estructural a base de columnas y losas de concreto armado",
          "Muros divisorios de block hueco de concreto",
          "Cimentación profunda a base de pilas de concreto armado",
        ],
      },
      {
        category: "Muros",
        items: [
          "Acabado interior: pasta texturizada y pintura vinílica color blanco",
          "Muros en baños: loseta cerámica formato 30×60 cm piso a techo",
          "Fachada: aplanado fino con pintura elastomérica",
        ],
      },
      {
        category: "Pisos",
        items: [
          "Áreas comunes: piso de porcelanato 60×120 cm color gris claro",
          "Recámaras: piso laminado de madera 8 mm roble natural",
          "Baños: porcelanato antiderrapante 60×60 cm",
          "Balcón: porcelanato exterior antiderrapante",
        ],
      },
      {
        category: "Carpintería",
        items: [
          "Puertas interiores: tambor de MDF con chapa de madera natural",
          "Closets: interiores con entrepaños de melamina y tubos cromados",
          "Puerta principal: tambor de madera sólida con cerradura de seguridad",
        ],
      },
      {
        category: "Cocina",
        items: [
          "Cubierta de cuarzo blanco de 2 cm de espesor",
          "Gabinetes superiores e inferiores en MDF lacado blanco",
          "Tarja de acero inoxidable de sub-montaje con grifería monomando",
        ],
      },
      {
        category: "Aire acondicionado",
        items: [
          "Preinstalación completa para sistema mini-split en sala y recámaras",
          "Condensadora incluida (ver Productos Adicionales)",
          "Tubería de cobre aislada y drenaje a fachada",
        ],
      },
      {
        category: "Instalaciones",
        items: [
          "Instalación eléctrica: cableado de cobre con centro de carga individual",
          "Instalación hidráulica: tubería de CPVC y llaves de paso independientes",
          "Gas: instalación para estufa con válvula de seguridad",
          "Telecomunicaciones: preparación para fibra óptica en sala y recámaras",
        ],
      },
    ],
    inventory: [
      {
        category: "Mobiliario fijo",
        items: [
          { qty: 1, description: "Cocina integral con isla", location: "Cocina" },
          { qty: 2, description: "Closet con interiores", location: "Recámaras" },
          { qty: 1, description: "Mueble de baño con espejo", location: "Baño principal" },
          { qty: 1, description: "Mueble de baño compacto", location: "Medio baño" },
        ],
      },
      {
        category: "Electrodomésticos",
        items: [
          { qty: 1, description: "Campana extractora de acero inoxidable", location: "Cocina" },
          { qty: 1, description: "Calentador de paso 16 lts", location: "Área de servicio" },
        ],
      },
      {
        category: "Accesorios",
        items: [
          { qty: 2, description: "Juego de accesorios de baño (toallero, portarrollo, gancho)", location: "Baños" },
          { qty: 1, description: "Tendedero abatible", location: "Área de servicio" },
        ],
      },
      {
        category: "Blancos",
        items: [
          { qty: 2, description: "WC de una pieza con sistema dual flush", location: "Baños" },
          { qty: 2, description: "Lavabo de sobreponer cerámico", location: "Baños" },
          { qty: 1, description: "Regadera tipo lluvia con mezcladora", location: "Baño principal" },
        ],
      },
    ],
  },
  "bottura-709": {
    propertyId: "bottura-709",
    plans: [
      {
        title: "Plano de ubicación",
        type: "ubicacion",
        previewGradient: "from-amber-50 to-amber-100",
        level: "Nivel 7",
        model: "Modelo B — Interior",
        totalArea: "62.0 m²",
      },
      {
        title: "Plano arquitectónico",
        type: "arquitectonico",
        previewGradient: "from-slate-50 to-slate-100",
        totalArea: "62.0 m²",
        mainDimensions: "8.85 m × 7.0 m",
      },
    ],
    specs: [
      {
        category: "Estructura",
        items: [
          "Sistema estructural a base de marcos rígidos de concreto armado",
          "Losas macizas de concreto de 12 cm de espesor",
          "Cimentación con zapatas aisladas y trabes de liga",
        ],
      },
      {
        category: "Muros",
        items: [
          "Interior: acabado liso con pintura vinílica blanco mate",
          "Baño: loseta porcelánica 30×90 cm tono neutral",
          "Fachada: sistema EIFS con acabado texturizado",
        ],
      },
      {
        category: "Pisos",
        items: [
          "Sala-comedor: porcelanato rectificado 80×80 cm",
          "Recámara: piso vinílico SPC tipo madera 6 mm",
          "Baño: porcelanato antiderrapante 45×45 cm",
        ],
      },
      {
        category: "Carpintería",
        items: [
          "Puertas: tambor de MDF con acabado melamínico gris",
          "Closet principal: sistema modular con cajones y entrepaños",
        ],
      },
      {
        category: "Cocina",
        items: [
          "Cubierta de cuarzo gris de 2 cm",
          "Gabinetes en MDF con acabado madera clara",
          "Tarja de acero inoxidable con grifería cromada",
        ],
      },
      {
        category: "Aire acondicionado",
        items: [
          "Preinstalación para mini-split en sala y recámara",
          "Tubería de cobre con aislamiento térmico",
        ],
      },
      {
        category: "Instalaciones",
        items: [
          "Eléctrica: centro de carga y cableado de cobre",
          "Hidráulica: tubería de CPVC con llaves de corte",
          "Gas: instalación con válvula de seguridad tipo Y",
          "Datos: preparación para fibra óptica",
        ],
      },
    ],
    inventory: [
      {
        category: "Mobiliario fijo",
        items: [
          { qty: 1, description: "Cocina integral lineal", location: "Cocina" },
          { qty: 1, description: "Closet con interiores modulares", location: "Recámara" },
          { qty: 1, description: "Mueble de baño con espejo integrado", location: "Baño" },
        ],
      },
      {
        category: "Electrodomésticos",
        items: [
          { qty: 1, description: "Campana extractora slim", location: "Cocina" },
          { qty: 1, description: "Calentador de paso 13 lts", location: "Área de servicio" },
        ],
      },
      {
        category: "Accesorios",
        items: [
          { qty: 1, description: "Juego de accesorios de baño completo", location: "Baño" },
          { qty: 1, description: "Tendedero retráctil", location: "Área de servicio" },
        ],
      },
      {
        category: "Blancos",
        items: [
          { qty: 1, description: "WC alargado dual flush", location: "Baño" },
          { qty: 1, description: "Lavabo de sobreponer", location: "Baño" },
          { qty: 1, description: "Regadera de mano con barra deslizable", location: "Baño" },
        ],
      },
    ],
  },
  "bottura-812": {
    propertyId: "bottura-812",
    plans: [
      {
        title: "Plano de ubicación",
        type: "ubicacion",
        previewGradient: "from-amber-50 to-amber-100",
        level: "Nivel 8",
        model: "Modelo C — Esquina",
        totalArea: "75.0 m²",
      },
      {
        title: "Plano arquitectónico",
        type: "arquitectonico",
        previewGradient: "from-slate-50 to-slate-100",
        totalArea: "75.0 m²",
        mainDimensions: "9.6 m × 7.8 m",
      },
    ],
    specs: [
      {
        category: "Estructura",
        items: [
          "Sistema estructural a base de marcos rígidos de concreto armado",
          "Losas macizas de concreto de 12 cm de espesor",
          "Cimentación con zapatas aisladas y trabes de liga",
        ],
      },
      {
        category: "Muros",
        items: [
          "Interior: acabado liso con pintura vinílica blanco mate",
          "Baño: loseta porcelánica 30×90 cm tono neutral",
          "Fachada: sistema EIFS con acabado texturizado",
        ],
      },
      {
        category: "Pisos",
        items: [
          "Sala-comedor: porcelanato rectificado 80×80 cm",
          "Recámaras: piso vinílico SPC tipo madera 6 mm",
          "Baños: porcelanato antiderrapante 45×45 cm",
          "Balcón: porcelanato exterior antiderrapante",
        ],
      },
      {
        category: "Carpintería",
        items: [
          "Puertas: tambor de MDF con acabado melamínico gris",
          "Closets: sistema modular con cajones y entrepaños",
          "Puerta principal: tambor de madera con cerradura de seguridad",
        ],
      },
      {
        category: "Cocina",
        items: [
          "Cubierta de cuarzo gris de 2 cm",
          "Gabinetes en MDF con acabado madera clara",
          "Tarja de acero inoxidable con grifería cromada",
        ],
      },
      {
        category: "Aire acondicionado",
        items: [
          "Preinstalación para mini-split en sala y recámaras",
          "Tubería de cobre con aislamiento térmico",
        ],
      },
      {
        category: "Instalaciones",
        items: [
          "Eléctrica: centro de carga y cableado de cobre",
          "Hidráulica: tubería de CPVC con llaves de corte",
          "Gas: instalación con válvula de seguridad tipo Y",
          "Datos: preparación para fibra óptica",
        ],
      },
    ],
    inventory: [
      {
        category: "Mobiliario fijo",
        items: [
          { qty: 1, description: "Cocina integral con barra", location: "Cocina" },
          { qty: 2, description: "Closet con interiores modulares", location: "Recámaras" },
          { qty: 1, description: "Mueble de baño con espejo integrado", location: "Baño principal" },
          { qty: 1, description: "Mueble de baño compacto", location: "Baño 2" },
        ],
      },
      {
        category: "Electrodomésticos",
        items: [
          { qty: 1, description: "Campana extractora slim", location: "Cocina" },
          { qty: 1, description: "Calentador de paso 16 lts", location: "Área de servicio" },
        ],
      },
      {
        category: "Accesorios",
        items: [
          { qty: 2, description: "Juego de accesorios de baño completo", location: "Baños" },
          { qty: 1, description: "Tendedero retráctil", location: "Área de servicio" },
        ],
      },
      {
        category: "Blancos",
        items: [
          { qty: 2, description: "WC alargado dual flush", location: "Baños" },
          { qty: 2, description: "Lavabo de sobreponer", location: "Baños" },
          { qty: 1, description: "Regadera tipo lluvia con mezcladora", location: "Baño principal" },
        ],
      },
    ],
  },
  "bottura-915": {
    propertyId: "bottura-915",
    plans: [
      {
        title: "Plano de ubicación",
        type: "ubicacion",
        previewGradient: "from-amber-50 to-amber-100",
        level: "Nivel 9",
        model: "Modelo B — Interior",
        totalArea: "68.0 m²",
      },
      {
        title: "Plano arquitectónico",
        type: "arquitectonico",
        previewGradient: "from-slate-50 to-slate-100",
        totalArea: "68.0 m²",
        mainDimensions: "9.1 m × 7.5 m",
      },
    ],
    specs: [
      {
        category: "Estructura",
        items: [
          "Sistema estructural a base de marcos rígidos de concreto armado",
          "Losas macizas de concreto de 12 cm de espesor",
          "Cimentación con zapatas aisladas y trabes de liga",
        ],
      },
      {
        category: "Muros",
        items: [
          "Interior: acabado liso con pintura vinílica blanco mate",
          "Baño: loseta porcelánica 30×90 cm tono neutral",
          "Fachada: sistema EIFS con acabado texturizado",
        ],
      },
      {
        category: "Pisos",
        items: [
          "Sala-comedor: porcelanato rectificado 80×80 cm",
          "Recámaras: piso vinílico SPC tipo madera 6 mm",
          "Baños: porcelanato antiderrapante 45×45 cm",
          "Balcón: porcelanato exterior antiderrapante",
        ],
      },
      {
        category: "Carpintería",
        items: [
          "Puertas: tambor de MDF con acabado melamínico gris",
          "Closets: sistema modular con cajones y entrepaños",
          "Puerta principal: tambor de madera con cerradura de seguridad",
        ],
      },
      {
        category: "Cocina",
        items: [
          "Cubierta de cuarzo gris de 2 cm",
          "Gabinetes en MDF con acabado madera clara",
          "Tarja de acero inoxidable con grifería cromada",
        ],
      },
      {
        category: "Aire acondicionado",
        items: [
          "Preinstalación para mini-split en sala y recámaras",
          "Tubería de cobre con aislamiento térmico",
        ],
      },
      {
        category: "Instalaciones",
        items: [
          "Eléctrica: centro de carga y cableado de cobre",
          "Hidráulica: tubería de CPVC con llaves de corte",
          "Gas: instalación con válvula de seguridad tipo Y",
          "Datos: preparación para fibra óptica",
        ],
      },
    ],
    inventory: [
      {
        category: "Mobiliario fijo",
        items: [
          { qty: 1, description: "Cocina integral lineal con barra", location: "Cocina" },
          { qty: 2, description: "Closet con interiores modulares", location: "Recámaras" },
          { qty: 1, description: "Mueble de baño con espejo integrado", location: "Baño principal" },
          { qty: 1, description: "Mueble de baño compacto", location: "Baño 2" },
        ],
      },
      {
        category: "Electrodomésticos",
        items: [
          { qty: 1, description: "Campana extractora slim", location: "Cocina" },
          { qty: 1, description: "Calentador de paso 16 lts", location: "Área de servicio" },
        ],
      },
      {
        category: "Accesorios",
        items: [
          { qty: 2, description: "Juego de accesorios de baño completo", location: "Baños" },
          { qty: 1, description: "Tendedero retráctil", location: "Área de servicio" },
        ],
      },
      {
        category: "Blancos",
        items: [
          { qty: 2, description: "WC alargado dual flush", location: "Baños" },
          { qty: 2, description: "Lavabo de sobreponer", location: "Baños" },
          { qty: 1, description: "Regadera tipo lluvia con mezcladora", location: "Baño principal" },
        ],
      },
    ],
  },
};
