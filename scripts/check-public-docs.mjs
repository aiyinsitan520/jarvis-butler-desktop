// Check public documentation references, screenshot integrity and obvious private text.
import {readFileSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd(),docs=['README.md','docs/usage.zh-CN.md','docs/screenshots/README.md','docs/release-notes.md'];
let links=0;const bad=[];
for(const name of docs){const text=readFileSync(name,'utf8');
 if(/C:[\\/]Users[\\/]|28058|18326|18787|BEGIN PRIVATE KEY|gh[pousr]_[a-zA-Z0-9]{30,}/.test(text))bad.push(`${name}: potential private detail`);
 const refs=[...text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map(m=>m[1]).concat([...text.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]));
 for(const ref of refs){if(/^(https?:|#|mailto:)/.test(ref))continue;const decoded=decodeURIComponent(ref.split('#')[0].split(' ')[0]);if(!decoded)continue;const target=path.resolve(path.dirname(path.join(root,name)),decoded);if(!target.startsWith(root+path.sep)||!existsSync(target))bad.push(`${name}: broken reference ${ref}`);links++;}
}
const manifest=JSON.parse(readFileSync('docs/screenshots/manifest.json','utf8'));
for(const item of manifest.images){const p=path.join(root,'docs/screenshots',item.file),data=readFileSync(p);if(data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')bad.push(`${item.file}: not PNG`);const width=data.readUInt32BE(16),height=data.readUInt32BE(20);if(width!==item.width||height!==item.height||width<600||height<120)bad.push(`${item.file}: invalid capture size`);if(createHash('sha256').update(data).digest('hex')!==item.sha256)bad.push(`${item.file}: checksum changed`);if(statSync(p).size>2*1024*1024)bad.push(`${item.file}: image exceeds 2MiB`);}
if(bad.length)throw Error(bad.join('\n'));
console.log(`Public docs: ${docs.length} documents, ${links} local references, ${manifest.images.length} PNG captures verified; no flagged private text.`);
