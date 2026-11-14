// Build/stage/merge only explicit public updater assets. Never reads local credentials.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const version=JSON.parse(fs.readFileSync('package.json','utf8')).version;
const mode=process.argv[2],tag=process.env.GITHUB_REF_NAME??'';
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const release=process.env.GITHUB_REF_TYPE==='tag';
const releaseDate=execFileSync('git',['show','-s','--format=%cI'],{encoding:'utf8'}).trim();
if(release&&!new RegExp(`^v${esc(version)}(?:-preview\\.[1-9][0-9]*)?$`).test(tag))throw Error('Release tag must match application version; increment the application version for each update.');
const one=(dir,suffix)=>{const found=fs.readdirSync(dir).filter(f=>f.endsWith(suffix));if(found.length!==1)throw Error(`Expected exactly one ${suffix} artifact`);return path.join(dir,found[0]);};
const hash=b=>createHash('sha256').update(b).digest('hex');
if(mode==='build'){
 if(release&&(!process.env.TAURI_SIGNING_PRIVATE_KEY||!process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD))throw Error('Missing updater signing secrets; release stopped.');
 const target=process.argv[3],bundles=process.argv[4],config=process.argv[5];
 const args=['node_modules/@tauri-apps/cli/tauri.js','build','--ci','--target',target,'--bundles',...bundles.split(',')];if(config)args.push('--config',config);if(!release)args.push('--config',JSON.stringify({bundle:{createUpdaterArtifacts:false}}));
 execFileSync(process.execPath,args,{stdio:'inherit'});
}else if(mode==='stage'){
 const target=process.argv[3],windows=target==='x86_64-pc-windows-msvc',platform=windows?'windows-x86_64':'darwin-aarch64';if(!windows&&target!=='aarch64-apple-darwin')throw Error('Unsupported release target');
 const bundle=`target/${target}/release/bundle`,out='output/release-assets';fs.mkdirSync(out,{recursive:true});
 const installer=one(`${bundle}/${windows?'nsis':'dmg'}`,windows?'.exe':'.dmg');const name=`JarvisButler-${version}-${windows?'Windows-x64-setup.exe':'macOS-AppleSilicon.dmg'}`;fs.copyFileSync(installer,path.join(out,name));
 if(release){const artifact=windows?installer:one(`${bundle}/macos`,'.app.tar.gz'),updateName=windows?name:`JarvisButler-${version}-macOS-AppleSilicon.app.tar.gz`;const bytes=fs.readFileSync(artifact),signature=fs.readFileSync(artifact+'.sig','utf8').trim();if(!signature)throw Error('Updater signature missing');fs.copyFileSync(artifact,path.join(out,updateName));fs.writeFileSync(path.join(out,updateName+'.sig'),signature+'\n');
 const fragment={version,notes:fs.readFileSync('docs/release-notes.md','utf8'),pub_date:releaseDate,platforms:{[platform]:{url:`https://github.com/aiyinsitan520/jiavimiao-butler/releases/download/${tag}/${updateName}`,signature,sha256:hash(bytes),size:bytes.length}}};fs.writeFileSync(path.join(out,platform+'.json'),JSON.stringify(fragment,null,2)+'\n');}
}else if(mode==='merge'){
 if(!release)throw Error('Merge requires release tag');const dir=process.argv[3],a=JSON.parse(fs.readFileSync(path.join(dir,'windows-x86_64.json'),'utf8')),b=JSON.parse(fs.readFileSync(path.join(dir,'darwin-aarch64.json'),'utf8'));if(a.version!==version||b.version!==version)throw Error('Platform version mismatch');const platforms={...a.platforms,...b.platforms};if(Object.keys(platforms).length!==2||!platforms['windows-x86_64']||!platforms['darwin-aarch64'])throw Error('Incomplete release');for(const p of Object.values(platforms)){const name=p.url.split('/').at(-1),bytes=fs.readFileSync(path.join(dir,name));if(hash(bytes)!==p.sha256||bytes.length!==p.size)throw Error('Staged package changed');}
 fs.writeFileSync(path.join(dir,'latest.json'),JSON.stringify({...a,pub_date:releaseDate,platforms},null,2)+'\n');
 const assets=fs.readdirSync(dir).filter(n=>/\.(exe|dmg|sig)$|\.app\.tar\.gz$/.test(n));const sums=assets.sort().map(n=>`${hash(fs.readFileSync(path.join(dir,n)))}  ${n}`).join('\n')+'\n';fs.writeFileSync(path.join(dir,'SHA256SUMS.txt'),sums);
}else throw Error('Usage: updater-release.mjs build|stage|merge ...');
