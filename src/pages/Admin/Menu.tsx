import { useState } from 'react';
import { BarChart3, TrendingUp, Users, ShoppingBag } from 'lucide-react';

export function Menu() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary-800">Estatísticas do Menu</h1>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-12">
          <BarChart3 className="h-16 w-16 text-primary-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-primary-800 mb-2">
            Estatísticas do menu
          </h2>
          <p className="text-primary-600 mb-6">
            Esta secção mostrará as estatísticas detalhadas sobre o desempenho do seu menu.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="bg-primary-50 p-4 rounded-lg">
              <TrendingUp className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <h3 className="font-semibold text-primary-800">Tendências</h3>
              <p className="text-sm text-primary-600">Produtos mais populares</p>
            </div>
            <div className="bg-primary-50 p-4 rounded-lg">
              <Users className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <h3 className="font-semibold text-primary-800">Preferências</h3>
              <p className="text-sm text-primary-600">Gostos dos clientes</p>
            </div>
            <div className="bg-primary-50 p-4 rounded-lg">
              <ShoppingBag className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <h3 className="font-semibold text-primary-800">Desempenho</h3>
              <p className="text-sm text-primary-600">Faturação por produto</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}