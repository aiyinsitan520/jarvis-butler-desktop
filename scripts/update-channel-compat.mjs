// Old installed clients pin the former repository URL. GitHub redirects it to
// this same repository; signatures, bytes and versions remain unchanged.
export const repository='aiyinsitan520/jiavimiao-butler';
export const legacyRepository='aiyinsitan520/jarvis-butler-desktop';
export function channelManifest(manifest){
 const copy=structuredClone(manifest);
 for(const p of Object.values(copy.platforms)){
  const current=`https://github.com/${repository}/releases/download/`;
  const legacy=`https://github.com/${legacyRepository}/releases/download/`;
  if(p.url.startsWith(current))p.url=legacy+p.url.slice(current.length);
  else if(!p.url.startsWith(legacy))throw Error('Unexpected repository in update channel');
 }
 return copy;
}
export function sameArtifacts(a,b){return JSON.stringify(channelManifest(a).platforms)===JSON.stringify(channelManifest(b).platforms);}
