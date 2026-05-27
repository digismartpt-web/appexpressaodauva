import { AlertCircle, CheckCircle, Database } from 'lucide-react';

interface InitializationBannerProps {
  supabaseAvailable: boolean;
  winesInitialized: boolean;
  source: 'supabase' | 'mock';
}

export function InitializationBanner({ 
  supabaseAvailable, 
  winesInitialized, 
  source 
}: InitializationBannerProps) {
  if (supabaseAvailable && winesInitialized && source === 'supabase') {
    return null; // Everything working, no banner needed
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-400 p-4 mb-6">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {!supabaseAvailable ? (
            <AlertCircle className="h-5 w-5 text-yellow-400" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-400" />
          )}
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-blue-800">
            {!supabaseAvailable && "Supabase non disponível"}
            {supabaseAvailable && !winesInitialized && "Inicialização em curso"}
            {supabaseAvailable && source === 'mock' && "Modo demonstração"}
          </h3>
          <div className="mt-2 text-sm text-blue-700">
            {!supabaseAvailable && (
              <div className="space-y-2">
                <p>Supabase não está configurado. A aplicação funciona em modo demonstração.</p>
                <div className="flex items-center space-x-2">
                  <Database className="h-4 w-4" />
                  <span>Dados: Mock (temporários)</span>
                </div>
              </div>
            )}
            {supabaseAvailable && source === 'mock' && (
              <div className="space-y-2">
                <p>Supabase configurado mas a usar dados de demonstração.</p>
                <div className="flex items-center space-x-2">
                  <Database className="h-4 w-4" />
                  <span>Dados: Demonstração</span>
                </div>
              </div>
            )}
            {supabaseAvailable && winesInitialized && source === 'supabase' && (
              <div className="space-y-2">
                <p>✅ Supabase configurado e operacional</p>
                <div className="flex items-center space-x-2">
                  <Database className="h-4 w-4" />
                  <span>Dados: Supabase (tempo real)</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}