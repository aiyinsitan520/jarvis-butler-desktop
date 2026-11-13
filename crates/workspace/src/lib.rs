//! Jarvis v1 six-table store: local authority by default, explicit server authority after consent.
pub mod ai;
mod local;
pub mod server;
pub mod capture;
pub mod memory;
pub mod wechat;
pub mod vault;
pub mod ingest;
pub mod learning;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{path::Path, sync::{Arc, Mutex, RwLock}, time::Duration};
use tokio::sync::Mutex as AsyncMutex;

pub type Result<T> = std::result::Result<T, String>;
const MAX_RESPONSE: usize = 25 * 1024 * 1024;
pub const TABLES: [&str; 6] = ["notebooks", "notes", "sources", "todos", "inspirations", "relations"];

#[derive(Clone)]
pub struct ConnectionConfig { pub base_url: String, pub token: String }
impl ConnectionConfig {
    pub fn checked(base_url: &str, token: &str) -> Result<Self> {
        let u = reqwest::Url::parse(base_url.trim()).map_err(|_| "数据服务地址无效")?;
        let local = matches!(u.host_str(), Some("localhost" | "127.0.0.1" | "[::1]" | "::1"));
        if !(u.scheme() == "https" || u.scheme() == "http" && local) || !u.username().is_empty() || u.password().is_some() || u.query().is_some() || u.fragment().is_some() || u.path() != "/" {
            return Err("数据服务仅接受 HTTPS 源站或本机 HTTP 源站，不含路径或凭据".into());
        }
        if token.trim().is_empty() { return Err("请填写数据服务设备令牌".into()); }
        Ok(Self {base_url: base_url.trim().trim_end_matches('/').into(), token: token.trim().into()})
    }
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Snapshot { pub data: Value, pub hash: String, #[serde(rename = "savedAt")] pub saved_at: String }
#[derive(Clone, Serialize, Deserialize, Debug, PartialEq)]
pub struct Expected { pub revision: u64, pub hash: String }
impl Snapshot { pub fn expected(&self) -> Expected { Expected {revision: self.data["revision"].as_u64().unwrap_or(0), hash: self.hash.clone()} } }
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Operation { pub id: String, pub command: Value, pub expected: Option<Expected>, pub fingerprint: Option<String>, pub status: String, pub result: Option<String>, pub error: Option<String> }
#[derive(Clone, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct View { pub snapshot: Option<Snapshot>, pub local: bool, pub online: bool, pub configured: bool, pub pending: usize, pub conflicts: usize, pub last_error: String }
#[derive(Default)]
struct Connectivity { online: bool, error: String }
pub struct WorkspaceStore {
    db: Mutex<Connection>, config: RwLock<Option<ConnectionConfig>>, network: AsyncMutex<()>, connectivity: Mutex<Connectivity>, client: reqwest::Client,
}

pub fn stable(value: &Value) -> String {
    match value {
        Value::Object(map) => { let mut keys: Vec<_> = map.keys().collect(); keys.sort_by(|a,b| a.encode_utf16().cmp(b.encode_utf16())); format!("{{{}}}", keys.into_iter().map(|k| format!("{}:{}", serde_json::to_string(k).unwrap(), stable(&map[k]))).collect::<Vec<_>>().join(",")) },
        Value::Array(items) => format!("[{}]", items.iter().map(stable).collect::<Vec<_>>().join(",")),
        _ => value.to_string(),
    }
}
pub fn fingerprint(expected: &Expected, command: &Value) -> String { format!("{:x}", Sha256::digest(stable(&json!({"expected":expected,"command":command})).as_bytes())) }
pub fn empty_data() -> Value { json!({"version":1,"revision":0,"exportedAt":"","notebooks":[],"notes":[],"sources":[],"todos":[],"inspirations":[],"relations":[]}) }

pub fn validate_snapshot(v: Value) -> Result<Snapshot> {
    let snap: Snapshot = serde_json::from_value(v).map_err(|_| "服务快照格式无效")?;
    if snap.data["version"] != 1 || snap.data["revision"].as_u64().is_none() || snap.hash.len() != 64 || !snap.hash.bytes().all(|b| b.is_ascii_hexdigit()) { return Err("服务快照版本或校验信息无效".into()); }
    for table in TABLES {
        let rows = snap.data[table].as_array().ok_or("服务快照缺少数据表")?;
        let mut ids = std::collections::HashSet::new();
        for row in rows {
            let id = row["id"].as_str().filter(|s| !s.is_empty()).ok_or("记录标识无效")?;
            if !ids.insert(id) || row["createdAt"].as_u64().is_none() { return Err("记录重复或时间无效".into()); }
            let text_fields: &[&str] = match table {"notebooks"=> &["name","desc","tone"], "notes"=> &["notebookId","title","content"], "sources"=> &["notebookId","title","type"], "todos"=> &["title","priority"], "inspirations"=> &["title","content"], _=> &["fromId","fromType","toId","toType","relationType"]};
            if text_fields.iter().any(|k| !row[*k].is_string()) { return Err("记录字段无效".into()); }
            if table == "todos" && !row["done"].is_boolean() { return Err("待办状态无效".into()); }
        }
    }
    Ok(snap)
}

impl WorkspaceStore {
    pub fn open(path: &Path) -> Result<Arc<Self>> {
        if let Some(p) = path.parent() { std::fs::create_dir_all(p).map_err(|_| "无法创建桌面数据目录")?; }
        let c = Connection::open(path).map_err(|_| "无法打开桌面缓存")?;
        c.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
          CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY,value TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY,payload TEXT NOT NULL,created INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS captures(id TEXT PRIMARY KEY,payload TEXT NOT NULL,created INTEGER NOT NULL);").map_err(|_| "无法初始化桌面缓存")?;
        let client = reqwest::Client::builder().timeout(Duration::from_secs(22)).redirect(reqwest::redirect::Policy::none()).build().map_err(|_| "无法创建数据连接")?;
        Ok(Arc::new(Self {db: Mutex::new(c), config: RwLock::new(None), network: AsyncMutex::new(()), connectivity: Mutex::new(Connectivity::default()), client}))
    }
    pub fn configure(&self, config: Option<ConnectionConfig>) -> Result<()> {
        if config.is_some() && self.is_local()? && self.cached()?.is_some_and(|s| TABLES.iter().any(|t|s.data[*t].as_array().is_some_and(|xs|!xs.is_empty()))) { return Err("已有本地知识记录，请保留本地模式；共享连接请使用独立数据目录".into()); }
        let new_origin = config.as_ref().map(|c| c.base_url.as_str()).unwrap_or("");
        if let Some(old) = self.get_value("workspace-origin")? {
            if old.as_str().unwrap_or("") != new_origin && (!self.operations()?.is_empty() || self.cached()?.is_some()) { return Err("此桌面已连接其他资料库；请使用新的桌面数据目录，防止混合两份资料".into()); }
        }
        if !new_origin.is_empty() { self.set_value("workspace-origin", &json!(new_origin))?; }
        *self.config.write().unwrap() = config;
        Ok(())
    }
    pub fn cached(&self) -> Result<Option<Snapshot>> { self.get_value("snapshot")?.map(serde_json::from_value).transpose().map_err(|_| "缓存损坏，原文件已保留".into()) }
    pub fn view(&self) -> Result<View> {
        let ops = self.operations()?; let state = self.connectivity.lock().unwrap();
        Ok(View {snapshot:if self.is_local()?{Some(self.local_snapshot()?)}else{self.cached()?},local:self.is_local()?,online:state.online,configured:self.config.read().unwrap().is_some(),pending:ops.iter().filter(|o| matches!(o.status.as_str(),"pending"|"unknown")).count(),conflicts:ops.iter().filter(|o| matches!(o.status.as_str(),"conflict"|"draft")).count(),last_error:state.error.clone()})
    }
    pub fn set_value(&self, key: &str, value: &Value) -> Result<()> { self.db.lock().unwrap().execute("INSERT INTO kv VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",params![key,value.to_string()]).map(|_|()).map_err(|_| "无法保存本机状态".into()) }
    pub fn compare_set_value(&self,key:&str,value:&Value,revision:u64)->Result<()> {
        let mut db=self.db.lock().unwrap();let tx=db.transaction().map_err(|_|"状态事务失败")?;
        let old:Option<String>=tx.query_row("SELECT value FROM kv WHERE key=?1",[key],|r|r.get(0)).optional().map_err(|_|"状态读取失败")?;
        let old:Value=old.map(|s|serde_json::from_str(&s)).transpose().map_err(|_|"状态损坏")?.unwrap_or(Value::Null);
        if old["revision"].as_u64().unwrap_or(0)!=revision{return Err("本机归档已更新，请重试；未覆盖新内容".into());}
        let mut value=value.clone();value["revision"]=json!(revision+1);
        tx.execute("INSERT INTO kv VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",params![key,value.to_string()]).map_err(|_|"本机状态保存失败")?;tx.commit().map_err(|_|"本机状态提交失败".into())
    }
    pub fn get_value(&self, key: &str) -> Result<Option<Value>> {
        let s: Option<String> = self.db.lock().unwrap().query_row("SELECT value FROM kv WHERE key=?1",[key],|r|r.get(0)).optional().map_err(|_| "无法读取本机状态")?;
        s.map(|s|serde_json::from_str(&s)).transpose().map_err(|_| "本机状态损坏，停止处理并保留原文件".into())
    }
    pub fn save_operation(&self, op: &Operation) -> Result<()> { self.db.lock().unwrap().execute("INSERT INTO operations VALUES(?1,?2,?3) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",params![op.id,serde_json::to_string(op).unwrap(),chrono::Utc::now().timestamp_millis()]).map(|_|()).map_err(|_| "待同步任务落盘失败".into()) }
    pub fn operations(&self) -> Result<Vec<Operation>> {
        let c=self.db.lock().unwrap(); let mut q=c.prepare("SELECT payload FROM operations ORDER BY created,rowid").map_err(|_| "无法读取队列")?;
        let rows = q.query_map([],|r|r.get::<_,String>(0)).map_err(|_|"无法读取队列")?;
        rows.map(|s|serde_json::from_str(&s.map_err(|_|"队列读取失败")?).map_err(|_|"队列损坏，已停止自动处理".into())).collect()
    }
    fn state_error(&self, error: &str) { let mut s=self.connectivity.lock().unwrap(); s.online=false; s.error=error.into(); }
    async fn http(&self, method: reqwest::Method, route: &str, body: Option<&Value>) -> Result<(u16,Value)> {
        let config=self.config.read().unwrap().clone().ok_or("尚未配置共享数据服务；记录保留在本机待同步箱")?;
        self.http_at(&config,method,route,body).await
    }
    async fn http_at(&self, config: &ConnectionConfig, method: reqwest::Method, route: &str, body: Option<&Value>) -> Result<(u16,Value)> {
        let mut req=self.client.request(method,format!("{}{route}",config.base_url)).bearer_auth(&config.token).header("Accept","application/json");
        if let Some(v)=body {req=req.json(v);}
        let mut response=req.send().await.map_err(|_|"数据服务暂不可达；保存结果需要核对")?;
        let status=response.status().as_u16(); let mut bytes=Vec::new();
        while let Some(chunk)=response.chunk().await.map_err(|_|"数据响应中断；保存结果需要核对")? {if bytes.len()+chunk.len()>MAX_RESPONSE {return Err("数据响应超过25MiB".into());}bytes.extend(chunk);}
        let data=serde_json::from_slice(&bytes).map_err(|_|"数据服务返回无效 JSON")?;
        Ok((status,data))
    }
    async fn fetch_snapshot(&self) -> Result<Snapshot> {
        let (code,value)=self.http(reqwest::Method::GET,"/api/sync/snapshot",None).await?;
        if code!=200 {return Err(if code==401||code==403 {"数据服务认证失败".into()}else{format!("读取资料失败（HTTP {code}）")});}
        let snap=validate_snapshot(value)?;
        if self.cached()?.is_some_and(|old|old.expected().revision>snap.expected().revision) {return Err("服务版本低于本机缓存，已停止以避免回退资料".into());}
        self.set_value("snapshot",&serde_json::to_value(&snap).unwrap())?;
        self.set_value("sync-last-success",&json!(chrono::Utc::now().to_rfc3339()))?;
        let mut state=self.connectivity.lock().unwrap();state.online=true;state.error.clear();
        Ok(snap)
    }
    pub async fn refresh(&self) -> Result<Snapshot> {
        let _serial=self.network.lock().await;
        if self.is_local()? {return self.local_snapshot();}
        let result=self.fetch_snapshot().await;
        if let Err(e)=&result {self.state_error(e);}
        result
    }
    pub async fn health(&self) -> Result<()> {let (code,v)=self.http(reqwest::Method::GET,"/api/sync/health",None).await?;if code==200&&v["ok"]==true {Ok(())}else{Err("数据服务连接检查失败".into())}}
    pub async fn submit(&self, command: Value, expected: Option<Expected>) -> Result<Operation> {self.submit_once(&uuid::Uuid::new_v4().simple().to_string(),command,expected).await}
    pub async fn submit_once(&self, id: &str, command: Value, expected: Option<Expected>) -> Result<Operation> {
        if id.len()>128||id.len()<16||!id.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'_'||b==b'-') {return Err("本机操作标识无效".into());}
        if !command.is_object()||!command["type"].is_string(){return Err("业务命令无效".into());}
        let _serial=self.network.lock().await;
        if self.server_transfer_active()? {
            if let Some(old)=self.operations()?.into_iter().find(|o|o.id==id){if old.command!=command{return Err("同一任务的内容已改变".into());}return Ok(old);}
            let op=Operation{id:id.into(),command,expected,fingerprint:None,status:"draft".into(),result:None,error:Some("首次同步尚待核对，内容已保存为本机草稿；连接确认后请核对重试".into())};self.save_operation(&op)?;return Ok(op);
        }
        if self.is_local()? {return self.local_submit(id,command,expected,false);}
        let existing=self.operations()?.into_iter().find(|o|o.id==id);
        let mut op=if let Some(old)=existing {if old.command!=command{return Err("同一任务的内容已改变，已停止重复提交".into());}old}else{Operation{id:id.into(),command,expected,fingerprint:None,status:"pending".into(),result:None,error:None}};
        if op.status=="committed"||op.status=="conflict"||op.status=="draft" {return Ok(op);}
        self.save_operation(&op)?; // persist BEFORE the first network call
        if let Err(e)=self.flush_one(&mut op).await {self.state_error(&e);op.error=Some(e);if op.expected.is_some()&&op.status=="pending"&&!is_create(&op.command){op.status="draft".into();}self.save_operation(&op)?;}
        Ok(op)
    }
    async fn flush_one(&self, op: &mut Operation) -> Result<()> {
        if op.status=="unknown" {
            let expected=op.expected.clone().ok_or("任务缺少原始版本")?;
            let fp=fingerprint(&expected,&op.command);
            let route=format!("/api/sync/receipt?id={}&fingerprint={fp}",op.id);
            let (code,r)=self.http(reqwest::Method::GET,&route,None).await?;
            if code==200&&r["status"]=="committed" {op.result=r["result"].as_str().map(str::to_owned);op.status="committed".into();op.error=None;self.save_operation(op)?;self.fetch_snapshot().await?;return Ok(());}
            if code!=404 {return Err("上次提交的结果尚未确认，已停止重发".into());}
            // No receipt: retry the SAME envelope. Never refresh its expected revision here.
        }
        if op.expected.is_none(){op.expected=Some(self.fetch_snapshot().await?.expected());}
        let expected=op.expected.clone().unwrap(); let fp=fingerprint(&expected,&op.command);
        op.fingerprint=Some(fp.clone());op.status="unknown".into();self.save_operation(op)?;
        let body=json!({"requestId":op.id,"fingerprint":fp,"expected":expected,"command":op.command});
        let (code,value)=self.http(reqwest::Method::POST,"/api/sync/command",Some(&body)).await?;
        if code==200 {
            let snap=validate_snapshot(value["snapshot"].clone())?;
            op.result=Some(value["result"].as_str().ok_or("保存响应缺少结果标识，等待回执核对")?.into());op.status="committed".into();op.error=None;
            self.save_operation(op)?;
            self.set_value("snapshot",&serde_json::to_value(snap).unwrap())?;
            let mut s=self.connectivity.lock().unwrap();s.online=true;s.error.clear();return Ok(());
        }
        if code==409 {
            let route=format!("/api/sync/receipt?id={}&fingerprint={}",op.id,op.fingerprint.as_deref().unwrap());
            let (rc,receipt)=self.http(reqwest::Method::GET,&route,None).await?;
            if rc==200&&receipt["status"]=="committed" {op.result=receipt["result"].as_str().map(str::to_owned);op.status="committed".into();op.error=None;self.save_operation(op)?;self.fetch_snapshot().await?;return Ok(());}
            if rc==404 {op.status="conflict".into();op.error=Some("其他客户端已更新资料；请核对草稿后重试".into());self.save_operation(op)?;let _=self.fetch_snapshot().await;return Ok(());}
            return Err("服务端提交结果待核对，未重新执行".into());
        }
        op.status=if code==401||code==403 {"pending"}else{"draft"}.into();
        Err(format!("业务保存失败（HTTP {code}），内容已保留"))
    }
    pub async fn flush(&self) -> Result<()> {
        let _serial=self.network.lock().await;
        if self.is_local()? {return Ok(());}
        for mut op in self.operations()?.into_iter().filter(|o|matches!(o.status.as_str(),"pending"|"unknown")) {if let Err(e)=self.flush_one(&mut op).await {op.error=Some(e.clone());self.save_operation(&op)?;self.state_error(&e);return Err(e);}}
        Ok(())
    }
    pub async fn retry(&self, id: &str) -> Result<Operation> {
        let _serial=self.network.lock().await;
        if self.server_transfer_active()?{return Err("请先核对首次同步回执，草稿已保留".into());}
        let mut op=self.operations()?.into_iter().find(|o|o.id==id).ok_or("未找到草稿")?;
        if !matches!(op.status.as_str(),"draft"|"conflict") {return Err("该任务不是可手动重试的草稿".into());}
        // A definite rejection has no receipt. A fresh operation is allowed only after explicit review.
        if self.is_local()? {return self.local_submit(id,op.command,None,true);}
        op.expected=Some(self.fetch_snapshot().await?.expected());op.fingerprint=None;op.status="pending".into();op.error=None;self.save_operation(&op)?;
        if let Err(e)=self.flush_one(&mut op).await {op.error=Some(e);self.save_operation(&op)?;}Ok(op)
    }
    pub fn discard(&self,id:&str)->Result<()> {let mut op=self.operations()?.into_iter().find(|o|o.id==id).ok_or("未找到草稿")?;if op.status=="unknown"{return Err("提交结果未确认，不能丢弃".into());}op.status="discarded".into();self.save_operation(&op)}
    pub fn save_capture(&self,id:&str,value:&Value)->Result<()> {self.db.lock().unwrap().execute("INSERT INTO captures VALUES(?1,?2,?3) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",params![id,value.to_string(),chrono::Utc::now().timestamp_millis()]).map(|_|()).map_err(|_|"原消息落盘失败".into())}
    pub fn captures(&self)->Result<Vec<Value>> {let c=self.db.lock().unwrap();let mut q=c.prepare("SELECT payload FROM captures ORDER BY created DESC,rowid DESC").map_err(|_|"无法读取收件箱")?;let rows=q.query_map([],|r|r.get::<_,String>(0)).map_err(|_|"无法读取收件箱")?;rows.map(|s|serde_json::from_str(&s.map_err(|_|"收件箱读取失败")?).map_err(|_|"收件箱损坏".into())).collect()}
}
fn is_create(v:&Value)->bool {matches!(v["type"].as_str(),Some("createNotebook"|"createNote"|"createSource"|"createTodo"|"createInspiration"|"createRelation"))}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn canonical_fingerprint_orders_utf16_keys(){let e=Expected{revision:2,hash:"a".repeat(64)};assert_eq!(fingerprint(&e,&json!({"type":"createNote","data":{"title":"中文","content":"x"}})),fingerprint(&e,&json!({"data":{"content":"x","title":"中文"},"type":"createNote"})));assert_eq!(fingerprint(&e,&json!({"type":"clear"})).len(),64);}
    #[test] fn unsafe_origins_rejected(){for u in ["http://public.example","https://x/a","https://u:p@x","https://x/?token=a","file:///a"] {assert!(ConnectionConfig::checked(u,"test-token").is_err(),"{u}");}assert!(ConnectionConfig::checked("http://127.0.0.1:18787","test-token").is_ok());}
    #[tokio::test] async fn offline_create_survives_restart_without_false_success(){let dir=tempfile::tempdir().unwrap();let file=dir.path().join("cache.db");let s=WorkspaceStore::open(&file).unwrap();s.configure(Some(ConnectionConfig::checked("http://127.0.0.1:1","offline-fixture").unwrap())).unwrap();let id="0123456789abcdef0123456789abcdef";let op=s.submit_once(id,json!({"type":"createNote","data":{"title":"offline"}}),None).await.unwrap();assert_eq!(op.status,"pending");assert!(op.result.is_none());drop(s);let restored=WorkspaceStore::open(&file).unwrap();assert_eq!(restored.view().unwrap().pending,1);assert_eq!(restored.operations().unwrap()[0].id,id);}
    #[test] fn origin_change_is_not_silent(){let d=tempfile::tempdir().unwrap();let s=WorkspaceStore::open(&d.path().join("s.db")).unwrap();s.configure(Some(ConnectionConfig::checked("http://localhost:1234","test-token").unwrap())).unwrap();s.set_value("snapshot",&json!({"data":empty_data(),"hash":"a".repeat(64),"savedAt":"x"})).unwrap();assert!(s.configure(Some(ConnectionConfig::checked("http://localhost:5678","test-token").unwrap())).is_err());}
}
