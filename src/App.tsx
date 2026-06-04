import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
import { Toaster } from 'react-hot-toast';
import { Navbar } from './components/Navbar';
import ChatFab from './components/ChatFab';
import ChatBot from './components/ChatBot';
import { Footer } from './components/Footer';
import { BrandingFooter } from './components/BrandingFooter';
import { CartModal } from './components/CartModal';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './pages/Home';
import { Menu } from './pages/Menu';
import { Auth } from './pages/Auth';
import { Profile } from './pages/Profile';
import MesCommandes from './pages/MesCommandes';
import { Privacy } from './pages/Privacy';
import { Admin } from './pages/Admin';
import { Cave } from './pages/Cave';
import { PaymentSuccess } from './pages/PaymentSuccess';

function MainContent() {
  const location = useLocation();
  const isAdminOrCave = location.pathname.startsWith('/admin') || location.pathname.startsWith('/wineria');

  return (
    <main className={`flex-1 ${isAdminOrCave ? 'w-full' : 'container mx-auto px-4 py-8'}`}>
      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/contact" element={<Home />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />
        <Route path="/mes-commandes" element={
          <ProtectedRoute role="client">
            <MesCommandes />
          </ProtectedRoute>
        } />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/admin/*" element={
          <ProtectedRoute role="admin">
            <Admin />
          </ProtectedRoute>
        } />
        <Route path="/wineria/*" element={
          <ProtectedRoute role="cave">
            <Cave />
          </ProtectedRoute>
        } />
        <Route path="/payment-success" element={<PaymentSuccess />} />
      </Routes>
    </main>
  );
}

import { useAuth } from './hooks/useAuth';
import { useCartStore } from './stores/cartStore';
import { useSettingsStore } from './stores/settingsStore';
import { useWinesStore } from './stores/winesStore';
import { usePromotionsStore } from './stores/promotionsStore';
import { useOrderStore } from './stores/orderStore';

function App() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { user } = useAuth();
  const { initPromotionsListener, initExtrasListener } = useCartStore();
  const { initSettings } = useSettingsStore();
  const { initWinesStore } = useWinesStore();
  const { initPromotionsStore } = usePromotionsStore();
  const { initAdminOrdersListener } = useOrderStore();

  useEffect(() => {
    const unsubPromosLegacy = initPromotionsListener(); // Keep for cart logic synchronization if needed
    const unsubExtras = initExtrasListener();
    const unsubSettings = initSettings();
    const unsubWines = initWinesStore();
    const unsubPromosGlobal = initPromotionsStore();
    
    // Only subscribe to all orders if user is admin or wineria
    let unsubOrders = () => {};
    if (user?.role === 'admin' || user?.role === 'cave') {
      unsubOrders = initAdminOrdersListener(); // Auto re-init on role change via cleanup logic
    }
    
    return () => {
      unsubPromosLegacy();
      unsubExtras();
      unsubSettings();
      unsubWines();
      unsubPromosGlobal();
      unsubOrders();
    };
  }, [initPromotionsListener, initExtrasListener, initSettings, initWinesStore, initPromotionsStore, initAdminOrdersListener, user?.role]);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="min-h-screen h-full bg-white flex flex-col">
        <Toaster position="top-center" />
        <Navbar onCartClick={() => setIsCartOpen(true)} />
        <MainContent />
        <Footer />
        <CartModal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
        <BrandingFooter />
        <ChatFab onOpen={() => setIsChatOpen(true)} isOpen={isChatOpen} />
        <ChatBot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      </div>
    </BrowserRouter>
  );
}

export default App;