import { useState, useRef, useEffect } from 'react';
import { Gift, Image as ImageIcon, Trash2, Check, Upload, Eye } from 'lucide-react';
import { PromotionsManager } from '../../components/PromotionsManager';
import { useCaveSettings } from '../../hooks/useCaveSettings';
import { bannerGalleryService } from '../../services/supabaseService';
import { useAuth } from '../../hooks/useAuth';



export function CavePromotions() {
    const { settings, updateSettings, loading } = useCaveSettings();
    const [gallery, setGallery] = useState<{ id: string; url: string; name: string }[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Subscribe to banner gallery
    useEffect(() => {
        const unsubscribe = bannerGalleryService.subscribeToGallery(
            (images) => {
                setGallery(images);
            },
            (err) => {
                console.error('SUBSCRIPTION ERROR:', err);
            }
        );
        return () => unsubscribe();
    }, []);

    const convertImageToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200; // Increased slightly for better quality
                    let width = img.width;
                    let height = img.height;

                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    // Optimized compression
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
                    resolve(dataUrl);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Por favor selecione um arquivo de imagem.');
            return;
        }

        setIsUploading(true);
        setUploadStatus('A processar...');

        try {
            const base64String = await convertImageToBase64(file);

            if (base64String.length > 900000) {
                throw new Error('A imagem é muito grande (limite 900KB). Tente uma imagem menor.');
            }

            setUploadStatus('A guardar na galeria...');
            await bannerGalleryService.addImage(base64String, file.name);

            setUploadStatus('A ativar banner...');
            const success = await updateSettings({
                banner_image_url: base64String,
                banner_active: true
            });

            if (!success) {
                throw new Error('Erro ao atualizar configurações. Verifique as permissões da coleção "settings".');
            }

            alert('Imagem adicionada ao stock e ativada!');
        } catch (err: any) {
            console.error('UPLOAD ERROR:', err);
            alert(err.message || 'Erro ao carregar imagem.');
        } finally {
            setIsUploading(false);
            setUploadStatus('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteImage = async (id: string, url: string) => {
        if (!confirm('Tem a certeza que deseja remover esta imagem do stock?')) return;

        try {
            await bannerGalleryService.deleteImage(id);
            if (settings.banner_image_url === url) {
                await updateSettings({
                    banner_image_url: '',
                    banner_active: false
                });
            }
        } catch (err) {
            alert('Erro ao eliminar imagem.');
        }
    };

    const handleSelectImage = async (url: string) => {
        await updateSettings({
            banner_image_url: url,
            banner_active: true
        });
    };

    const toggleBannerActive = async () => {
        if (!settings.banner_image_url && !settings.banner_active) {
            alert('Selecione uma imagem primeiro.');
            return;
        }
        await updateSettings({ banner_active: !settings.banner_active });
    };

    if (loading) {
        return <div className="p-8 text-center text-primary-600">A carregar configurações...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center space-x-3">
                    <Gift className="h-8 w-8 text-accent-500" />
                    <div>
                        <h1 className="text-3xl font-bold text-primary-800">Promoções e Marketing</h1>
                        <p className="text-primary-600">Gira as ofertas, descontos e o banner promocional da sua wineria</p>
                    </div>
                </div>
            </div>

            {/* Banner Promocional Section */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-primary-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-primary-900 flex items-center gap-2">
                            <ImageIcon className="text-accent-500" />
                            Banner Promocional do Menu
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Esta imagem aparecerá no topo da página do Menu para todos os clientes.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <span className={`text-sm font-medium ${settings.banner_active ? 'text-green-600' : 'text-gray-500'}`}>
                            {settings.banner_active ? 'Banner Visível' : 'Banner Oculto'}
                        </span>
                        <button
                            onClick={toggleBannerActive}
                            title={settings.banner_active ? 'Ocultar Banner' : 'Mostrar Banner'}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 ${settings.banner_active ? 'bg-green-500' : 'bg-gray-300'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.banner_active ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Active Banner Preview */}
                {settings.banner_image_url && (
                    <div className="mb-8">
                        <div className="flex justify-between items-end mb-2">
                            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Pré-visualização do Banner</h3>
                            {settings.banner_active && (
                                <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Check className="h-2.5 w-2.5" /> VISÍVEL NO MENU
                                </span>
                            )}
                        </div>
                        <div className={`relative w-full rounded-xl overflow-hidden shadow-md border-2 ${settings.banner_active ? 'border-green-500' : 'border-gray-200 opacity-50'}`}>
                            <img
                                src={settings.banner_image_url}
                                alt="Banner Ativo"
                                className="w-full h-auto object-contain bg-gray-50"
                                style={{ maxHeight: '400px' }}
                            />
                            {!settings.banner_active && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                                    <span className="bg-white/90 text-gray-800 px-4 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2">
                                        <Eye className="h-4 w-4 text-gray-400" /> Banner Oculto
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Gallery Management */}
                <div>
                    <div className="flex justify-between items-end mb-4">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Stock de Imagens</h3>

                        <div className="flex gap-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileUpload}
                                title="Escolher ficheiro de imagem"
                            />

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="text-sm bg-accent-500 text-white font-bold px-4 py-2 rounded-md hover:bg-accent-600 flex items-center gap-2 shadow-sm transition-all active:scale-95"
                                title="Adicionar nova imagem do computador"
                            >
                                {isUploading ? (
                                    <span className="animate-pulse flex items-center gap-2">
                                        <Upload className="h-4 w-4 animate-spin" />
                                        {uploadStatus || 'A carregar...'}
                                    </span>
                                ) : (
                                    <>
                                        <Upload className="h-4 w-4" />
                                        <span>Adicionar Nova Imagem ao PC</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {!gallery.length ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-400">
                            <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>O seu stock de imagens está vazio.</p>
                            <p className="text-xs">Carregue imagens do seu computador para usar como banner.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {(gallery || []).map((img) => (
                                <div
                                    key={img.id}
                                    className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${settings.banner_image_url === img.url
                                        ? 'border-accent-500 ring-2 ring-accent-200'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    onClick={() => handleSelectImage(img.url)}
                                >
                                    <img
                                        src={img.url}
                                        alt={img.name}
                                        className="w-full h-full object-cover"
                                    />

                                    {/* Overlay Actions */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteImage(img.id, img.url);
                                            }}
                                            className="bg-white text-red-500 p-2 rounded-full hover:bg-red-50 shadow-lg transform hover:scale-110 transition-all"
                                            title="Eliminar do Stock"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>

                                    {/* Active Badge on Thumbnail */}
                                    {settings.banner_image_url === img.url && (
                                        <div className="absolute top-2 right-2 bg-accent-500 text-white p-1 rounded-full shadow-md z-10">
                                            <Check className="h-3 w-3" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <PromotionsManager />
        </div>
    );
}
