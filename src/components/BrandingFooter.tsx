interface BrandingFooterProps {
    isStatic?: boolean;
}

export function BrandingFooter({ isStatic = false }: BrandingFooterProps) {
    if (isStatic) {
        return (
            <div className="flex justify-center mt-2 mb-4">
                <div className="bg-black/60 backdrop-blur-sm text-white py-1 px-3 rounded-lg shadow-xl border border-gray-800/50 flex items-center space-x-2 text-[9px] font-bold tracking-widest uppercase">
                    <span className="opacity-80">DEVELOPED BY</span>
                    <a
                        href="https://digismartai.netlify.app/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:scale-110 transition-transform duration-200 block"
                        title="Visitar DigiSmart"
                    >
                        <img
                            src="/digismart_logo.png"
                            alt="DigiSmart Logo"
                            className="h-4 object-contain"
                        />
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 z-[100] hidden sm:block">
            <div className="bg-black/60 backdrop-blur-sm text-white py-1 px-3 rounded-lg shadow-xl border border-gray-800/50 flex items-center space-x-2 text-xs font-bold tracking-widest uppercase">
                <span className="opacity-80">DEVELOPED BY</span>
                <a
                    href="https://digismartai.netlify.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:scale-110 transition-transform duration-200 block"
                    title="Visitar DigiSmart"
                >
                    <img
                        src="/digismart_logo.png"
                        alt="DigiSmart Logo"
                        className="h-6 object-contain"
                    />
                </a>
            </div>
        </div>
    );
}
