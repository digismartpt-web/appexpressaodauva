import { getGoogleMapsLibrary } from '../lib/googleMaps';

let isGoogleMapsLoaded = false;
let googleMapsPromise: Promise<void> | null = null;
const distanceCache = new Map<string, DeliveryEstimate>();

const loadGoogleMaps = async (): Promise<void> => {
  if (isGoogleMapsLoaded) return;
  
  if (googleMapsPromise) return googleMapsPromise;

  // Utilisation du chargeur centralisé
  googleMapsPromise = (async () => {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout loading Google Maps')), 3000)
      );

      await Promise.race([getGoogleMapsLibrary('places'), timeoutPromise]);
      isGoogleMapsLoaded = true;
    } catch (err) {
      console.warn('⚠️ Google Maps loading fallback (Timeout):', err);
      isGoogleMapsLoaded = true; // On marque comme "chargé" pour ne plus bloquer
    }
  })();

  return googleMapsPromise;
};

export interface DeliveryEstimate {
  duration: number;
  distance: number;
  isFallback?: boolean;
}

export const calculateDeliveryTime = async (
  origin: string,
  destination: string
): Promise<DeliveryEstimate> => {
  try {
    const cacheKey = `${origin}|${destination}`;
    if (distanceCache.has(cacheKey)) {
      return distanceCache.get(cacheKey)!;
    }

    await loadGoogleMaps();

    const service = new google.maps.DistanceMatrixService();

    const request: google.maps.DistanceMatrixRequest = {
      origins: [origin],
      destinations: [destination],
      travelMode: google.maps.TravelMode.DRIVING,
      unitSystem: google.maps.UnitSystem.METRIC,
      avoidHighways: false,
      avoidTolls: false
    };

    return new Promise((resolve, reject) => {
      service.getDistanceMatrix(request, (response, status) => {
        if (status === 'OK' && response) {
          const result = response.rows[0]?.elements[0];

          if (result && result.status === 'OK') {
            const durationInMinutes = Math.ceil(result.duration.value / 60);
            const distanceInKm = result.distance.value / 1000;

            const estimate = {
              duration: durationInMinutes,
              distance: distanceInKm,
              isFallback: false
            };
            distanceCache.set(cacheKey, estimate);
            resolve(estimate);
          } else {
            reject(new Error('Unable to calculate route'));
          }
        } else {
          // Si Google renvoie une erreur (quota, etc.), on renvoie quand même un fallback
          resolve({
            duration: 30,
            distance: 5,
            isFallback: true
          });
        }
      });
    });
  } catch (error) {
    console.error('Error calculating delivery time:', error);
    return {
      duration: 30,
      distance: 5,
      isFallback: true
    };
  }
};
