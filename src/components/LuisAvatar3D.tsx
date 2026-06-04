const GOLD = '#C8A96E';

export function LuisAvatar3D({ talking = false }: { talking?: boolean }) {
  return (
    <div style={{ width: '100%', height: 160, background: 'transparent', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img
        src="/lui.png"
        alt="Luis"
        style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
      />

      {talking && (
        <div style={{
          position: 'absolute', bottom: 8, right: 12,
          display: 'flex', alignItems: 'flex-end', gap: 3,
          background: 'rgba(0,0,0,0.40)', borderRadius: 8, padding: '3px 7px',
        }}>
          {[0.5, 0.9, 1.2, 0.8, 1.0, 0.6, 1.1].map((h, i) => (
            <div key={i} style={{
              width: 3, borderRadius: 2, background: GOLD,
              height: `${h * 16}px`,
              animation: `soundBar ${0.4 + i * 0.07}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.06}s`,
            }} />
          ))}
        </div>
      )}
    </div>
  );
}
