 import { useState, useEffect, useCallback } from 'react';
 import { AdminLayout } from '@/components/admin/AdminLayout';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { APP_VERSION } from '@/lib/config';
 import { fetchProductionVersion } from '@/utils/versionUtils';
 import { RefreshCw, GitBranch, Server, Monitor, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
 import { format } from 'date-fns';
 import { es } from 'date-fns/locale';
 
 interface ProductionVersionData {
   version: string;
   buildTime: number;
 }
 
 const VersionProduccion = () => {
   const [productionData, setProductionData] = useState<ProductionVersionData | null>(null);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
 
   const fetchVersion = useCallback(async () => {
     setIsLoading(true);
     setError(null);
     try {
       const data = await fetchProductionVersion();
       if (data) {
         setProductionData(data);
       } else {
         setError('No se pudo obtener la versión de producción');
       }
     } catch {
       setError('Error al conectar con producción');
     } finally {
       setIsLoading(false);
     }
   }, []);
 
   useEffect(() => {
     fetchVersion();
   }, [fetchVersion]);
 
   const localVersion = APP_VERSION;
   const productionVersion = productionData?.version || '—';
   const isSynced = localVersion === productionVersion;
 
   const formatBuildTime = (timestamp: number) => {
     try {
       return format(new Date(timestamp), "PPpp", { locale: es });
     } catch {
       return '—';
     }
   };
 
   return (
     <div className="space-y-6">
       <div className="flex items-center justify-between">
         <div>
           <h1 className="text-3xl font-bold tracking-tight">Versión Producción</h1>
           <p className="text-muted-foreground">
             Compara la versión local con la publicada en producción
           </p>
         </div>
         <Button onClick={fetchVersion} disabled={isLoading} variant="outline">
           {isLoading ? (
             <Loader2 className="h-4 w-4 mr-2 animate-spin" />
           ) : (
             <RefreshCw className="h-4 w-4 mr-2" />
           )}
           Refrescar
         </Button>
       </div>
 
       {/* Status Banner */}
       <Card className={isSynced ? 'border-green-500/50 bg-green-500/5' : 'border-yellow-500/50 bg-yellow-500/5'}>
         <CardContent className="py-4">
           <div className="flex items-center gap-3">
             {isSynced ? (
               <>
                 <CheckCircle2 className="h-6 w-6 text-green-500" />
                 <div>
                   <p className="font-semibold text-green-700 dark:text-green-400">Versiones Sincronizadas</p>
                   <p className="text-sm text-muted-foreground">La versión local coincide con producción</p>
                 </div>
               </>
             ) : (
               <>
                 <AlertTriangle className="h-6 w-6 text-yellow-500" />
                 <div>
                   <p className="font-semibold text-yellow-700 dark:text-yellow-400">Versiones Diferentes</p>
                   <p className="text-sm text-muted-foreground">La versión local es diferente a la de producción</p>
                 </div>
               </>
             )}
           </div>
         </CardContent>
       </Card>
 
       {/* Version Cards */}
       <div className="grid gap-6 md:grid-cols-2">
         {/* Local Version */}
         <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-lg font-medium">Versión Local</CardTitle>
             <Monitor className="h-5 w-5 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             <div className="space-y-3">
               <div className="flex items-center gap-2">
                 <Badge variant="secondary" className="text-sm font-mono">
                   {localVersion}
                 </Badge>
                 <Badge variant="outline" className="text-xs">
                   Preview
                 </Badge>
               </div>
               <p className="text-sm text-muted-foreground">
                 Esta es la versión del build actual en desarrollo/preview
               </p>
             </div>
           </CardContent>
         </Card>
 
         {/* Production Version */}
         <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-lg font-medium">Versión Producción</CardTitle>
             <Server className="h-5 w-5 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             <div className="space-y-3">
               {isLoading ? (
                 <div className="flex items-center gap-2">
                   <Loader2 className="h-4 w-4 animate-spin" />
                   <span className="text-sm text-muted-foreground">Cargando...</span>
                 </div>
               ) : error ? (
                 <p className="text-sm text-destructive">{error}</p>
               ) : (
                 <>
                   <div className="flex items-center gap-2">
                     <Badge variant="default" className="text-sm font-mono">
                       {productionVersion}
                     </Badge>
                     <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                       Live
                     </Badge>
                   </div>
                   {productionData?.buildTime && (
                     <p className="text-sm text-muted-foreground">
                       Publicado: {formatBuildTime(productionData.buildTime)}
                     </p>
                   )}
                 </>
               )}
             </div>
           </CardContent>
         </Card>
       </div>
 
       {/* Info Card */}
       <Card>
         <CardHeader>
           <CardTitle className="text-lg flex items-center gap-2">
             <GitBranch className="h-5 w-5" />
             Información de Versionamiento
           </CardTitle>
           <CardDescription>
             Cómo funciona el sistema de versiones
           </CardDescription>
         </CardHeader>
         <CardContent className="space-y-4 text-sm text-muted-foreground">
           <p>
             El formato de versión es: <code className="bg-muted px-1 py-0.5 rounded">v[major].[minor].[patch]-YYMMDD.HHMM</code>
           </p>
           <ul className="list-disc list-inside space-y-1">
             <li>La versión se genera automáticamente en cada build</li>
             <li>El timestamp indica la fecha y hora exacta del build</li>
             <li>Cuando publicas cambios, la versión de producción se actualiza</li>
             <li>Si las versiones son diferentes, significa que hay cambios pendientes por publicar</li>
           </ul>
         </CardContent>
       </Card>
     </div>
   );
 };
 
 export default VersionProduccion;