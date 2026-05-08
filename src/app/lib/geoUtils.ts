export function aRadianes(valor: number): number {
  return (valor * Math.PI) / 180;
}

// Formula Haversine para distancia aproximada entre dos coordenadas en kilometros.
export function calcularDistanciaKm(
  origen: { lat: number; lng: number },
  destino: { lat: number; lng: number }
): number {
  const radioTierraKm = 6371;
  const diferenciaLat = aRadianes(destino.lat - origen.lat);
  const diferenciaLng = aRadianes(destino.lng - origen.lng);
  const latOrigen = aRadianes(origen.lat);
  const latDestino = aRadianes(destino.lat);

  const a =
    Math.sin(diferenciaLat / 2) * Math.sin(diferenciaLat / 2) +
    Math.sin(diferenciaLng / 2) * Math.sin(diferenciaLng / 2) * Math.cos(latOrigen) * Math.cos(latDestino);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(radioTierraKm * c * 10) / 10;
}
