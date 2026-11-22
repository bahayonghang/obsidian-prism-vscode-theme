// Exact palette illustration, not a VS Code screenshot. Optional docs asset tool.
// Run after npm run build. Render generated SVGs to PNG with a standard SVG renderer.
const fs = require('node:fs');
const { THEMES, PALETTES } = require('../out/palettes.js');
const { createTheme } = require('../out/theme.js');
const esc = text => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const text = (x,y,content,color='#FFFFFF',size=18,weight=400,extra='') => `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}" ${extra}>${esc(content)}</text>`;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1130" viewBox="0 0 1600 1130"><style>text{font-family:'DejaVu Sans',sans-serif}.code{font-family:'DejaVu Sans Mono',monospace}</style><rect width="1600" height="1130" fill="#0E0E11"/>`;
svg += text(64,65,'OBSIDIAN PRISM  /  VS CODE','#A58AF8',15,600,'letter-spacing="3"');
svg += text(64,121,'Four palettes. One quiet workspace.','#F2F2F5',40,500);
svg += text(64,157,'Native color themes · Adjustable accents · Light and dark · Theme Studio','#8A8A98',18);
for (let i=0;i<THEMES.length;i++) {
  const t=THEMES[i], p=PALETTES[t.id], theme=createTheme(t.id), c=theme.colors;
  const x=64+(i%2)*750, y=202+Math.floor(i/2)*420, w=722, h=387;
  const token = role => theme.semanticTokenColors[role]?.foreground || p.syntax[role] || p.foreground;
  svg += `<g transform="translate(${x} ${y})"><rect width="${w}" height="${h}" rx="14" fill="${p.background}" stroke="#6F6F803C"/>`;
  svg += `<path d="M14 0H708Q722 0 722 14V42H0V14Q0 0 14 0Z" fill="${p.sidebar}"/>`;
  svg += text(22,27,t.label.split(' — ')[1],p.foreground,17,600);
  svg += `<circle cx="689" cy="22" r="5" fill="${p.accent}"/><rect x="0" y="42" width="147" height="311" fill="${p.sidebar}"/>`;
  svg += text(19,76,'EXPLORER',p.muted,10,600,'letter-spacing="1.5"');
  svg += text(19,109,'⌄ PRISM',p.foreground,12,600);
  svg += `<rect x="0" y="129" width="147" height="29" fill="${c['list.activeSelectionBackground']}"/>`;
  for (const [j,line] of ['theme.ts','palette.ts','settings.json','README.md'].entries()) svg += text(30,148+j*29,line,j===0?p.foreground:p.muted,12);
  svg += `<rect x="147" y="42" width="575" height="39" fill="${p.sidebar}"/><rect x="147" y="42" width="132" height="39" fill="${p.background}"/><rect x="147" y="42" width="132" height="2" fill="${p.accent}"/>`;
  svg += text(164,67,'TS  theme.ts',p.foreground,12);
  const lines = [
    [['// Make room for a little clarity.',p.muted]],
    [['export function ',token('keyword')],['illuminate',token('function')],['() {',p.foreground]],
    [['  const ',token('keyword')],['palette',p.foreground],[' = ',p.secondaryForeground],['{',p.foreground]],
    [['    name',token('property')],[': ',p.foreground],[`'${t.id}'`,token('string')],[',',p.foreground]],
    [['    accent',token('property')],[': ',p.foreground],[`'${p.accent}'`,token('string')],[',',p.foreground]],
    [['    clarity',token('property')],[': ',p.foreground],['100',token('number')]],
    [['  };',p.foreground]],
    [['  return ',token('keyword')],['palette;',p.foreground]],
    [['}',p.foreground]],
  ];
  lines.forEach((line,j)=>{
    svg+=text(165,107+j*24,String(j+1),p.muted,11,400,'class="code"');
    svg+=`<text x="191" y="${107+j*24}" font-size="13" class="code" xml:space="preserve">`;
    for(const [content,color] of line)svg+=`<tspan fill="${color}">${esc(content)}</tspan>`;
    svg+='</text>';
  });
  svg += `<path d="M0 353H722V373Q722 387 708 387H14Q0 387 0 373Z" fill="${p.sidebar}"/>`;
  svg += text(20,375,`CANVAS ${p.background}   SIDEBAR ${p.sidebar}`,p.muted,11,400,'class="code"');
  svg += text(535,375,`${p.type.toUpperCase()}  /  PRISM`,p.accent,10,600,'letter-spacing="1"');
  svg += '</g>';
}
svg += text(64,1084,'Palette design: Obsidian Prism / RMvdesi · Independent VS Code port · GPL-3.0-only','#8A8A98',14);
svg += text(1536,1084,'PALETTE ILLUSTRATION','#8A8A98',11,500,'text-anchor="end" letter-spacing="1.5"');
svg += '</svg>';
fs.writeFileSync('media/preview.svg',svg+'\n');
console.log('Generated media/preview.svg');
