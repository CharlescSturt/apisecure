import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { encryptSecureDrop } from './crypto';

// Terminal Component
function Terminal({
  onEncrypt,
  isEncrypting,
  encryptedOutput,
  progress,
  status
}: {
  onEncrypt: (apiKey: string, passphrase: string) => void | Promise<void>;
  isEncrypting: boolean;
  encryptedOutput: string;
  progress: number;
  status: string;
}) {
  const [apiKey, setApiKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [isPoweredOn, setIsPoweredOn] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scrambleText, setScrambleText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate random passphrase on mount
  useEffect(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassphrase(result);
  }, []);

  // Power-on animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFlash(true);
      setTimeout(() => {
        setShowFlash(false);
        setIsPoweredOn(true);
      }, 150);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Text scramble effect during encryption
  useEffect(() => {
    if (isEncrypting && progress < 100) {
      const interval = setInterval(() => {
        const hexChars = '0123456789ABCDEF';
        let result = '';
        for (let i = 0; i < 32; i++) {
          result += hexChars.charAt(Math.floor(Math.random() * hexChars.length));
        }
        setScrambleText('0x' + result);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isEncrypting, progress]);

  const handleEncrypt = async () => {
    if (apiKey.trim() && !isEncrypting) {
      await onEncrypt(apiKey, passphrase);
    }
  };

  const handleCopy = async () => {
    if (encryptedOutput) {
      await navigator.clipboard.writeText(encryptedOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isEncrypting) {
      handleEncrypt();
    }
  };

  return (
    <div 
      className={`crt-curve relative transition-all duration-300 ${
        isPoweredOn ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98] translate-y-3'
      }`}
      style={{ willChange: 'transform, opacity' }}
    >
      {/* Power-on flash */}
      {showFlash && (
        <div className="absolute inset-0 bg-white opacity-25 z-50 power-flash rounded-[18px]" />
      )}

      {/* Screen wipe effect */}
      {!isPoweredOn && showFlash && (
        <div 
          className="absolute inset-0 bg-[#33FF00] opacity-20 z-40 screen-wipe rounded-[18px]"
          style={{ transformOrigin: 'top' }}
        />
      )}

      {/* Main terminal container */}
      <div className="crt-screen bg-[#061A1A]/95 backdrop-blur-sm p-6 md:p-8 min-w-[320px] md:min-w-[600px] lg:min-w-[720px]">
        {/* Scanline bar */}
        <div className="scanline-bar" />

        {/* Title bar */}
        <div className="flex items-center justify-between mb-6 border-b border-[#33FF00]/30 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#33FF00] animate-pulse" />
            <span className="phosphor-glow text-lg tracking-widest">SECURE TERMINAL v2.7</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="phosphor-glow-dim text-sm">{status}</span>
            <div 
              className={`w-2 h-2 rounded-full ${
                status === 'READY' ? 'bg-[#33FF00]' : 
                status === 'ENCRYPTING...' ? 'bg-[#FFB347] animate-pulse' : 
                'bg-[#33FF00]'
              }`} 
            />
          </div>
        </div>

        {/* Input fields */}
        <div className="space-y-5">
          {/* API Key input */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
            <label className="phosphor-glow text-lg whitespace-nowrap min-w-[140px]">
              &gt; API_KEY:
            </label>
            <div className="flex-1 flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isEncrypting}
                className="retro-input flex-1 w-full"
                placeholder="ENTER_KEY..."
                spellCheck={false}
                autoComplete="off"
              />
              {!isEncrypting && apiKey && (
                <span className="cursor-blink phosphor-glow">_</span>
              )}
              {isEncrypting && <span className="cursor-block" />}
            </div>
          </div>

          {/* Passphrase display */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
            <label className="phosphor-glow text-lg whitespace-nowrap min-w-[140px]">
              &gt; PASSPHRASE:
            </label>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                disabled={isEncrypting}
                className="retro-input flex-1 w-full opacity-70"
                spellCheck={false}
                autoComplete="off"
              />
              {isEncrypting && <span className="cursor-block" />}
            </div>
          </div>

          {/* Progress bar */}
          {isEncrypting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="phosphor-glow-dim text-sm">ENCRYPTING...</span>
                <span className="phosphor-glow text-sm">{progress}%</span>
              </div>
              <div className="retro-progress">
                <div 
                  className="retro-progress-fill progress-glow"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {/* Binary rain effect */}
              <div className="h-6 overflow-hidden relative">
                {Array.from({ length: 8 }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute phosphor-glow-dim text-xs binary-rain"
                    style={{
                      left: `${i * 12 + 5}%`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  >
                    {Math.random() > 0.5 ? '01001010' : '10110101'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Scrambling output */}
          {isEncrypting && progress < 100 && (
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
              <label className="phosphor-glow-dim text-lg whitespace-nowrap min-w-[140px]">
                &gt; PROCESSING:
              </label>
              <span className="phosphor-glow text-lg font-mono tracking-wider">
                {scrambleText}
              </span>
            </div>
          )}

          {/* Encrypted output */}
          {encryptedOutput && !isEncrypting && (
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row md:items-start gap-2 md:gap-4">
                <label className="phosphor-glow text-lg whitespace-nowrap min-w-[140px]">
                  &gt; ENCRYPTED_OUTPUT:
                </label>
                <div className="flex-1">
                  <div className="bg-[#0B3D3D]/50 border border-[#33FF00]/30 p-3 rounded font-mono text-sm phosphor-glow break-all">
                    {encryptedOutput}
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleCopy}
                  className={`retro-button amber text-sm ${copied ? 'bg-[#FFB347] text-[#061A1A]' : ''}`}
                >
                  {copied ? '[ COPIED ]' : '[ COPY TO CLIPBOARD ]'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleEncrypt}
            disabled={isEncrypting || !apiKey.trim()}
            className={`retro-button ${isEncrypting || !apiKey.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            [ {isEncrypting ? 'PROCESSING...' : 'ENCRYPT'} ]
          </button>
        </div>

        {/* Screen reflection/glare overlay */}
        <div 
          className="absolute inset-0 pointer-events-none rounded-[14px]"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.02) 100%)',
          }}
        />

        {/* Green flash on completion */}
        {encryptedOutput && !isEncrypting && (
          <div className="absolute inset-0 bg-[#33FF00] opacity-0 pointer-events-none green-flash rounded-[14px]" />
        )}
      </div>
    </div>
  );
}

// Dust Particles Component
function DustParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
    }> = [];

    // Create particles
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.3 - 0.1,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.4 + 0.2,
      });
    }

    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Reset particle when it goes off screen
        if (p.y < -10) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
        }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 179, 71, ${p.opacity})`;
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-20"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}

// Background Monitor Component
function BackgroundMonitor({ 
  position, 
  codeLines 
}: { 
  position: 'left' | 'right';
  codeLines: string[];
}) {
  return (
    <div 
      className={`absolute ${
        position === 'left' 
          ? 'left-[5%] top-[15%] w-[35%] h-[40%]' 
          : 'right-[8%] top-[18%] w-[30%] h-[35%]'
      }`}
    >
      <div className="relative w-full h-full crt-screen overflow-hidden">
        {/* Screen content */}
        <div className="absolute inset-0 bg-[#061A1A] p-3 overflow-hidden">
          <div className="code-scroll space-y-1">
            {[...codeLines, ...codeLines].map((line, i) => (
              <div 
                key={i} 
                className={`text-xs md:text-sm font-mono ${
                  line.startsWith('&gt;') ? 'phosphor-glow' : 'phosphor-glow-dim'
                }`}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
        
        {/* Scanlines */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px)',
          }}
        />
        
        {/* Screen flicker */}
        <div className="absolute inset-0 bg-[#33FF00] opacity-0 screen-flicker pointer-events-none" />
      </div>
    </div>
  );
}

// Main App Component
function App() {
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptedOutput, setEncryptedOutput] = useState('');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('READY');

  // Sample code lines for background monitors
  const leftMonitorCode = [
    '&gt; handshake_init 0x4F2A...',
    '&gt; ping 12ms',
    '&gt; route_via_node_7',
    '&gt; encrypt_channel AES-256',
    '&gt; verifying_checksum...',
    '&gt; connection_established',
    '&gt; listening_port 8080',
    '&gt; packet_received 1024b',
    '&gt; decrypting_payload...',
    '&gt; auth_token_valid',
    '&gt; session_timeout 3600s',
    '&gt; heartbeat_sent',
  ];

  const rightMonitorCode = [
    '0x7F3A: KERNEL_LOADED',
    '0x8B2C: MEM_ALLOC 4096',
    '0x9D1E: PROC_SPAWN /bin/sh',
    '0xA4F7: SOCKET_OPEN',
    '0xB8E3: DATA_STREAM_OK',
    '0xC5A9: BUFFER_FLUSH',
    '0xD2B6: INTERRUPT_HANDLED',
    '0xE8C4: DMA_TRANSFER',
    '0xF1D7: CACHE_HIT 94%',
    '0x10A3: THREAD_SYNC',
    '0x21B5: MUTEX_LOCK',
    '0x32C8: SEMAPHORE_WAIT',
  ];

  const handleEncrypt = useCallback(async (apiKey: string, passphrase: string) => {
    setIsEncrypting(true);
    setEncryptedOutput('');
    setProgress(0);
    setStatus('ENCRYPTING...');

    // Simulate progress while actually encrypting
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += Math.random() * 8 + 2;
      if (currentProgress >= 90) {
        currentProgress = 90;
      }
      setProgress(Math.floor(currentProgress));
    }, 80);

    try {
      // Real AES-256-GCM encryption
      const encrypted = await encryptSecureDrop(apiKey, passphrase);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      setTimeout(() => {
        setEncryptedOutput(encrypted);
        setIsEncrypting(false);
        setStatus('COMPLETE');
      }, 200);
    } catch (error) {
      clearInterval(progressInterval);
      setIsEncrypting(false);
      setStatus('ERROR');
      console.error('Encryption failed:', error);
    }
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#061A1A]">
      {/* Background desk scene image */}
      <div className="fixed inset-0 z-0">
        <img
          src="/desk-scene.jpg"
          alt="Retro hacker desk"
          className="w-full h-full object-cover"
        />
        {/* Dark overlay for better contrast */}
        <div className="absolute inset-0 bg-[#061A1A]/40" />
      </div>

      {/* Lamp light overlay */}
      <div 
        className="fixed inset-0 z-1 pointer-events-none lamp-flicker"
        style={{
          background: 'radial-gradient(ellipse at 25% 30%, rgba(255, 179, 71, 0.15) 0%, transparent 50%)',
        }}
      />

      {/* Background monitors with scrolling code */}
      <div className="fixed inset-0 z-5 pointer-events-none">
        <BackgroundMonitor position="left" codeLines={leftMonitorCode} />
        <BackgroundMonitor position="right" codeLines={rightMonitorCode} />
      </div>

      {/* Dust particles */}
      <DustParticles />

      {/* Vignette overlay */}
      <div className="vignette" />

      {/* Film grain overlay */}
      <div className="film-grain" />

      {/* Main terminal overlay */}
      <div className="fixed inset-0 z-30 flex items-center justify-center p-4">
        <Terminal
          onEncrypt={handleEncrypt}
          isEncrypting={isEncrypting}
          encryptedOutput={encryptedOutput}
          progress={progress}
          status={status}
        />
      </div>

      {/* Corner decorations */}
      <div className="fixed bottom-4 left-4 z-40 phosphor-glow-dim text-xs">
        SYS.TIME: {new Date().toLocaleTimeString()}
      </div>
      <div className="fixed bottom-4 right-4 z-40 phosphor-glow-dim text-xs">
        RETRO CRYPT // 1987
      </div>

      {/* SVG filters for chromatic aberration */}
      <svg className="absolute w-0 h-0">
        <defs>
          <filter id="red-channel">
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
            />
          </filter>
          <filter id="blue-channel">
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 1 0 0
                      0 0 0 1 0"
            />
          </filter>
        </defs>
      </svg>
    </div>
  );
}

export default App;
