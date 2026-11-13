//! Jarvis-owned signed Windows/macOS updates. No upstream service or credentials.
use crate::{AppState,db,workspace};
use serde::Serialize;
use serde_json::{Value,json};
use std::{path::PathBuf,sync::{Mutex,LazyLock,atomic::{AtomicBool,Ordering}},time::{Duration,Instant}};
use tauri::{AppHandle,Emitter,Manager};
use tauri_plugin_updater::UpdaterExt;
use jarvis_updater::{Manifest,Package};
const PUBKEY:&str=include_str!("../updater-pubkey.txt");
const INSTALL_RECORD:&str="updater.install";
#[derive(Clone,Serialize,Default)]
pub struct Status{
 pub current:String,pub state:String,pub checking:bool,pub version:Option<String>,pub notes:Option<String>,pub date:Option<String>,pub size:u64,pub got:u64,pub dismissed:bool,pub too_old:bool,pub error:Option<String>,pub checked_at:Option<String>,
 pub channel:String,pub auto_check:bool,pub can_install:bool,pub disabled:bool,
}
#[derive(Clone)]struct Candidate{manifest:Manifest,raw:Value,package:Package}
static STATUS:LazyLock<Mutex<Status>>=LazyLock::new(||Mutex::new(Status{state:"idle".into(),channel:"preview".into(),auto_check:true,..Default::default()}));
static LATEST:Mutex<Option<Candidate>>=Mutex::new(None);
static BUSY:AtomicBool=AtomicBool::new(false);
static PREPARE:Mutex<Option<(String,tokio::sync::oneshot::Sender<Option<String>>)>>=Mutex::new(None);
struct Guard;impl Drop for Guard{fn drop(&mut self){BUSY.store(false,Ordering::Release);}}
fn guard()->Result<Guard,String>{BUSY.compare_exchange(false,true,Ordering::AcqRel,Ordering::Relaxed).map(|_|Guard).map_err(|_|"更新操作正在进行，请稍候".into())}
fn prefs(app:&AppHandle)->(String,bool){let st=app.state::<AppState>();let db=st.db.lock().unwrap();(db::kv_get(&db,"updater.channel").filter(|c|jarvis_updater::endpoint(c).is_ok()).unwrap_or("preview".into()),db::kv_get(&db,"updater.auto").map(|v|v=="true").unwrap_or(true))}
pub fn status(app:&AppHandle)->Status{let mut s=STATUS.lock().unwrap().clone();s.current=app.package_info().version.to_string();let(c,a)=prefs(app);s.channel=c;s.auto_check=a;s.can_install=crate::dev_data_dir().is_none();s.disabled=cfg!(feature="no-update");s}
fn set(app:&AppHandle,f:impl FnOnce(&mut Status)){f(&mut STATUS.lock().unwrap());let _=app.emit("update-status",status(app));crate::update_tray(app);}
pub fn too_old()->bool{false}
pub fn state()->String{STATUS.lock().unwrap().state.clone()}
pub fn tray_text()->String{let s=STATUS.lock().unwrap();match(s.state.as_str(),&s.version){("ready",Some(v))=>format!("新版本 {v} 已就绪"),("downloading",_)=>"正在下载更新…".into(),("installing",_)=>"正在安装更新…".into(),("available",Some(v))=>format!("发现更新 {v}"),_=>"检查软件更新".into()}}
pub fn preferences(app:&AppHandle,channel:String,auto_check:bool)->Result<Status,String>{let _g=guard()?;jarvis_updater::endpoint(&channel)?;let previous=prefs(app).0;{let st=app.state::<AppState>();let c=st.db.lock().unwrap();db::kv_set(&c,"updater.channel",&channel).map_err(|_|"更新设置保存失败")?;db::kv_set(&c,"updater.auto",if auto_check{"true"}else{"false"}).map_err(|_|"更新设置保存失败")?;}if previous!=channel{*LATEST.lock().unwrap()=None;set(app,|s|{s.state="idle".into();s.version=None;s.notes=None;s.got=0;s.size=0;s.error=None;s.checked_at=None;});}else{set(app,|_|{});}Ok(status(app))}
fn platform()->Result<&'static str,String>{if cfg!(all(windows,target_arch="x86_64")){Ok("windows-x86_64")}else if cfg!(all(target_os="macos",target_arch="aarch64")){Ok("darwin-aarch64")}else{Err("当前系统与架构暂无自动更新包".into())}}
fn client()->Result<reqwest::Client,String>{reqwest::Client::builder().user_agent("JarvisButler-Updater").connect_timeout(Duration::from_secs(15)).read_timeout(Duration::from_secs(30)).build().map_err(|_|"更新网络初始化失败".into())}
async fn bounded(url:&str,max:u64,mut progress:impl FnMut(u64))->Result<Vec<u8>,String>{
 for attempt in 0..3{let r=client()?.get(url).timeout(Duration::from_secs(180)).send().await;let response=match r{Ok(r)=>r,Err(_)=>{if attempt<2{tokio::time::sleep(Duration::from_millis(700*(attempt+1))).await;continue;}return Err("更新网络连接失败，请稍后重试".into());}};
 if response.status().as_u16()==404{return Err("该渠道尚未发布可用的签名更新版本".into());}
 if response.status().is_server_error()||response.status().as_u16()==429{if attempt<2{tokio::time::sleep(Duration::from_millis(700*(attempt+1))).await;continue;}}
 if !response.status().is_success(){return Err(format!("更新服务返回 {}",response.status().as_u16()));}
 if response.content_length().is_some_and(|n|n>max){return Err("更新内容大小不符，已拒绝下载".into());}
 let mut response=response;let mut bytes=Vec::new();progress(0);
 loop{match response.chunk().await{Ok(Some(chunk))=>{if bytes.len()as u64+chunk.len()as u64>max{return Err("更新内容超出允许大小".into());}bytes.extend_from_slice(&chunk);progress(bytes.len()as u64);},Ok(None)=>return Ok(bytes),Err(_)=>break}}
 if attempt==2{return Err("更新下载中断，请重试".into());}
 tokio::time::sleep(Duration::from_millis(700*(attempt+1))).await;
 }Err("更新下载失败".into())
}
fn candidate(bytes:&[u8])->Result<Candidate,String>{let m=jarvis_updater::parse(bytes)?;let p=m.platforms.get(platform()?).cloned().ok_or("该版本缺少当前平台更新包")?;let raw=serde_json::from_slice(bytes).map_err(|_|"更新清单无效")?;Ok(Candidate{manifest:m,raw,package:p})}
fn updater(app:&AppHandle)->Result<tauri_plugin_updater::Updater,String>{app.updater_builder().timeout(Duration::from_secs(180)).build().map_err(|_|"签名更新插件初始化失败".into())}
fn verify(app:&AppHandle,c:&Candidate,bytes:&[u8])->Result<tauri_plugin_updater::Update,String>{jarvis_updater::verify(bytes,&c.package,&c.manifest.version,PUBKEY)?;let u=updater(app)?.restore_update(c.raw.clone()).map_err(|_|"签名更新信息无法恢复")?.ok_or("该版本不高于当前版本，不安装")?;u.verify(bytes).map_err(|_|"官方插件拒绝此更新签名")?;Ok(u)}
fn directory(app:&AppHandle)->PathBuf{app.state::<AppState>().data_dir.join("updater-cache")}
fn cache_bytes(app:&AppHandle,c:&Candidate)->Result<Vec<u8>,String>{let path=directory(app).join("package.bin");if std::fs::metadata(&path).map_err(|_|"更新包缓存不存在")?.len()!=c.package.size{return Err("更新缓存大小不符".into());}std::fs::read(path).map_err(|_|"无法读取更新缓存".into())}
fn atomic(path:&std::path::Path,bytes:&[u8])->Result<(),String>{let temp=path.with_extension(format!("{}.part",uuid::Uuid::new_v4().simple()));std::fs::write(&temp,bytes).map_err(|_|"无法保存更新，请检查磁盘空间")?;std::fs::rename(&temp,path).map_err(|_|"无法切换更新缓存")?;Ok(())}
pub async fn check(app:&AppHandle,_manual:bool)->Result<(),String>{
 if cfg!(feature="no-update"){return Err("本构建已禁用更新".into());}let _g=guard()?;
 if matches!(state().as_str(),"downloading"|"installing"){return Err("更新正在进行".into());}
 set(app,|s|{s.checking=true;s.error=None;});
 let result=async{let channel=prefs(app).0;let bytes=bounded(jarvis_updater::endpoint(&channel)?,1024*1024,|_|{}).await?;candidate(&bytes)}.await;
 match result{Ok(c)=>{
 let newer=jarvis_updater::newer(&c.manifest.version,&app.package_info().version.to_string());
 if newer{let cached=cache_bytes(app,&c).ok().is_some_and(|bytes|verify(app,&c,&bytes).is_ok());let dismissed={let st=app.state::<AppState>();let v=db::kv_get(&st.db.lock().unwrap(),"updater.dismissed");v==Some(c.manifest.version.clone())};set(app,|s|{s.checking=false;s.state=if cached{"ready"}else{"available"}.into();s.version=Some(c.manifest.version.clone());s.notes=Some(c.manifest.notes.clone());s.date=Some(c.manifest.pub_date.clone());s.size=c.package.size;s.got=if cached{c.package.size}else{0};s.dismissed=dismissed;s.checked_at=Some(db::now_sec());});*LATEST.lock().unwrap()=Some(c);}
 else{*LATEST.lock().unwrap()=None;set(app,|s|{s.checking=false;s.state="idle".into();s.version=None;s.notes=None;s.size=0;s.got=0;s.checked_at=Some(db::now_sec());});}Ok(())},Err(e)=>{set(app,|s|{s.checking=false;s.error=Some(e.clone());});Err(e)}}
}
pub fn download(app:&AppHandle){if cfg!(feature="no-update"){return;}let Ok(g)=guard()else{return;};let Some(c)=LATEST.lock().unwrap().clone()else{return;};if !matches!(state().as_str(),"available"|"ready"){return;}set(app,|s|{s.state="downloading".into();s.got=0;s.error=None;});let app=app.clone();tauri::async_runtime::spawn(async move{let _g=g;let result=async{
 let mut last=Instant::now();let bytes=bounded(&c.package.url,c.package.size,|got|{if got==0||got==c.package.size||last.elapsed()>Duration::from_millis(200){last=Instant::now();set(&app,|s|s.got=got);}}).await?;
 verify(&app,&c,&bytes)?;let dir=directory(&app);std::fs::create_dir_all(&dir).map_err(|_|"无法创建更新缓存")?;atomic(&dir.join("package.bin"),&bytes)?;let mut raw=c.raw.clone();raw["jarvis_channel"]=json!(prefs(&app).0);atomic(&dir.join("manifest.json"),&serde_json::to_vec(&raw).map_err(|_|"更新缓存信息无效")?)?;Ok::<(),String>(())}.await;
 set(&app,|s|match result{Ok(())=>{s.state="ready".into();s.got=c.package.size;},Err(e)=>{s.state="available".into();s.error=Some(e);s.got=0;}});});}
pub fn ack(window:&str,token:String,error:Option<String>)->Result<(),String>{if window!="main"{return Err("只接受主窗口的保存回执".into());}let mut slot=PREPARE.lock().unwrap();if slot.as_ref().is_none_or(|(id,_)|*id!=token){return Err("更新保存回执已失效".into());}if let Some((_,tx))=slot.take(){let _=tx.send(error);}Ok(())}
async fn save_editors(app:&AppHandle)->Result<(),String>{
 for (label,w) in app.webview_windows(){if (label.starts_with("note-")||["qnote","flash"].contains(&label.as_str()))&&w.is_visible().unwrap_or(true){return Err("请先保存并关闭笔记或快捷记录窗口，再安装更新".into());}}
 if app.get_webview_window("main").is_none(){return Err("请从主窗口的软件更新页面确认安装".into());}
 let token=uuid::Uuid::new_v4().to_string();let(tx,rx)=tokio::sync::oneshot::channel();*PREPARE.lock().unwrap()=Some((token.clone(),tx));
 if app.emit_to("main","update-prepare",token).is_err(){PREPARE.lock().unwrap().take();return Err("无法确认编辑已保存，未开始安装".into());}
 let result=tokio::time::timeout(Duration::from_secs(12),rx).await;PREPARE.lock().unwrap().take();match result{Ok(Ok(None))=>Ok(()),Ok(Ok(Some(e)))=>Err(e),_=>Err("保存确认超时，未开始安装，请重试".into())}
}
pub async fn install(app:&AppHandle,confirmed:bool)->Result<(),String>{
 if !confirmed{return Err("需要本人确认后才能安装".into());}if cfg!(feature="no-update"){return Err("本构建已禁用更新".into());}if crate::dev_data_dir().is_some(){return Err("开发预览只支持检查与下载；请使用正式安装的测试包执行升级".into());}
 let _g=guard()?;if state()!="ready"{return Err("更新尚未下载并校验完成".into());}let c=LATEST.lock().unwrap().clone().ok_or("更新信息不存在")?;let bytes=cache_bytes(app,&c)?;let update=verify(app,&c,&bytes)?;
 set(app,|s|{s.state="installing".into();s.error=None;});
 let result=async{save_editors(app).await?;
 let r=app.state::<workspace::Runtime>();let _capture=r.capture_lock.lock().await;let st=app.state::<AppState>();let dest=st.data_dir.join("backups").join(format!("update-{}",uuid::Uuid::new_v4().simple()));std::fs::create_dir_all(&dest).map_err(|_|"安装前备份目录创建失败")?;
 {let db=st.db.lock().unwrap();db.execute("VACUUM INTO ?1",[dest.join("dingmi.db").to_string_lossy().as_ref()]).map_err(|_|"安装前笔记备份失败")?;r.store.backup_and_freeze(&dest.join("workspace.db"))?;db::kv_set(&db,INSTALL_RECORD,&json!({"from":app.package_info().version.to_string(),"target":c.manifest.version}).to_string()).map_err(|_|"更新记录保存失败")?;db.execute_batch("PRAGMA query_only=ON").map_err(|_|"无法暂停编辑")?;}
 std::fs::write(dest.join("backup.json"),json!({"format":"jarvis-update-backup","from":app.package_info().version.to_string(),"target":c.manifest.version}).to_string()).map_err(|_|"更新备份清单写入失败")?;
 update.install(&bytes).map_err(|_|"安装程序启动或应用替换失败；原资料与备份保留")?;
 #[cfg(target_os="macos")]app.restart();
 Ok::<(),String>(())}.await;
 if let Err(e)=&result{let st=app.state::<AppState>();let _=st.db.lock().unwrap().execute_batch("PRAGMA query_only=OFF");let _=app.state::<workspace::Runtime>().store.freeze(false);set(app,|s|{s.state="ready".into();s.error=Some(e.clone());});}result
}
pub fn dismiss(app:&AppHandle){let Some(v)=status(app).version else{return;};let st=app.state::<AppState>();let _=db::kv_set(&st.db.lock().unwrap(),"updater.dismissed",&v);set(app,|s|s.dismissed=true);}
pub fn take_notice(app:&AppHandle)->Option<String>{let st=app.state::<AppState>();let c=st.db.lock().unwrap();let record:Value=serde_json::from_str(&db::kv_get(&c,INSTALL_RECORD)?).ok()?;let _=db::kv_del(&c,INSTALL_RECORD);if record["target"].as_str()==Some(&app.package_info().version.to_string()){Some(format!("已更新到 {}，资料已保留",app.package_info().version))}else{Some("上次更新尚未完成，原资料和安装前备份已保留".into())}}
pub fn start(app:AppHandle){
 crate::terms::load(&app);
 if cfg!(feature="no-update"){return;}
 let cached=std::fs::read(directory(&app).join("manifest.json")).ok().and_then(|b|candidate(&b).ok()).filter(|c|c.raw["jarvis_channel"].as_str()==Some(prefs(&app).0.as_str()));if let Some(c)=cached{if cache_bytes(&app,&c).ok().is_some_and(|b|verify(&app,&c,&b).is_ok()){set(&app,|s|{s.state="ready".into();s.version=Some(c.manifest.version.clone());s.notes=Some(c.manifest.notes.clone());s.date=Some(c.manifest.pub_date.clone());s.size=c.package.size;s.got=c.package.size;});*LATEST.lock().unwrap()=Some(c);}}
 tauri::async_runtime::spawn(async move{tokio::time::sleep(Duration::from_secs(60)).await;loop{if prefs(&app).1{let _=check(&app,false).await;}tokio::time::sleep(Duration::from_secs(6*3600)).await;}});
}
#[derive(Serialize)]pub struct History{version:String,name:String,date:String,body:String,url:String}
pub async fn history()->Result<Vec<History>,String>{let bytes=bounded("https://api.github.com/repos/aiyinsitan520/jarvis-butler-desktop/releases?per_page=10",1024*1024,|_|{}).await?;let rows:Vec<Value>=serde_json::from_slice(&bytes).map_err(|_|"无法读取更新记录")?;Ok(rows.into_iter().filter_map(|r|{if r["draft"].as_bool()==Some(true){return None;}let tag=r["tag_name"].as_str()?;semver::Version::parse(tag.strip_prefix('v')?).ok()?;Some(History{version:tag.into(),name:r["name"].as_str().unwrap_or(tag).chars().take(200).collect(),date:r["published_at"].as_str().unwrap_or("").into(),body:r["body"].as_str().unwrap_or("").chars().take(12000).collect(),url:format!("https://github.com/{}/releases/tag/{tag}",jarvis_updater::REPO)})}).collect())}
#[cfg(test)]mod tests{
 use super::*;use std::io::{Read,Write};
 fn server(responses:Vec<&'static str>)->(String,std::thread::JoinHandle<()>){let l=std::net::TcpListener::bind("127.0.0.1:0").unwrap();let url=format!("http://{}/test",l.local_addr().unwrap());let h=std::thread::spawn(move||{for response in responses{let(mut s,_)=l.accept().unwrap();let mut request=[0;4096];let _=s.read(&mut request);s.write_all(response.as_bytes()).unwrap();}});(url,h)}
 #[tokio::test]async fn bounded_download_retries_transient_failure(){let(u,h)=server(vec!["HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n","HTTP/1.1 200 OK\r\nContent-Length: 4\r\nConnection: close\r\n\r\ntest"]);assert_eq!(bounded(&u,4,|_|{}).await.unwrap(),b"test");h.join().unwrap();}
 #[tokio::test]async fn oversized_download_rejected_before_buffering(){let(u,h)=server(vec!["HTTP/1.1 200 OK\r\nContent-Length: 500000000\r\nConnection: close\r\n\r\n"]);assert!(bounded(&u,4,|_|{}).await.unwrap_err().contains("大小"));h.join().unwrap();}
 #[tokio::test]async fn missing_channel_is_failure_not_latest(){let(u,h)=server(vec!["HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"]);assert!(bounded(&u,1024,|_|{}).await.unwrap_err().contains("尚未发布"));h.join().unwrap();}
 #[test]fn forged_save_acknowledgement_cannot_authorize_install(){assert!(ack("qnote","fake".into(),None).is_err());assert!(ack("main","fake".into(),None).is_err());}
}
