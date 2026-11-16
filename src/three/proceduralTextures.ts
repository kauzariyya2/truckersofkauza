import * as THREE from 'three';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
  grad.addColorStop(0, 'rgba(6, 9, 14, 0.82)');
  grad.addColorStop(0.55, 'rgba(6, 9, 14, 0.45)');
  grad.addColorStop(1, 'rgba(6, 9, 14, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createAsphaltTextures(maxAniso: number): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 512;
  const [cColor, ctxC] = makeCanvas(size, size);
  const [cRough, ctxR] = makeCanvas(size, size);

  // Rich dark twilight charcoal asphalt
  ctxC.fillStyle = '#12151c';
  ctxC.fillRect(0, 0, size, size);

  // Matte-to-satin roughness base (~215/255 = 0.84) with subtle damp tire-track variation
  ctxR.fillStyle = '#d4d4d4';
  ctxR.fillRect(0, 0, size, size);

  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 6000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const v = 14 + Math.floor(rand() * 18);
    ctxC.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    ctxC.fillRect(x, y, 2, 2);
  }

  // Broad, subtle damp sheen bands (no sharp polka-dot spots)
  for (let i = 0; i < 8; i++) {
    const px = rand() * size;
    const py = rand() * size;
    const rad = 85 + rand() * 110;
    const gR = ctxR.createRadialGradient(px, py, 10, px, py, rad);
    gR.addColorStop(0, 'rgba(130, 130, 130, 0.45)');
    gR.addColorStop(1, 'rgba(212, 212, 212, 0)');
    ctxR.fillStyle = gR;
    ctxR.beginPath();
    ctxR.arc(px, py, rad, 0, Math.PI * 2);
    ctxR.fill();
  }

  const map = new THREE.CanvasTexture(cColor);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(18, 18);
  map.anisotropy = maxAniso;

  const roughnessMap = new THREE.CanvasTexture(cRough);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(18, 18);
  roughnessMap.anisotropy = maxAniso;

  return { map, roughnessMap };
}

/**
 * Recreates the Foton Auman Galaxy side cab panel livery from the user's reference photo:
 * metallic silver-grey base, diagonal obsidian black rear sleeper wedge,
 * crowned lion emblem silhouette, and "AUMAN GALAXY" side badging.
 */
export function createAumanSideLiveryTexture(maxAniso: number, flipSide = false): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);

  // Metallic silver cab body background
  const bodyGrad = ctx.createLinearGradient(0, 0, 0, 512);
  bodyGrad.addColorStop(0, '#9ba4b0');
  bodyGrad.addColorStop(0.45, '#b8c0ca');
  bodyGrad.addColorStop(0.8, '#8c95a2');
  bodyGrad.addColorStop(1, '#58606b');
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.save();
  if (flipSide) {
    ctx.translate(512, 0);
    ctx.scale(-1, 1);
  }

  // Diagonal obsidian black rear sleeper & roof wrap
  ctx.fillStyle = '#12151a';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(310, 0);
  ctx.lineTo(250, 220);
  ctx.lineTo(380, 405);
  ctx.lineTo(0, 450);
  ctx.closePath();
  ctx.fill();

  // Sharp metallic accent swoosh
  ctx.strokeStyle = '#d4dbe4';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(295, 8);
  ctx.lineTo(246, 218);
  ctx.lineTo(378, 402);
  ctx.stroke();

  // Crowned Lion Crest (stylized vector silhouette matching reference sleeper panel)
  ctx.save();
  ctx.translate(185, 190);
  ctx.fillStyle = '#dde3ec';
  ctx.beginPath();
  ctx.moveTo(-26, -54);
  ctx.lineTo(-32, -78);
  ctx.lineTo(-14, -64);
  ctx.lineTo(0, -84);
  ctx.lineTo(14, -64);
  ctx.lineTo(32, -78);
  ctx.lineTo(26, -54);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-10, -48);
  ctx.quadraticCurveTo(36, -46, 46, -12);
  ctx.lineTo(54, 14);
  ctx.lineTo(36, 22);
  ctx.lineTo(42, 42);
  ctx.lineTo(16, 56);
  ctx.lineTo(-4, 78);
  ctx.lineTo(-22, 54);
  ctx.lineTo(-38, 32);
  ctx.lineTo(-46, 4);
  ctx.lineTo(-34, -28);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#12151a';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-6, -24);
  ctx.quadraticCurveTo(18, -14, 14, 12);
  ctx.moveTo(-18, -6);
  ctx.quadraticCurveTo(6, 6, 0, 34);
  ctx.moveTo(18, -22);
  ctx.lineTo(28, -16);
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // "AUMAN GALAXY" side door typography — always drawn unflipped left-to-right
  ctx.fillStyle = '#e7edf5';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText('AUMAN', flipSide ? 48 : 240, 346);
  ctx.fillStyle = '#7cd7ff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('GALAXY', flipSide ? 178 : 370, 346);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'italic 16px system-ui, sans-serif';
  ctx.fillText('Drive The Future', flipSide ? 48 : 210, 44);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createFotonVisorTexture(maxAniso: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 128);
  ctx.fillStyle = '#0e131a';
  ctx.fillRect(0, 0, 512, 128);

  // Cyan accent brow lines
  ctx.fillStyle = '#5eead4';
  ctx.fillRect(18, 98, 108, 6);
  ctx.fillRect(386, 98, 108, 6);

  // Glowing FOTON header lettering
  ctx.shadowColor = '#60a5fa';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#eef6ff';
  ctx.font = '900 54px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FOTON', 256, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createBumperPlateTexture(text: string, maxAniso: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 64);
  ctx.fillStyle = '#11161f';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 56);
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createCorrugatedTexture(baseHex: string, stripeHex: string, maxAniso: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x, 0, 5, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 6, 0, 3, 256);
  }
  ctx.fillStyle = stripeHex;
  ctx.fillRect(0, 112, 256, 24);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createTrailerLiveryTexture(
  maxAniso: number,
  flipSide = false,
  livery: 'auman_silver' | 'ocean_blue' | 'crimson_haul' | 'amber_chrome' = 'auman_silver',
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(1024, 256);

  const palettes = {
    auman_silver: {
      top: '#a6b0bc',
      mid: '#8f99a6',
      bot: '#68717d',
      wedge: '#12161d',
      accent: '#38bdf8',
      title: 'AUMAN GALAXY',
      sub: 'HEAVY LOGISTICS // 8x4 ARTICULATED HAUL',
    },
    ocean_blue: {
      top: '#1d4ed8',
      mid: '#1e40af',
      bot: '#172554',
      wedge: '#0f172a',
      accent: '#7dd3fc',
      title: 'PACIFIC PORT LINE',
      sub: '40FT INTERMODAL // CONTAINER FREIGHT',
    },
    crimson_haul: {
      top: '#b91c1c',
      mid: '#991b1b',
      bot: '#450a0a',
      wedge: '#18181b',
      accent: '#fbbf24',
      title: 'APEX HEAVY HAUL',
      sub: 'STEEL & INDUSTRIAL TRANSPORT',
    },
    amber_chrome: {
      top: '#d97706',
      mid: '#b45309',
      bot: '#78350f',
      wedge: '#111827',
      accent: '#fef08a',
      title: 'AUMAN ENERGY',
      sub: 'HAZMAT // PRESSURIZED TANKER DIVISION',
    },
  };
  const p = palettes[livery];

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, p.top);
  grad.addColorStop(0.55, p.mid);
  grad.addColorStop(1, p.bot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 256);

  // Subtle vertical structural panel ribs
  for (let x = 0; x < 1024; x += 32) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
    ctx.fillRect(x, 0, 3, 256);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(x + 3, 0, 2, 256);
  }

  // Diagonal obsidian-black aero wedge + accent stripe (flips end without mirroring text)
  ctx.save();
  if (flipSide) {
    ctx.translate(1024, 0);
    ctx.scale(-1, 1);
  }
  ctx.fillStyle = p.wedge;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(340, 0);
  ctx.lineTo(220, 256);
  ctx.lineTo(0, 256);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.moveTo(346, 0);
  ctx.lineTo(364, 0);
  ctx.lineTo(244, 256);
  ctx.lineTo(226, 256);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Always draw side lettering left-to-right so both +X and -X sides read cleanly
  const textX = flipSide ? 54 : 398;
  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 42px system-ui, sans-serif';
  ctx.fillText(p.title, textX, 128);
  ctx.fillStyle = p.accent;
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText(p.sub, textX + 2, 166);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

