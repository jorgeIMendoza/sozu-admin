import { useCallback, useState, useRef, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

// Move libraries array outside component to prevent recreation
const libraries: ("places")[] = ["places"];

const containerStyle = {
  width: "100%",
  height: "300px"
};

const defaultCenter = {
  lat: 19.4326,
  lng: -99.1332 // Mexico City
};

// Google Maps API Key - This is a public key that should be restricted by domain
const GOOGLE_MAPS_API_KEY = "AIzaSyBrGiC6e6GtDDxERSChJZaDUa9V4yLvTqg";

interface GoogleMapComponentProps {
  onLocationSelect: (location: { lat: number; lng: number }) => void;
  onAddressSelect?: (address: string) => void;
  initialLocation?: { lat: number; lng: number } | null;
  readOnly?: boolean;
}

export function GoogleMapComponent({ onLocationSelect, onAddressSelect, initialLocation, readOnly = false }: GoogleMapComponentProps) {
  const [markerPosition, setMarkerPosition] = useState(initialLocation || null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [searchText, setSearchText] = useState("");

  // Sync markerPosition when initialLocation changes (e.g. async data load on edit)
  useEffect(() => {
    if (initialLocation && (initialLocation.lat !== markerPosition?.lat || initialLocation.lng !== markerPosition?.lng)) {
      setMarkerPosition(initialLocation);
      if (mapInstance) {
        mapInstance.panTo(initialLocation);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLocation?.lat, initialLocation?.lng]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: libraries
  });

  const updateLocation = useCallback((newPosition: { lat: number; lng: number }) => {
    setMarkerPosition(newPosition);
    onLocationSelect(newPosition);

    if (onAddressSelect && window.google) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: newPosition }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          onAddressSelect(results[0].formatted_address);
        }
      });
    }
  }, [onLocationSelect, onAddressSelect]);

  const onMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      updateLocation({ lat: event.latLng.lat(), lng: event.latLng.lng() });
    }
  }, [updateLocation]);

  const handleSearch = useCallback(() => {
    if (!searchText.trim() || !window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: searchText, componentRestrictions: { country: "mx" } }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        const newPosition = { lat: loc.lat(), lng: loc.lng() };
        setMarkerPosition(newPosition);
        onLocationSelect(newPosition);
        if (onAddressSelect) {
          onAddressSelect(results[0].formatted_address);
        }
        if (mapInstance) {
          mapInstance.panTo(newPosition);
          mapInstance.setZoom(15);
        }
      }
    });
  }, [searchText, onLocationSelect, onAddressSelect, mapInstance]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMapInstance(map);
  }, []);

  if (!isLoaded) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-muted rounded-lg border">
        <p className="text-muted-foreground">Cargando mapa...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {/* Search bar - only in edit mode */}
      {!readOnly && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar dirección..."
            className="pl-8"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
            }}
          />
        </div>
      )}
      
      {/* Map */}
      <div className="w-full h-[300px] rounded-lg overflow-hidden border">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={markerPosition || defaultCenter}
          zoom={markerPosition ? 15 : 10}
          onClick={readOnly ? undefined : onMapClick}
          onLoad={onMapLoad}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            gestureHandling: readOnly ? "none" : "auto",
            zoomControl: !readOnly,
          }}
        >
          {markerPosition && (
            <Marker
              position={markerPosition}
              animation={google.maps.Animation.DROP}
              draggable={!readOnly}
              onDragEnd={(event) => {
                if (event.latLng) {
                  updateLocation({ lat: event.latLng.lat(), lng: event.latLng.lng() });
                }
              }}
            />
          )}
        </GoogleMap>
      </div>
    </div>
  );
}
