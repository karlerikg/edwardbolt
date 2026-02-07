// Minimal GLB generator — writes furniture models as GLB binary files
// GLB format: Header(12) + JSON chunk + BIN chunk
import { writeFileSync } from 'fs';

function f32(arr) { return new Float32Array(arr); }
function u16(arr) { return new Uint16Array(arr); }

function boxGeometry(w, h, d) {
    const hw = w/2, hh = h/2, hd = d/2;
    const positions = [
        -hw,-hh, hd,  hw,-hh, hd,  hw, hh, hd, -hw, hh, hd,
        -hw,-hh,-hd, -hw, hh,-hd,  hw, hh,-hd,  hw,-hh,-hd,
        -hw, hh,-hd, -hw, hh, hd,  hw, hh, hd,  hw, hh,-hd,
        -hw,-hh,-hd,  hw,-hh,-hd,  hw,-hh, hd, -hw,-hh, hd,
         hw,-hh,-hd,  hw, hh,-hd,  hw, hh, hd,  hw,-hh, hd,
        -hw,-hh,-hd, -hw,-hh, hd, -hw, hh, hd, -hw, hh,-hd,
    ];
    const normals = [
        0,0,1, 0,0,1, 0,0,1, 0,0,1,
        0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
        0,1,0, 0,1,0, 0,1,0, 0,1,0,
        0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
        1,0,0, 1,0,0, 1,0,0, 1,0,0,
        -1,0,0, -1,0,0, -1,0,0, -1,0,0,
    ];
    const indices = [];
    for (let i = 0; i < 6; i++) {
        const o = i * 4;
        indices.push(o, o+1, o+2, o, o+2, o+3);
    }
    return { positions: f32(positions), normals: f32(normals), indices: u16(indices) };
}

function cylinderGeometry(rTop, rBot, h, segs) {
    segs = segs || 8;
    const positions = [], normals = [], indices = [];
    const hh = h/2;
    for (let i = 0; i <= segs; i++) {
        const a = (i/segs) * Math.PI * 2;
        const cos = Math.cos(a), sin = Math.sin(a);
        positions.push(rBot*cos, -hh, rBot*sin);
        normals.push(cos, 0, sin);
        positions.push(rTop*cos,  hh, rTop*sin);
        normals.push(cos, 0, sin);
    }
    for (let i = 0; i < segs; i++) {
        const a = i*2, b = a+1, c = a+2, d = a+3;
        indices.push(a,c,b, b,c,d);
    }
    const topCenter = positions.length/3;
    positions.push(0, hh, 0); normals.push(0,1,0);
    for (let i = 0; i <= segs; i++) {
        const a = (i/segs) * Math.PI * 2;
        positions.push(rTop*Math.cos(a), hh, rTop*Math.sin(a));
        normals.push(0,1,0);
    }
    for (let i = 0; i < segs; i++) indices.push(topCenter, topCenter+1+i, topCenter+2+i);
    const botCenter = positions.length/3;
    positions.push(0, -hh, 0); normals.push(0,-1,0);
    for (let i = 0; i <= segs; i++) {
        const a = (i/segs) * Math.PI * 2;
        positions.push(rBot*Math.cos(a), -hh, rBot*Math.sin(a));
        normals.push(0,-1,0);
    }
    for (let i = 0; i < segs; i++) indices.push(botCenter, botCenter+2+i, botCenter+1+i);
    return { positions: f32(positions), normals: f32(normals), indices: u16(indices) };
}

function sphereGeometry(r, ws, hs) {
    ws = ws || 8; hs = hs || 6;
    const positions = [], normals = [], indices = [];
    for (let y = 0; y <= hs; y++) {
        const v = y/hs, phi = v * Math.PI;
        for (let x = 0; x <= ws; x++) {
            const u = x/ws, theta = u * Math.PI * 2;
            const nx = Math.cos(theta)*Math.sin(phi), ny = Math.cos(phi), nz = Math.sin(theta)*Math.sin(phi);
            positions.push(r*nx, r*ny, r*nz);
            normals.push(nx, ny, nz);
        }
    }
    for (let y = 0; y < hs; y++)
        for (let x = 0; x < ws; x++) {
            const a = y*(ws+1)+x, b = a+ws+1;
            indices.push(a, b, a+1, b, b+1, a+1);
        }
    return { positions: f32(positions), normals: f32(normals), indices: u16(indices) };
}

function mergeGeometries(parts) {
    let totalVerts = 0, totalIdx = 0;
    for (const p of parts) {
        totalVerts += p.geo.positions.length / 3;
        totalIdx += p.geo.indices.length;
    }
    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const colors = new Float32Array(totalVerts * 3);
    const indices = new Uint16Array(totalIdx);
    let vOff = 0, iOff = 0, vCount = 0;
    for (const p of parts) {
        const g = p.geo;
        const [tx,ty,tz] = p.translate || [0,0,0];
        const ry = p.rotate_y || 0;
        const cosR = Math.cos(ry), sinR = Math.sin(ry);
        const col = p.color || [0.5, 0.3, 0.15];
        const nv = g.positions.length / 3;
        for (let i = 0; i < nv; i++) {
            let x = g.positions[i*3], y = g.positions[i*3+1], z = g.positions[i*3+2];
            const rx = x*cosR - z*sinR, rz = x*sinR + z*cosR;
            positions[vOff+i*3] = rx+tx; positions[vOff+i*3+1] = y+ty; positions[vOff+i*3+2] = rz+tz;
            let nx = g.normals[i*3], ny = g.normals[i*3+1], nz = g.normals[i*3+2];
            normals[vOff+i*3] = nx*cosR-nz*sinR; normals[vOff+i*3+1] = ny; normals[vOff+i*3+2] = nx*sinR+nz*cosR;
            colors[vOff+i*3] = col[0]; colors[vOff+i*3+1] = col[1]; colors[vOff+i*3+2] = col[2];
        }
        for (let i = 0; i < g.indices.length; i++) indices[iOff+i] = g.indices[i] + vCount;
        vOff += nv * 3; iOff += g.indices.length; vCount += nv;
    }
    return { positions, normals, colors, indices, vertexCount: totalVerts, indexCount: totalIdx };
}

function writeGLB(filename, merged) {
    const { positions, normals, colors, indices, vertexCount, indexCount } = merged;
    const idxBytes = indices.buffer.byteLength;
    const posBytes = positions.buffer.byteLength;
    const normBytes = normals.buffer.byteLength;
    const colBytes = colors.buffer.byteLength;
    const pad4 = n => (n % 4 === 0) ? n : n + (4 - n % 4);
    const idxPad = pad4(idxBytes);
    const binLen = idxPad + posBytes + normBytes + colBytes;
    let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
    for (let i = 0; i < vertexCount; i++) {
        const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2];
        if(x<minX)minX=x;if(y<minY)minY=y;if(z<minZ)minZ=z;
        if(x>maxX)maxX=x;if(y>maxY)maxY=y;if(z>maxZ)maxZ=z;
    }
    const json = {
        asset: { version: "2.0", generator: "ManorGen" },
        scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
        meshes: [{ primitives: [{ attributes: { POSITION: 1, NORMAL: 2, COLOR_0: 3 }, indices: 0, mode: 4 }] }],
        accessors: [
            { bufferView: 0, componentType: 5123, count: indexCount, type: "SCALAR" },
            { bufferView: 1, componentType: 5126, count: vertexCount, type: "VEC3", min: [minX,minY,minZ], max: [maxX,maxY,maxZ] },
            { bufferView: 2, componentType: 5126, count: vertexCount, type: "VEC3" },
            { bufferView: 3, componentType: 5126, count: vertexCount, type: "VEC3" },
        ],
        bufferViews: [
            { buffer: 0, byteOffset: 0, byteLength: idxBytes, target: 34963 },
            { buffer: 0, byteOffset: idxPad, byteLength: posBytes, target: 34962 },
            { buffer: 0, byteOffset: idxPad + posBytes, byteLength: normBytes, target: 34962 },
            { buffer: 0, byteOffset: idxPad + posBytes + normBytes, byteLength: colBytes, target: 34962 },
        ],
        buffers: [{ byteLength: binLen }]
    };
    const jsonStr = JSON.stringify(json);
    const jsonBuf = Buffer.from(jsonStr);
    const jsonPadLen = pad4(jsonBuf.length);
    const jsonPadded = Buffer.alloc(jsonPadLen, 0x20);
    jsonBuf.copy(jsonPadded);
    const binBuf = Buffer.alloc(binLen, 0);
    Buffer.from(indices.buffer).copy(binBuf, 0);
    Buffer.from(positions.buffer).copy(binBuf, idxPad);
    Buffer.from(normals.buffer).copy(binBuf, idxPad + posBytes);
    Buffer.from(colors.buffer).copy(binBuf, idxPad + posBytes + normBytes);
    const totalLen = 12 + 8 + jsonPadLen + 8 + binLen;
    const glb = Buffer.alloc(totalLen);
    let off = 0;
    glb.writeUInt32LE(0x46546C67, off); off += 4;
    glb.writeUInt32LE(2, off); off += 4;
    glb.writeUInt32LE(totalLen, off); off += 4;
    glb.writeUInt32LE(jsonPadLen, off); off += 4;
    glb.writeUInt32LE(0x4E4F534A, off); off += 4;
    jsonPadded.copy(glb, off); off += jsonPadLen;
    glb.writeUInt32LE(binLen, off); off += 4;
    glb.writeUInt32LE(0x004E4942, off); off += 4;
    binBuf.copy(glb, off);
    writeFileSync(filename, glb);
    console.log(`  ✓ ${filename} (${(totalLen/1024).toFixed(1)} KB)`);
}

const hex = (h) => [(h>>16&0xff)/255, (h>>8&0xff)/255, (h&0xff)/255];
const C = {
    darkWood: hex(0x3a2210), medWood: hex(0x5a3a1a), lightWood: hex(0x7a5a2a),
    fabric: hex(0x2a1a2a), green: hex(0x1a3a1a), bed: hex(0x1a2a3a),
    blanket: hex(0x4a1a1a), pillow: hex(0x6666aa), metal: hex(0x888888),
    gold: hex(0xccaa44), wax: hex(0xeeddaa), flame: hex(0xff8800),
    glass: hex(0x8899bb), wine: hex(0x660022), bottle: hex(0x1a3a1a),
    potion: hex(0x2a6a4a), cork: hex(0x8a6a3a), label: hex(0xddccaa),
    book1: hex(0x8a2222), book2: hex(0x225588), book3: hex(0x228844),
    book4: hex(0x886622), book5: hex(0x553366), book6: hex(0x884422), book7: hex(0x224466),
};

const box = boxGeometry, cyl = cylinderGeometry, sph = sphereGeometry;

console.log('Generating furniture models...\n');

writeGLB('models/table.glb', mergeGeometries([
    { geo: box(2.0, 0.08, 1.2), color: C.medWood, translate: [0, 0.76, 0] },
    { geo: box(0.08, 0.72, 0.08), color: C.darkWood, translate: [-0.85, 0.36, -0.5] },
    { geo: box(0.08, 0.72, 0.08), color: C.darkWood, translate: [0.85, 0.36, -0.5] },
    { geo: box(0.08, 0.72, 0.08), color: C.darkWood, translate: [-0.85, 0.36, 0.5] },
    { geo: box(0.08, 0.72, 0.08), color: C.darkWood, translate: [0.85, 0.36, 0.5] },
    { geo: box(1.7, 0.06, 0.06), color: C.darkWood, translate: [0, 0.15, -0.5] },
    { geo: box(1.7, 0.06, 0.06), color: C.darkWood, translate: [0, 0.15, 0.5] },
]));

writeGLB('models/chair.glb', mergeGeometries([
    { geo: box(0.45, 0.05, 0.45), color: C.medWood, translate: [0, 0.45, 0] },
    { geo: box(0.05, 0.45, 0.05), color: C.darkWood, translate: [-0.18, 0.225, -0.18] },
    { geo: box(0.05, 0.45, 0.05), color: C.darkWood, translate: [0.18, 0.225, -0.18] },
    { geo: box(0.05, 0.45, 0.05), color: C.darkWood, translate: [-0.18, 0.225, 0.18] },
    { geo: box(0.05, 0.45, 0.05), color: C.darkWood, translate: [0.18, 0.225, 0.18] },
    { geo: box(0.45, 0.5, 0.05), color: C.darkWood, translate: [0, 0.73, -0.2] },
    { geo: box(0.04, 0.35, 0.03), color: C.medWood, translate: [-0.12, 0.66, -0.2] },
    { geo: box(0.04, 0.35, 0.03), color: C.medWood, translate: [0.12, 0.66, -0.2] },
]));

writeGLB('models/sofa.glb', mergeGeometries([
    { geo: box(2.0, 0.35, 0.9), color: C.fabric, translate: [0, 0.25, 0] },
    { geo: box(1.8, 0.12, 0.7), color: hex(0x3a2040), translate: [0, 0.48, 0.05] },
    { geo: box(2.0, 0.45, 0.2), color: C.fabric, translate: [0, 0.55, -0.35] },
    { geo: box(0.15, 0.3, 0.7), color: C.fabric, translate: [-0.92, 0.5, 0.05] },
    { geo: box(0.15, 0.3, 0.7), color: C.fabric, translate: [0.92, 0.5, 0.05] },
    { geo: box(0.06, 0.08, 0.06), color: C.darkWood, translate: [-0.85, 0.04, -0.35] },
    { geo: box(0.06, 0.08, 0.06), color: C.darkWood, translate: [0.85, 0.04, -0.35] },
    { geo: box(0.06, 0.08, 0.06), color: C.darkWood, translate: [-0.85, 0.04, 0.35] },
    { geo: box(0.06, 0.08, 0.06), color: C.darkWood, translate: [0.85, 0.04, 0.35] },
]));

writeGLB('models/bed.glb', mergeGeometries([
    { geo: box(1.8, 0.3, 2.4), color: C.darkWood, translate: [0, 0.2, 0] },
    { geo: box(1.6, 0.2, 2.2), color: C.bed, translate: [0, 0.45, 0] },
    { geo: box(0.5, 0.1, 0.3), color: C.pillow, translate: [0.2, 0.6, -0.85] },
    { geo: box(0.5, 0.1, 0.3), color: C.pillow, translate: [-0.4, 0.6, -0.85] },
    { geo: box(1.8, 0.8, 0.08), color: C.darkWood, translate: [0, 0.6, -1.2] },
    { geo: box(1.8, 0.4, 0.08), color: C.darkWood, translate: [0, 0.4, 1.2] },
    { geo: box(1.55, 0.06, 1.6), color: C.blanket, translate: [0, 0.55, 0.2] },
]));

writeGLB('models/desk.glb', mergeGeometries([
    { geo: box(1.6, 0.06, 0.8), color: C.medWood, translate: [0, 0.76, 0] },
    { geo: box(0.06, 0.74, 0.06), color: C.darkWood, translate: [-0.72, 0.37, -0.32] },
    { geo: box(0.06, 0.74, 0.06), color: C.darkWood, translate: [0.72, 0.37, -0.32] },
    { geo: box(0.06, 0.74, 0.06), color: C.darkWood, translate: [-0.72, 0.37, 0.32] },
    { geo: box(0.06, 0.74, 0.06), color: C.darkWood, translate: [0.72, 0.37, 0.32] },
    { geo: box(0.5, 0.25, 0.7), color: C.darkWood, translate: [0.5, 0.6, 0] },
    { geo: box(0.15, 0.03, 0.03), color: C.gold, translate: [0.5, 0.6, 0.36] },
]));

{
    const parts = [{ geo: box(1.2, 2.2, 0.35), color: C.darkWood, translate: [0, 1.1, 0] }];
    for (let i = 0; i < 4; i++) parts.push({ geo: box(1.1, 0.04, 0.3), color: C.medWood, translate: [0, 0.3+i*0.5, 0] });
    const bc = [C.book1,C.book2,C.book3,C.book4,C.book5,C.book6,C.book7];
    for (let s = 0; s < 3; s++) { const y = 0.35+s*0.5; let x = -0.45;
        for (let b = 0; b < 7; b++) { const w=0.05+(b%3)*0.02, h=0.25+(b%4)*0.05;
            parts.push({ geo: box(w,h,0.2), color: bc[b%7], translate: [x,y+h/2,0] }); x+=w+0.01; if(x>0.45) break; }
    }
    writeGLB('models/bookshelf.glb', mergeGeometries(parts));
}

writeGLB('models/candle.glb', mergeGeometries([
    { geo: cyl(0.08, 0.12, 0.06, 8), color: C.metal, translate: [0, 0.03, 0] },
    { geo: cyl(0.03, 0.03, 0.1, 8), color: C.metal, translate: [0, 0.11, 0] },
    { geo: cyl(0.07, 0.04, 0.03, 8), color: C.metal, translate: [0, 0.17, 0] },
    { geo: cyl(0.03, 0.035, 0.18, 8), color: C.wax, translate: [0, 0.28, 0] },
    { geo: sph(0.02, 6, 5), color: C.flame, translate: [0, 0.39, 0] },
]));

writeGLB('models/wineGlass.glb', mergeGeometries([
    { geo: cyl(0.035, 0.04, 0.01, 8), color: C.glass, translate: [0, 0.005, 0] },
    { geo: cyl(0.008, 0.008, 0.1, 6), color: C.glass, translate: [0, 0.06, 0] },
    { geo: cyl(0.04, 0.02, 0.07, 8), color: C.glass, translate: [0, 0.145, 0] },
    { geo: cyl(0.035, 0.015, 0.04, 8), color: C.wine, translate: [0, 0.13, 0] },
]));

writeGLB('models/wardrobe.glb', mergeGeometries([
    { geo: box(1.0, 2.2, 0.6), color: C.darkWood, translate: [0, 1.1, 0] },
    { geo: box(0.48, 2.0, 0.03), color: C.medWood, translate: [-0.24, 1.1, 0.31] },
    { geo: box(0.48, 2.0, 0.03), color: C.medWood, translate: [0.24, 1.1, 0.31] },
    { geo: box(0.02, 0.08, 0.03), color: C.gold, translate: [-0.05, 1.1, 0.33] },
    { geo: box(0.02, 0.08, 0.03), color: C.gold, translate: [0.05, 1.1, 0.33] },
    { geo: box(1.1, 0.06, 0.65), color: C.darkWood, translate: [0, 2.22, 0] },
]));

writeGLB('models/cabinet.glb', mergeGeometries([
    { geo: box(1.4, 0.9, 0.5), color: C.darkWood, translate: [0, 0.45, 0] },
    { geo: box(1.5, 0.04, 0.55), color: C.medWood, translate: [0, 0.92, 0] },
    { geo: box(0.65, 0.75, 0.03), color: C.medWood, translate: [-0.33, 0.42, 0.26] },
    { geo: box(0.65, 0.75, 0.03), color: C.medWood, translate: [0.33, 0.42, 0.26] },
    { geo: box(0.02, 0.06, 0.02), color: C.gold, translate: [-0.06, 0.45, 0.28] },
    { geo: box(0.02, 0.06, 0.02), color: C.gold, translate: [0.06, 0.45, 0.28] },
]));

writeGLB('models/drawer.glb', mergeGeometries([
    { geo: box(0.5, 0.55, 0.4), color: C.darkWood, translate: [0, 0.275, 0] },
    { geo: box(0.55, 0.03, 0.45), color: C.medWood, translate: [0, 0.565, 0] },
    { geo: box(0.44, 0.2, 0.02), color: C.medWood, translate: [0, 0.15, 0.2] },
    { geo: box(0.08, 0.03, 0.02), color: C.gold, translate: [0, 0.15, 0.22] },
    { geo: box(0.44, 0.2, 0.02), color: C.medWood, translate: [0, 0.4, 0.2] },
    { geo: box(0.08, 0.03, 0.02), color: C.gold, translate: [0, 0.4, 0.22] },
]));

writeGLB('models/armchair.glb', mergeGeometries([
    { geo: box(0.7, 0.3, 0.65), color: C.green, translate: [0, 0.25, 0] },
    { geo: box(0.6, 0.1, 0.55), color: hex(0x2a4a2a), translate: [0, 0.45, 0.02] },
    { geo: box(0.7, 0.5, 0.12), color: C.green, translate: [0, 0.6, -0.28] },
    { geo: box(0.1, 0.25, 0.55), color: C.green, translate: [-0.35, 0.45, 0.02] },
    { geo: box(0.1, 0.25, 0.55), color: C.green, translate: [0.35, 0.45, 0.02] },
    { geo: box(0.06, 0.1, 0.06), color: C.darkWood, translate: [-0.28, 0.05, -0.25] },
    { geo: box(0.06, 0.1, 0.06), color: C.darkWood, translate: [0.28, 0.05, -0.25] },
    { geo: box(0.06, 0.1, 0.06), color: C.darkWood, translate: [-0.28, 0.05, 0.25] },
    { geo: box(0.06, 0.1, 0.06), color: C.darkWood, translate: [0.28, 0.05, 0.25] },
]));

{
    const parts = [
        { geo: cyl(0.01, 0.01, 0.4, 6), color: C.metal, translate: [0, 0.3, 0] },
        { geo: cyl(0.08, 0.06, 0.06, 8), color: C.metal, translate: [0, 0.08, 0] },
    ];
    for (let i = 0; i < 5; i++) {
        const a = (i/5)*Math.PI*2, ax = Math.cos(a)*0.25, az = Math.sin(a)*0.25;
        parts.push({ geo: box(0.25, 0.02, 0.02), color: C.metal, translate: [ax/2, 0.06, az/2], rotate_y: a });
        parts.push({ geo: cyl(0.03, 0.02, 0.03, 6), color: C.metal, translate: [ax, 0.04, az] });
        parts.push({ geo: cyl(0.015, 0.018, 0.08, 6), color: C.wax, translate: [ax, 0.09, az] });
        parts.push({ geo: sph(0.012, 5, 4), color: C.flame, translate: [ax, 0.14, az] });
    }
    writeGLB('models/chandelier.glb', mergeGeometries(parts));
}

writeGLB('models/wineBottle.glb', mergeGeometries([
    { geo: cyl(0.035, 0.04, 0.18, 8), color: C.bottle, translate: [0, 0.09, 0] },
    { geo: cyl(0.015, 0.03, 0.1, 8), color: C.bottle, translate: [0, 0.23, 0] },
    { geo: cyl(0.013, 0.015, 0.03, 6), color: C.cork, translate: [0, 0.295, 0] },
    { geo: box(0.06, 0.06, 0.002), color: C.label, translate: [0, 0.1, 0.042] },
]));

writeGLB('models/potionBottle.glb', mergeGeometries([
    { geo: sph(0.04, 8, 6), color: C.potion, translate: [0, 0.05, 0] },
    { geo: cyl(0.012, 0.02, 0.06, 6), color: C.potion, translate: [0, 0.11, 0] },
    { geo: cyl(0.01, 0.012, 0.02, 6), color: C.cork, translate: [0, 0.15, 0] },
]));

console.log('\n✅ All models generated!');
