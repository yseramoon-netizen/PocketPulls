#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const own=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2),apply=args.includes('--apply');
const target=path.resolve(args.find(a=>!a.startsWith('--'))||process.cwd());
const fail=message=>{console.error(message);process.exit(1)};
if(!fs.existsSync(path.join(target,'package.json')))fail('Choose the existing Next.js project folder containing package.json.');
const roots=[target,path.join(target,'src')].filter(p=>fs.existsSync(path.join(p,'app/layout.tsx'))||fs.existsSync(path.join(p,'app/layout.js')));
if(roots.length!==1)fail('Cannot identify one active app folder. Check the root app/ and src/app/ folders before installing.');
const appRoot=roots[0];
const configFile=path.join(target,'tsconfig.json');
if(fs.existsSync(configFile)){
 const match=fs.readFileSync(configFile,'utf8').match(/"@\/\*"\s*:\s*\[\s*"([^"]+)"/);
 if(match&&path.resolve(target,match[1].replace(/\*$/, ''))!==appRoot)fail('The @/ import alias points outside the active app folder. Review the project layout before installing. Nothing was changed.');
}
if(fs.existsSync(path.join(target,'source/app'))||fs.existsSync(path.join(target,'source/components/player/WishCinematic.tsx')))fail('A nested source/ animation or app folder exists. Move that earlier extracted update OUTSIDE your project first; it is not the active Next.js app and can trigger duplicate type checks. Nothing was changed.');
const source=path.join(own,'ancient-pulls');
const manifest=JSON.parse(fs.readFileSync(path.join(own,'redesign-manifest.json'),'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function resolve(root,relative){const full=path.resolve(root,relative);if(!full.startsWith(root+path.sep))fail('Invalid package path.');return full;}
const changes=[],conflicts=[];
for(const file of manifest.files){
 const from=resolve(source,file.path);
 if(!fs.existsSync(from)||sha(from)!==file.sha256)fail('Package integrity check failed for '+file.path);
 const root=/^(app|components|lib)\//.test(file.path)?appRoot:target;
 const to=resolve(root,file.path);
 if(fs.existsSync(to)){
  if(sha(to)===file.sha256||file.mode==='dependency')continue;
  if(!file.previousSha256.includes(sha(to))){conflicts.push(file.path);continue;}
 }
 changes.push({from,to,file});
}
if(conflicts.length){console.error('These files differ from the verified source versions. Nothing has been changed. Review or merge them against your current repository first:\n'+conflicts.map(p=>'  '+p).join('\n'));process.exit(2);}
console.log(`Active application: ${appRoot}\n${changes.length} files need updating.`);
if(!apply){console.log('Check passed. Run the same command with --apply to install and back up the changed files.');process.exit(0);}
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=path.join(target,'.ancient-pulls-backups','astral-71-'+stamp);
fs.mkdirSync(backup,{recursive:true});
const written=[];
try{
 for(const item of changes){
  const relative=path.relative(target,item.to),saved=resolve(backup,relative),existed=fs.existsSync(item.to);
  if(existed){fs.mkdirSync(path.dirname(saved),{recursive:true});fs.copyFileSync(item.to,saved);}
  fs.mkdirSync(path.dirname(item.to),{recursive:true});
  written.push({path:relative,existed});
  fs.copyFileSync(item.from,item.to);
 }
 fs.writeFileSync(path.join(backup,'restore.json'),JSON.stringify(written,null,2));
 console.log(`Installed Astral 71. Backup: ${backup}\nRun npm run build in your project. Publish through your existing Vercel project after the build succeeds.\nThe menu will show “Ancient Pulls · Astral 71”. Installing files does not publish the website.`);
}catch(error){
 for(const item of written.reverse()){
  const to=resolve(target,item.path),saved=resolve(backup,item.path);
  if(item.existed)fs.copyFileSync(saved,to);else fs.rmSync(to,{force:true});
 }
 fail('Installation failed and the changed files were restored: '+error.message);
}
