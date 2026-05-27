import { useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import type { User, UserRole } from '../../types';

const ROLE_LABELS = {
  admin: 'Administrador',
  cave: 'Cave',
  client: 'Cliente'
};

export function Users() {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    role: 'cave' as UserRole,
    full_name: '',
    phone: '',
    address: ''
  });

  // ... Reste du code avec les traductions déjà en place
}