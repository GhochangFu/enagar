/** Pin icon that works with Next.js bundlers (Leaflet default PNG paths break). */
export function createGrievanceMapPinIcon(L: typeof import('leaflet')): import('leaflet').DivIcon {
  return L.divIcon({
    className: 'enagar-grievance-map-pin',
    html: '<span class="enagar-grievance-map-pin__head" aria-hidden="true"></span>',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  });
}
