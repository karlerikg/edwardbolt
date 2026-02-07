// Generate PNG icons from SVG for PWA home screen
import { readFileSync, writeFileSync } from 'fs';

// Read the SVG
const svg = readFileSync('icon.svg', 'utf8');

// Create a minimal PNG encoder (no dependencies needed)
// We'll create a simple solid-color icon with text as a PNG manually
// Actually, let's use a different approach — create a data URL canvas script

// For proper PNG generation, let's create an HTML file that renders and downloads
const html = `<!DOCTYPE html>
<html>
<body>
<canvas id="c" width="512" height="512"></canvas>
<script>
const sizes = [192, 512];
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const img = new Image();
img.onload = function() {
    sizes.forEach(size => {
        canvas.width = size;
        canvas.height = size;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        const link = document.createElement('a');
        link.download = 'icon-' + size + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
};
img.src = 'icon.svg';
<\/script>
</body>
</html>`;

writeFileSync('generate-icons.html', html);
console.log('Open generate-icons.html in a browser to download PNG icons.');
console.log('Or use the approach below to create icons directly...');

// Alternative: create simple PNG icons programmatically (pure Node.js, no canvas)
// We'll encode a minimal valid PNG with the mystery theme colors

function createPNG(size) {
    // Simple approach: create raw RGBA pixel data and encode as PNG
    const pixels = new Uint8Array(size * size * 4);
    const cx = size / 2, cy = size / 2;
    const r = size * 0.47; // border radius
    const ringCx = size * 0.43, ringCy = size * 0.43;
    const ringR = size * 0.234;
    const ringR2 = ringR * 0.9;
    
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            const dx = x - cx, dy = y - cy;
            
            // Rounded rect check
            const margin = size * 0.156;
            const cornerR = size * 0.156;
            let inside = true;
            // Check corners
            if (x < margin && y < margin) {
                inside = Math.sqrt((x - margin) ** 2 + (y - margin) ** 2) <= cornerR;
            } else if (x >= size - margin && y < margin) {
                inside = Math.sqrt((x - (size - margin)) ** 2 + (y - margin) ** 2) <= cornerR;
            } else if (x < margin && y >= size - margin) {
                inside = Math.sqrt((x - margin) ** 2 + (y - (size - margin)) ** 2) <= cornerR;
            } else if (x >= size - margin && y >= size - margin) {
                inside = Math.sqrt((x - (size - margin)) ** 2 + (y - (size - margin)) ** 2) <= cornerR;
            }
            
            if (!inside) {
                pixels[i] = pixels[i+1] = pixels[i+2] = pixels[i+3] = 0;
                continue;
            }
            
            // Background gradient
            const distFromCenter = Math.sqrt(dx*dx + dy*dy) / (size * 0.7);
            const bg = Math.max(0, Math.min(1, 1 - distFromCenter));
            let cr = 5 + bg * 21, cg = 4 + bg * 16, cb = 3 + bg * 5;
            let ca = 255;
            
            // Magnifying glass ring
            const rdx = x - ringCx, rdy = y - ringCy;
            const ringDist = Math.sqrt(rdx*rdx + rdy*rdy);
            const ringWidth = size * 0.027;
            
            if (Math.abs(ringDist - ringR) < ringWidth) {
                // Gold ring
                cr = 200; cg = 168; cb = 80;
            }
            
            // Glass interior (subtle tint)
            if (ringDist < ringR - ringWidth) {
                cr = cr * 0.85 + 200 * 0.05;
                cg = cg * 0.85 + 180 * 0.05;
                cb = cb * 0.85 + 120 * 0.03;
            }
            
            // Handle
            const handleStartX = ringCx + ringR * 0.65;
            const handleStartY = ringCy + ringR * 0.65;
            const handleEndX = size * 0.82;
            const handleEndY = size * 0.86;
            // Distance from line segment
            const hlx = handleEndX - handleStartX;
            const hly = handleEndY - handleStartY;
            const hLen = Math.sqrt(hlx*hlx + hly*hly);
            const hnx = hlx/hLen, hny = hly/hLen;
            const hpx = x - handleStartX, hpy = y - handleStartY;
            const hProj = hpx * hnx + hpy * hny;
            if (hProj >= 0 && hProj <= hLen) {
                const hPerp = Math.abs(hpx * hny - hpy * hnx);
                if (hPerp < size * 0.025) {
                    cr = 138; cg = 106; cb = 48;
                }
            }
            
            // Skull eyes (two dark circles)
            const eyeL = Math.sqrt((x - (ringCx - size*0.033))**2 + (y - (ringCy - size*0.04))**2);
            const eyeR = Math.sqrt((x - (ringCx + size*0.033))**2 + (y - (ringCy - size*0.04))**2);
            const eyeSize = size * 0.027;
            if (eyeL < eyeSize || eyeR < eyeSize) {
                cr = 200; cg = 180; cb = 122;
            }
            
            // Skull outline (ellipse)
            const skullDx = (x - ringCx) / (size * 0.094);
            const skullDy = (y - (ringCy - size*0.01)) / (size * 0.082);
            const skullDist = Math.sqrt(skullDx*skullDx + skullDy*skullDy);
            if (Math.abs(skullDist - 1) < 0.12) {
                cr = 200; cg = 180; cb = 122; ca = 200;
            }
            
            // III text area (simple 3 vertical bars)
            const textY = size * 0.76;
            const textH = size * 0.06;
            const barW = size * 0.012;
            const barGap = size * 0.04;
            if (y > textY && y < textY + textH) {
                for (let b = -1; b <= 1; b++) {
                    const barX = cx + b * barGap;
                    if (Math.abs(x - barX) < barW) {
                        cr = 200; cg = 180; cb = 122; ca = 150;
                    }
                }
            }
            
            pixels[i] = Math.round(cr);
            pixels[i+1] = Math.round(cg);
            pixels[i+2] = Math.round(cb);
            pixels[i+3] = ca;
        }
    }
    
    return encodePNG(size, size, pixels);
}

function encodePNG(width, height, pixels) {
    // Minimal PNG encoder
    function crc32(buf) {
        let c = -1;
        for (let i = 0; i < buf.length; i++) {
            c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
        }
        return (c ^ -1) >>> 0;
    }
    
    const crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c;
    }
    
    function adler32(data) {
        let a = 1, b = 0;
        for (let i = 0; i < data.length; i++) {
            a = (a + data[i]) % 65521;
            b = (b + a) % 65521;
        }
        return ((b << 16) | a) >>> 0;
    }
    
    // Build raw image data (filter byte 0 = None for each row)
    const rawData = new Uint8Array(height * (1 + width * 4));
    for (let y = 0; y < height; y++) {
        rawData[y * (1 + width * 4)] = 0; // filter: None
        for (let x = 0; x < width * 4; x++) {
            rawData[y * (1 + width * 4) + 1 + x] = pixels[y * width * 4 + x];
        }
    }
    
    // Deflate (store only, no compression — simple but larger)
    const blocks = [];
    const BLOCK_SIZE = 65535;
    for (let i = 0; i < rawData.length; i += BLOCK_SIZE) {
        const end = Math.min(i + BLOCK_SIZE, rawData.length);
        const isLast = end === rawData.length;
        const len = end - i;
        const block = new Uint8Array(5 + len);
        block[0] = isLast ? 1 : 0;
        block[1] = len & 0xff;
        block[2] = (len >> 8) & 0xff;
        block[3] = (~len) & 0xff;
        block[4] = ((~len) >> 8) & 0xff;
        block.set(rawData.subarray(i, end), 5);
        blocks.push(block);
    }
    
    const totalDeflated = blocks.reduce((s, b) => s + b.length, 0);
    const zlibData = new Uint8Array(2 + totalDeflated + 4);
    zlibData[0] = 0x78; zlibData[1] = 0x01; // zlib header
    let off = 2;
    for (const block of blocks) { zlibData.set(block, off); off += block.length; }
    const adler = adler32(rawData);
    zlibData[off] = (adler >> 24) & 0xff;
    zlibData[off+1] = (adler >> 16) & 0xff;
    zlibData[off+2] = (adler >> 8) & 0xff;
    zlibData[off+3] = adler & 0xff;
    
    function makeChunk(type, data) {
        const chunk = new Uint8Array(12 + data.length);
        const dv = new DataView(chunk.buffer);
        dv.setUint32(0, data.length);
        chunk[4] = type.charCodeAt(0);
        chunk[5] = type.charCodeAt(1);
        chunk[6] = type.charCodeAt(2);
        chunk[7] = type.charCodeAt(3);
        chunk.set(data, 8);
        const crcBuf = chunk.subarray(4, 8 + data.length);
        dv.setUint32(8 + data.length, crc32(crcBuf));
        return chunk;
    }
    
    // IHDR
    const ihdr = new Uint8Array(13);
    const ihdrDv = new DataView(ihdr.buffer);
    ihdrDv.setUint32(0, width);
    ihdrDv.setUint32(4, height);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    
    const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdrChunk = makeChunk('IHDR', ihdr);
    const idatChunk = makeChunk('IDAT', zlibData);
    const iendChunk = makeChunk('IEND', new Uint8Array(0));
    
    const png = new Uint8Array(signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length);
    let p = 0;
    png.set(signature, p); p += signature.length;
    png.set(ihdrChunk, p); p += ihdrChunk.length;
    png.set(idatChunk, p); p += idatChunk.length;
    png.set(iendChunk, p);
    
    return Buffer.from(png);
}

// Generate icons
[192, 512].forEach(size => {
    const png = createPNG(size);
    writeFileSync(`icon-${size}.png`, png);
    console.log(`Created icon-${size}.png (${png.length} bytes)`);
});
