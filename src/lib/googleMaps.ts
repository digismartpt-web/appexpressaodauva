import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export const initGoogleMaps = () => {
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
        console.error('🗺️ [GoogleMaps] API Key missing in environment variables');
        return false;
    }

    setOptions({
        key: apiKey,
        v: 'weekly',
        libraries: ['places']
    });

    console.log('🗺️ [GoogleMaps] Loader initialized successfully');
    return true;
};

export const getGoogleMapsLibrary = async (name: any) => {
    return importLibrary(name);
};
