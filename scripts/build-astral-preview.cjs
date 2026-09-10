/* Produces one self-contained, offline preview using the production renderer and score. */
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
const output=path.resolve(process.argv[2]||path.join(root,'Aster-Astral-Preview.html'));
const files={
 './timeline':'components/player/astral/timeline.ts',
 './shaders':'components/player/astral/shaders.ts',
 './renderer':'components/player/astral/renderer.ts',
 './audio':'components/player/wishAudio.ts',
 './rarity':'lib/player/wish-reveal.ts',
};
const modules=Object.entries(files).map(([key,file])=>JSON.stringify(key)+':function(module,exports,require){\n'+ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText+'\n}').join(',\n');
const runtime=`const factories={${modules}};const cache={};function require(id){if(id==='./astral/timeline')id='./timeline';if(cache[id])return cache[id].exports;const module={exports:{}};cache[id]=module;factories[id](module,module.exports,require);return module.exports;}const ASTRAL={...require('./timeline'),...require('./renderer'),...require('./audio'),...require('./rarity')};`;
const asset='data:image/webp;base64,'+fs.readFileSync(path.join(root,'public/ancient-pulls/wish/astral/aster-pixel.webp')).toString('base64');
const css=fs.readFileSync(path.join(root,'components/player/astral/AstralWish.module.css'),'utf8');
const preview=fs.readFileSync(path.join(root,'scripts/astral-preview.html'),'utf8');
const entry=fs.readFileSync(path.join(root,'scripts/astral-preview-entry.js'),'utf8');
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,preview.replace('/* PRODUCTION_CSS */',css).replace('/* PREVIEW_RUNTIME */',runtime+'\nconst ASSET='+JSON.stringify(asset)+';\n'+entry));
console.log(JSON.stringify({file:output,bytes:fs.statSync(output).size}));
