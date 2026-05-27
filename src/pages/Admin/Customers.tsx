import { useState } from 'react';
import { Search, Phone, MapPin, Calendar, ShoppingBag } from 'lucide-react';
import { useOrderStore } from '../../stores/orderStore';

export function Customers() {
  const { orders } = useOrderStore();
  const [searchTerm, setSearchTerm] = useState('');

  // Créer une map des clients avec leurs commandes
  const customerMap = new Map();
  orders.forEach(order => {
    const customer = customerMap.get(order.user_id) || {
      id: order.user_id,
      ...order.user,
      total_orders: 0,
      total_spent: 0,
      last_order: order.created_at
    };

    customer.total_orders += 1;
    customer.total_spent += order.total;
    customer.last_order = new Date(order.created_at) > new Date(customer.last_order)
      ? order.created_at
      : customer.last_order;

    customerMap.set(order.user_id, customer);
  });

  const customers = Array.from(customerMap.values());

  const filteredCustomers = customers.filter(customer =>
    customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary-800">Gestão de Clientes</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary-400 h-5 w-5" />
        <input
          type="text"
          placeholder="Pesquisar por nome ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-primary-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Cliente</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Contacto</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Morada</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Encomendas</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Total Gasto</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Última Encomenda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-primary-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-primary-800">{customer.full_name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2 text-sm text-primary-600">
                      <Phone className="h-4 w-4" />
                      <span>{customer.phone}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <MapPin className="h-4 w-4" />
                      <span>{customer.address}</span>
                    </a>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2 text-sm text-primary-600">
                      <ShoppingBag className="h-4 w-4" />
                      <span>{customer.total_orders} {customer.total_orders === 1 ? 'encomenda' : 'encomendas'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-primary-800">
                      {customer.total_spent.toFixed(2)}€
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2 text-sm text-primary-600">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(customer.last_order).toLocaleDateString('pt-PT', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}