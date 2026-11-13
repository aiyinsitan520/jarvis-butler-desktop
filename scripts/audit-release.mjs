// Run against the exact Git source set; never enumerate personal workspace data.
import {execFileSync} from 'node:child_process';
import {readFileSync,statSync} from 'node:fs';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
if(!files.length)throw Error('No reviewed Git source set');
const bad=[];
for(const file of files){
 if(/(^|\/)(output|target|node_modules|dist|backups|extracted|sample|readable|\.private|\.planning|\.claude)(\/|$)|\.(db|sqlite|pem|p12|key|bak|log)$|(^|\/)\.env(\.|$)/i.test(file))bad.push(`${file}: private/generated file`);
 if(statSync(file).size>6*1024*1024)bad.push(`${file}: unexpectedly large source`);
 if(/\.(rs|ts|tsx|js|mjs|json|ya?ml|toml|md|ps1|sh)$/.test(file)){
   const s=readFileSync(file,'utf8');
   if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{28,}/.test(s))bad.push(`${file}: possible secret`);
 }
}
if(!readFileSync('LICENSE','utf8').includes('GNU AFFERO GENERAL PUBLIC LICENSE'))bad.push('AGPL text missing');
if(bad.length)throw Error(bad.join('\n'));
console.log(`Public source audit: ${files.length} files, no blocked paths or recognized secrets. Manual asset review is also required.`);
