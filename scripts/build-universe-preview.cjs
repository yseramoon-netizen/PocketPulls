/* A self-contained preview of the production ranked-universe renderer. */
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
const files={'./universe':'components/player/observatory/UniverseRenderer.ts','./SkyArt':'components/player/observatory/SkyArt.ts','@/lib/player/format':'lib/player/format.ts'};
const factories=Object.entries(files).map(([id,file])=>JSON.stringify(id)+':function(module,exports,require){'+ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText+'}').join(',');
const runtime=`const factories={${factories}},cache={};function require(id){if(cache[id])return cache[id].exports;const m={exports:{}};cache[id]=m;factories[id](m,m.exports,require);return m.exports;}const U=require('./universe');`;
const template=fs.readFileSync(path.join(root,'scripts/universe-preview.html'),'utf8');
const html=template.replace('/* SHARED_CSS */',fs.readFileSync(path.join(root,'app/astral.css'),'utf8')).replace('/* PRODUCTION_RENDERER */',runtime);
const output=path.resolve(process.argv[2]||path.join(root,'docs/history/Universe-Preview.html'));fs.writeFileSync(output,html);console.log(JSON.stringify({output,bytes:fs.statSync(output).size}));
