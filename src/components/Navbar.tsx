import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Wine, User, LogOut, ShoppingBag } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { CartButton } from './CartButton';
import { useCaveSettings } from '../hooks/useCaveSettings';
import { checkOpeningHours } from '../services/openingHoursService';
import toast from 'react-hot-toast';

interface NavbarProps {
  onCartClick: () => void;
}

export function Navbar({ onCartClick }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { settings } = useCaveSettings();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Sessão terminada com sucesso');
      navigate('/');
    } catch (error: any) {
      console.error('Erro ao terminar sessão:', error);
      toast.error(error.message || 'Erro ao terminar sessão');
    }
  };

  let openingHoursCheck = { isOpen: false };
  try {
    openingHoursCheck = settings.opening_hours ? checkOpeningHours(settings.opening_hours) : { isOpen: false };
  } catch (error) {
    console.error('Erro ao verificar os horários:', error);
  }
  const canOrder = settings.is_open && openingHoursCheck.isOpen;

  return (
    <nav className="bg-black text-white sticky top-0 z-40 shadow-md">
      <div className="w-full px-4">
        <div className="flex justify-between items-center h-14 sm:h-16">
          <Link to="/" className="flex items-center space-x-2">
            {settings.logo_url ? (
              <img
                src={settings.logo_url}
                alt={settings.name}
                className="h-7 w-7 sm:h-8 sm:w-8 object-contain"
              />
            ) : (
              <Wine className="h-7 w-7 sm:h-8 sm:w-8 text-accent-400" />
            )}
            <span className="font-bold text-lg sm:text-xl truncate max-w-[150px] sm:max-w-none">{settings.name}</span>
          </Link>

          {/* Desktop & Tablet Menu */}
          <div className="hidden md:flex items-center space-x-2 lg:space-x-6">
            {/* Status Indicator Desktop */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full backdrop-blur-sm">
              <div className={`w-2 h-2 rounded-full ${canOrder ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-xs font-medium">
                {canOrder ? 'Aberto' : 'Fechado'}
              </span>
            </div>

            <Link to="/menu" className="hover:text-accent-400 transition text-sm lg:text-base">Menu</Link>
            {user ? (
              <>
                <Link to="/profile" className="hover:text-accent-400 transition" title="Perfil">
                  <User className="h-5 w-5" />
                </Link>
                {user.role === 'client' && (
                  <>
                    <Link to="/mes-commandes" className="hover:text-accent-400 transition flex items-center space-x-1" title="As minhas encomendas">
                      <ShoppingBag className="h-5 w-5" />
                      <span className="hidden lg:inline text-sm lg:text-base">Encomendas</span>
                    </Link>
                    <CartButton onClick={onCartClick} />
                  </>
                )}
                {user.role === 'admin' && (
                  <Link to="/admin" className="hover:text-accent-400 transition text-sm lg:text-base">
                    Admin
                  </Link>
                )}
                {user.role === 'cave' && (
                  <Link to="/wineria" className="hover:text-accent-400 transition text-sm lg:text-base">
                    Cave
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  className="flex items-center hover:text-accent-400 transition"
                  title="Terminar sessão"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="hidden lg:inline ml-1 text-sm lg:text-base">Sair</span>
                </button>
              </>
            ) : (
              <Link to="/auth" className="hover:text-accent-400 transition text-sm lg:text-base">Iniciar sessão</Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center space-x-2 md:hidden">
            {user?.role === 'client' && <CartButton onClick={onCartClick} />}
            <button
              className="md:hidden"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden pb-4">
            {/* Status Indicator Mobile */}
            <div className="flex items-center gap-2 py-3 mb-2 px-3 bg-white/10 rounded-lg">
              <div className={`w-2.5 h-2.5 rounded-full ${canOrder ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-sm font-medium">
                {canOrder ? 'Aberto para encomendas' : 'Fechado'}
              </span>
            </div>

            <Link
              to="/menu"
              className="block py-2 hover:text-accent-400 transition"
              onClick={() => setIsOpen(false)}
            >
              Menu
            </Link>
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="block py-2 hover:text-accent-400 transition"
                  onClick={() => setIsOpen(false)}
                >
                  Perfil
                </Link>
                {user.role === 'client' && (
                  <>
                    <Link
                      to="/mes-commandes"
                      className="block py-2 hover:text-accent-400 transition"
                      onClick={() => setIsOpen(false)}
                    >
                      As minhas encomendas
                    </Link>
                    <div
                      className="block py-2"
                      onClick={() => {
                        setIsOpen(false);
                        onCartClick();
                      }}
                    >
                      <CartButton />
                    </div>
                  </>
                )}
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="block py-2 hover:text-accent-400 transition"
                    onClick={() => setIsOpen(false)}
                  >
                    Admin
                  </Link>
                )}
                {user.role === 'cave' && (
                  <Link
                    to="/wineria"
                    className="block py-2 hover:text-accent-400 transition"
                    onClick={() => setIsOpen(false)}
                  >
                    Cave
                  </Link>
                )}
                <button
                  onClick={() => {
                    handleSignOut();
                    setIsOpen(false);
                  }}
                  className="block w-full text-left py-2 hover:text-accent-400 transition"
                >
                  Terminar sessão
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                className="block py-2 hover:text-accent-400 transition"
                onClick={() => setIsOpen(false)}
              >
                Iniciar sessão
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}