//! Signed-update policy shared by the native app and release verification CLI.
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
pub const MAX_SIZE: u64 = 300 * 1024 * 1024;
pub const REPO: &str = "aiyinsitan520/jiavimiao-butler";
// GitHub redirects this former name to the same repository. Retain it for
// signed packages cached by installations published before the repository rename.
pub const LEGACY_REPO: &str = "aiyinsitan520/jarvis-butler-desktop";
pub const PREVIEW: &str = "https://raw.githubusercontent.com/aiyinsitan520/jiavimiao-butler/update-channel/preview.json";
pub const STABLE: &str = "https://raw.githubusercontent.com/aiyinsitan520/jiavimiao-butler/update-channel/stable.json";
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Package { pub url: String, pub signature: String, pub sha256: String, pub size: u64 }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest { pub version: String, pub notes: String, pub pub_date: String, pub platforms: BTreeMap<String, Package> }
pub fn endpoint(channel: &str) -> Result<&'static str, String> {
    match channel {"preview"=>Ok(PREVIEW),"stable"=>Ok(STABLE),_=>Err("无效的更新渠道".into())}
}
pub fn newer(a: &str,b: &str)->bool { match (semver::Version::parse(a),semver::Version::parse(b)){(Ok(a),Ok(b))=>a>b,_=>false} }
pub fn parse(bytes: &[u8]) -> Result<Manifest,String> {
    if bytes.len()>1024*1024{return Err("更新清单过大".into());}
    let m:Manifest=serde_json::from_slice(bytes).map_err(|_|"更新清单格式无效")?;
    let v=semver::Version::parse(&m.version).map_err(|_|"更新版本号无效")?;
    if v.to_string()!=m.version || m.platforms.is_empty() || m.notes.len()>65536{return Err("更新清单不完整".into());}
    for (target,p) in &m.platforms {
        let suffix=match target.as_str(){"windows-x86_64"=>"Windows-x64-setup.exe","darwin-aarch64"=>"macOS-AppleSilicon.app.tar.gz",_=>return Err("更新架构不受支持".into())};
        let u=url::Url::parse(&p.url).map_err(|_|"更新地址无效")?;
        let prefixes=[REPO,LEGACY_REPO].map(|repo|format!("/{repo}/releases/download/v{}",m.version));
        let path=u.path();let parts:Vec<_>=path.split('/').collect();
        let tag=parts.get(5).copied().unwrap_or("");
        let expected=format!("JarvisButler-{}-{suffix}",m.version);
        let valid_tag=tag==format!("v{}",m.version)||tag.strip_prefix(&format!("v{}-preview.",m.version)).is_some_and(|n|!n.is_empty()&&n.chars().all(|c|c.is_ascii_digit()));
        if u.scheme()!="https" || u.host_str()!=Some("github.com") || !u.username().is_empty() || u.password().is_some() || u.port().is_some() || u.query().is_some() || u.fragment().is_some() || !prefixes.iter().any(|prefix|path.starts_with(prefix)) || parts.len()!=7 || !valid_tag || parts[6]!=expected {
            return Err("更新包必须来自本项目的对应版本与平台".into());
        }
        if p.size==0 || p.size>MAX_SIZE || p.signature.len()>4096 || p.signature.is_empty() || p.sha256.len()!=64 || !p.sha256.chars().all(|c|c.is_ascii_hexdigit()){return Err("更新包大小、签名或校验值无效".into());}
    }
    Ok(m)
}
pub fn verify(bytes:&[u8],p:&Package,version:&str,pubkey:&str)->Result<(),String>{
    if bytes.len() as u64!=p.size || format!("{:x}",Sha256::digest(bytes))!=p.sha256.to_lowercase(){return Err("更新包不完整或校验值不符".into());}
    let decode=|v:&str| STANDARD.decode(v.trim()).ok().and_then(|s|String::from_utf8(s).ok()).ok_or_else(||"更新签名编码无效".to_string());
    let key=minisign_verify::PublicKey::decode(&decode(pubkey)?).map_err(|_|"更新公钥无效")?;
    let sig=minisign_verify::Signature::decode(&decode(&p.signature)?).map_err(|_|"更新签名无效")?;
    key.verify(bytes,&sig,true).map_err(|_|"更新包签名不符，已拒绝安装")?;
    let signed=sig.trusted_comment().split('\t').find_map(|f|f.strip_prefix("version:"));
    if signed!=Some(version){return Err("签名版本与清单不符，已拒绝安装".into());}
    Ok(())
}

#[cfg(test)]
mod tests {
 use super::*;
 fn fixture()->(Vec<u8>,Package,String){let kp=minisign::KeyPair::generate_unencrypted_keypair().unwrap();let b=b"synthetic package".to_vec();let sig=minisign::sign(Some(&kp.pk),&kp.sk,std::io::Cursor::new(&b),Some("timestamp:1\tversion:0.4.3"),None).unwrap();let p=Package{url:format!("https://github.com/{REPO}/releases/download/v0.4.3-preview.1/JarvisButler-0.4.3-Windows-x64-setup.exe"),signature:STANDARD.encode(sig.to_string()),sha256:format!("{:x}",Sha256::digest(&b)),size:b.len()as u64};(b,p,STANDARD.encode(kp.pk.to_box().unwrap().to_string()))}
 fn manifest(p:Package)->Vec<u8>{serde_json::to_vec(&Manifest{version:"0.4.3".into(),notes:"test".into(),pub_date:"2026-11-13T00:00:00Z".into(),platforms:BTreeMap::from([("windows-x86_64".into(),p)])}).unwrap()}
 #[test]fn authentic_package_and_channel(){let(b,p,k)=fixture();assert!(parse(&manifest(p.clone())).is_ok());assert!(verify(&b,&p,"0.4.3",&k).is_ok());assert!(endpoint("preview").unwrap().ends_with("preview.json"));assert!(endpoint("other").is_err());}
 #[test]fn renamed_repository_preserves_signed_legacy_packages(){let(b,mut p,k)=fixture();p.url=p.url.replace(REPO,LEGACY_REPO);assert!(parse(&manifest(p.clone())).is_ok());assert!(verify(&b,&p,"0.4.3",&k).is_ok());p.url=p.url.replace(LEGACY_REPO,"other/jarvis-butler-desktop");assert!(parse(&manifest(p)).is_err());}
 #[test]fn tampered_or_relabelled_package_rejected(){let(mut b,p,k)=fixture();assert!(verify(&b,&p,"9.0.0",&k).is_err());let(_,_,other)=fixture();assert!(verify(&b,&p,"0.4.3",&other).is_err());b[0]^=1;assert!(verify(&b,&p,"0.4.3",&k).is_err());}
 #[test]fn url_escape_wrong_platform_and_version_rejected(){let(_,p,_)=fixture();for url in [p.url.replace("https:","http:"),p.url.replace(REPO,"other/repo"),p.url.replace("v0.4.3-preview.1","v0.4.2"),p.url.replace("Windows-x64-setup.exe","macOS-AppleSilicon.dmg"),format!("{}?x=1",p.url),p.url.replace("github.com","github.com.evil.test")]{let mut bad=p.clone();bad.url=url;assert!(parse(&manifest(bad)).is_err());}}
 #[test]fn truncated_and_invalid_metadata_rejected(){let(b,mut p,k)=fixture();assert!(verify(&b[..3],&p,"0.4.3",&k).is_err());p.size=MAX_SIZE+1;assert!(parse(&manifest(p)).is_err());assert!(parse(b"<html>404</html>").is_err());}
 #[test]fn semver_order(){assert!(newer("0.4.4","0.4.3"));assert!(!newer("0.4.2","0.4.3"));assert!(!newer("9.fake","0.4.3"));assert!(newer("0.4.3-preview.2","0.4.3-preview.1"));}
}
