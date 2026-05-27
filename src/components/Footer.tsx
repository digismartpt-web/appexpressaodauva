import { Wine } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCaveSettings } from '../hooks/useCaveSettings';

export function Footer() {
  const { settings } = useCaveSettings();

  return (
    <footer className="bg-black text-white py-8">
      <div className="w-full px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            {settings.logo_url ? (
              <img
                src={settings.logo_url}
                alt={settings.name}
                className="h-6 w-6 object-contain"
              />
            ) : (
              <Wine className="h-6 w-6 text-accent-400" />
            )}
            <span className="font-bold text-lg">{settings.name}</span>
          </div>
          <div className="flex flex-col md:flex-row md:space-x-8 items-center">
            <Link to="/contact" className="hover:text-accent-400 transition mb-2 md:mb-0">
              Contacto
            </Link>
            <Link to="/privacy" className="hover:text-accent-400 transition mb-2 md:mb-0">
              Termos e Condições (CGDV)
            </Link>
          </div>
        </div>
        <div className="text-center mt-8 text-primary-400">
          © {new Date().getFullYear()} {settings.name}. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}