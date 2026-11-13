use std::path::Path;
fn main(){if let Err(e)=run(){eprintln!("{e}");std::process::exit(1);}}
fn run()->Result<(),String>{
 let args:Vec<String>=std::env::args().skip(1).collect();
 if args.first().map(String::as_str)==Some("provision"){
  #[cfg(all(windows,feature="provision"))]{return provision(args.get(1).ok_or("Missing public key destination")?);}
  #[cfg(not(all(windows,feature="provision"))) ]return Err("Provisioning requires Windows credential storage and --features provision".into());
 }
 if args.len()!=4 || args[0]!="verify"{return Err("Usage: jarvis-updater verify <manifest.json> <asset-directory> <public-key-file>".into());}
 let m=jarvis_updater::parse(&std::fs::read(&args[1]).map_err(|_|"Cannot read manifest")?)?;
 let key=std::fs::read_to_string(&args[3]).map_err(|_|"Cannot read public key")?;
 for (target,p) in &m.platforms{let name=p.url.rsplit('/').next().ok_or("Invalid package name")?;let bytes=std::fs::read(Path::new(&args[2]).join(name)).map_err(|_|format!("Missing artifact for {target}"))?;jarvis_updater::verify(&bytes,p,&m.version,&key)?;println!("Verified signed artifact: {target} {}",m.version);}
 Ok(())
}
#[cfg(all(windows,feature="provision"))]
fn provision(destination:&str)->Result<(),String>{
 use base64::{engine::general_purpose::STANDARD,Engine};use std::io::Write;use std::process::{Command,Stdio};use std::os::windows::process::CommandExt;
 let entry=keyring::Entry::new("org.jarvis.butler.release","updater-signing-v1").map_err(|_|"Credential storage unavailable")?;
 let value=match entry.get_password(){Ok(v)=>serde_json::from_str::<serde_json::Value>(&v).map_err(|_|"Stored updater identity is invalid; refusing rotation")?,Err(keyring::Error::NoEntry)=>{
  if Path::new(destination).exists(){return Err("Public key exists but private identity missing; restore credential backup, do not rotate".into());}
  let password=format!("{}{}",uuid::Uuid::new_v4().simple(),uuid::Uuid::new_v4().simple());
  let kp=minisign::KeyPair::generate_encrypted_keypair(Some(password.clone())).map_err(|_|"Key generation failed")?;
  let v=serde_json::json!({"password":password,"private":STANDARD.encode(kp.sk.to_box(None).map_err(|_|"Key encoding failed")?.to_string()),"public":STANDARD.encode(kp.pk.to_box().map_err(|_|"Public encoding failed")?.to_string())});
  entry.set_password(&v.to_string()).map_err(|_|"Cannot retain signing identity in Windows credential storage")?;v
 },Err(_)=>return Err("Cannot read local signing identity".into())};
 let public=value["public"].as_str().ok_or("Public identity missing")?;
 if Path::new(destination).exists(){if std::fs::read_to_string(destination).map_err(|_|"Public key inaccessible")?.trim()!=public{return Err("Public key mismatch; refusing rotation".into());}}
 else{std::fs::write(destination,format!("{public}\n")).map_err(|_|"Cannot save public key")?;}
 for (name,field) in [("TAURI_SIGNING_PRIVATE_KEY","private"),("TAURI_SIGNING_PRIVATE_KEY_PASSWORD","password")]{
  let body=value[field].as_str().ok_or("Signing credential field missing")?;
  let mut child=Command::new("gh").args(["secret","set",name,"--repo",jarvis_updater::REPO]).stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::null()).creation_flags(0x08000000).spawn().map_err(|_|"Cannot run GitHub secret provisioning")?;
  child.stdin.take().ok_or("No secret input pipe")?.write_all(body.as_bytes()).map_err(|_|"Cannot provide secret")?;
  if !child.wait().map_err(|_|"Secret provisioning interrupted")?.success(){return Err("GitHub did not accept updater secret; local identity retained for retry".into());}
 }
 println!("Updater signing identity retained in Windows credentials; two GitHub signing secrets configured; public key saved. No private material written to disk or output.");Ok(())
}
