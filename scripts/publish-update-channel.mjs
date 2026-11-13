// Advance the public channel only after signed assets were published and verified.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const repo='aiyinsitan520/jarvis-butler-desktop',branch='update-channel';
const file=process.argv[2],m=JSON.parse(fs.readFileSync(file,'utf8')),tag=process.env.GITHUB_REF_NAME;
if(!tag||!tag.startsWith('v'+m.version))throw Error('Channel/tag mismatch');
const channel=tag.includes('-preview.')?'preview':'stable',name=channel+'.json';
const call=(p,data,method)=>JSON.parse(execFileSync('gh',['api',`repos/${repo}/${p}`,...(data?['--method',method??'POST','--input','-']:[])],{input:data?JSON.stringify(data):undefined,encoding:'utf8',stdio:['pipe','pipe','pipe']}));
// Published manifest must exactly match locally verified bytes, including both platforms.
const body=fs.readFileSync(file,'utf8');const publicBody=execFileSync('gh',['release','download',tag,'--repo',repo,'--pattern','latest.json','--output','-'],{encoding:'utf8'});if(publicBody!==body)throw Error('Public manifest differs from verified release');
let previous;try{previous=call('git/ref/heads/'+branch).object.sha;}catch(e){if(!String(e.stderr).includes('404'))throw Error('Cannot read update channel reference');}
if(previous){let old;try{old=JSON.parse(Buffer.from(call(`contents/${name}?ref=${branch}`).content,'base64').toString());}catch(e){if(!String(e.stderr).includes('404'))throw Error('Cannot read previous channel');}
 if(old){const semver=s=>s.split('-')[0].split('.').map(Number);const a=semver(old.version),b=semver(m.version);let cmp=0;for(let i=0;i<3;i++){if(a[i]!==b[i]){cmp=a[i]>b[i]?1:-1;break;}}if(cmp>0)throw Error('Refusing to roll channel backwards');if(cmp===0){if(JSON.stringify(old.platforms)!==JSON.stringify(m.platforms))throw Error('Same app version has different artifacts; increment app version');console.log('Channel already contains these signed artifacts.');process.exit(0);}}}
let base;if(previous)base=call('git/commits/'+previous).tree.sha;
const tree=call('git/trees',{...(base?{base_tree:base}:{}),tree:[{path:name,mode:'100644',type:'blob',content:body}]}).sha;
const commit=call('git/commits',{message:`Publish ${channel} update ${m.version}`,tree,parents:previous?[previous]:[]}).sha;
if(previous)call('git/refs/heads/'+branch,{sha:commit,force:false},'PATCH');else call('git/refs',{ref:'refs/heads/'+branch,sha:commit});
const response=await fetch(`https://raw.githubusercontent.com/${repo}/${commit}/${name}`,{signal:AbortSignal.timeout(30000)});if(!response.ok||await response.text()!==body)throw Error('Published channel could not be verified');console.log(`Verified ${channel} channel ${m.version}; signed ${Object.keys(m.platforms).length} platform packages.`);
