//! Explicit first connection: read-only preview, durable import envelope, receipt recovery.
//! No credential or conversation archive is written into the transfer record.
use crate::*;

fn counts(s: &Snapshot) -> Value {
    let mut v=json!({});for t in TABLES {v[t]=json!(s.data[t].as_array().unwrap().len());}v
}
fn pending(v:&Value)->bool{matches!(v["status"].as_str(),Some("pending"|"unknown"))}
impl WorkspaceStore {
    pub fn server_transfer_active(&self)->Result<bool>{Ok(self.get_value("server-transfer")?.as_ref().is_some_and(pending))}
    pub fn server_transfer_status(&self)->Result<Value>{
        let v=self.get_value("server-transfer")?.unwrap_or(Value::Null);
        Ok(if v.is_null(){Value::Null}else{json!({"id":v["id"],"previewId":v["previewId"],"credentialId":v["credentialId"],"baseUrl":v["baseUrl"],"status":v["status"],"error":v["error"],"backupKey":v["backupKey"]})})
    }
    fn check_server_origin(&self,cfg:&ConnectionConfig)->Result<()> {
        if let Some(origin)=self.get_value("workspace-origin")? {if origin.as_str()!=Some(cfg.base_url.as_str()){return Err("此资料库已绑定另一台服务器，请使用独立资料库；未切换连接".into());}}
        Ok(())
    }
    async fn candidate_snapshot(&self,cfg:&ConnectionConfig)->Result<Snapshot>{
        let (code,v)=self.http_at(cfg,reqwest::Method::GET,"/api/sync/health",None).await?;
        if code!=200||v["ok"]!=true{return Err(if code==401||code==403{"设备令牌无效或无权访问".into()}else{"服务器连接检查失败".into()});}
        let (code,v)=self.http_at(cfg,reqwest::Method::GET,"/api/sync/snapshot",None).await?;
        if code!=200{return Err(if code==401||code==403{"设备令牌无效或无权访问".into()}else{format!("读取服务器资料失败（HTTP {code}）")});}
        validate_snapshot(v)
    }
    pub async fn preview_server(&self,cfg:&ConnectionConfig)->Result<Value>{
        let _serial=self.network.lock().await;
        self.check_server_origin(cfg)?;
        if self.server_transfer_active()?{return Err("上次首次同步尚待核对，请先恢复该任务".into());}
        if self.operations()?.iter().any(|o|!matches!(o.status.as_str(),"committed"|"discarded"|"replaced")){return Err("请先处理待同步任务或草稿，再设置首次同步".into());}
        let local=if self.is_local()?{self.local_snapshot()?}else{self.cached()?.ok_or("请先恢复原资料库连接")?};
        let remote=self.candidate_snapshot(cfg).await?;
        if !self.is_local()? && remote.expected().revision<local.expected().revision{return Err("服务器版本低于本机缓存，已停止连接以避免回退".into());}
        let mut conflicts=Vec::new();let mut total=0;
        for t in TABLES {for row in local.data[t].as_array().unwrap(){if let Some(old)=remote.data[t].as_array().unwrap().iter().find(|r|r["id"]==row["id"]){if stable(old)!=stable(row){total+=1;if conflicts.len()<100{conflicts.push(json!({"table":t,"id":row["id"],"title":row["title"].as_str().or(row["name"].as_str()).unwrap_or("关联")}));}}}}}
        let v=json!({"id":uuid::Uuid::new_v4().simple().to_string(),"baseUrl":cfg.base_url,"local":local.expected(),"remote":remote.expected(),"localCounts":counts(&local),"remoteCounts":counts(&remote),"conflicts":conflicts,"conflictCount":total,"uploadLocal":self.is_local()?,"expiresAt":chrono::Utc::now().timestamp()+600});
        self.set_value("server-preview",&v)?;Ok(v)
    }
    pub async fn connect_server(&self,cfg:ConnectionConfig,preview_id:&str,resolution:&str,credential_id:&str)->Result<Value>{
        let _serial=self.network.lock().await;
        self.check_server_origin(&cfg)?;
        if credential_id.len()!=32||!credential_id.bytes().all(|b|b.is_ascii_hexdigit()){return Err("连接确认标识无效".into());}
        if self.server_transfer_active()?{return Err("已有首次同步任务，请核对回执；未创建第二次导入".into());}
        if !matches!(resolution,"keep"|"replace"){return Err("请选择同 ID 冲突时保留哪一侧内容".into());}
        let preview=self.get_value("server-preview")?.ok_or("请先检查服务器并预览资料")?;
        if preview["id"]!=preview_id || preview["baseUrl"]!=cfg.base_url || preview["expiresAt"].as_i64().unwrap_or(0)<chrono::Utc::now().timestamp(){return Err("预览已失效，请重新检查服务器".into());}
        let local=if self.is_local()?{self.local_snapshot()?}else{self.cached()?.ok_or("本机缓存不存在")?};
        if serde_json::to_value(local.expected()).unwrap()!=preview["local"]{return Err("本机资料在预览后有变化，请重新预览；未上传".into());}
        if self.operations()?.iter().any(|o|!matches!(o.status.as_str(),"committed"|"discarded"|"replaced")){return Err("预览后产生了待处理任务，请先核对；未上传".into());}
        let remote=self.candidate_snapshot(&cfg).await?;
        if serde_json::to_value(remote.expected()).unwrap()!=preview["remote"]{return Err("服务器资料在预览后有变化，请重新预览；未上传".into());}
        if !self.is_local()? {self.finish_server(&cfg,&remote,None,Some(credential_id))?;return self.server_transfer_status();}
        let id=uuid::Uuid::new_v4().simple().to_string();let backup_key=format!("server-backup-{id}");
        // The original local snapshot and exact import identity are committed before any POST.
        let command=json!({"type":"import","dump":local.data,"resolution":resolution,"migration":true});
        let transfer=json!({"id":id,"previewId":preview_id,"credentialId":credential_id,"baseUrl":cfg.base_url,"status":"pending","backupKey":backup_key,"expected":remote.expected(),"command":command});
        {
            let mut db=self.db.lock().unwrap();let tx=db.transaction().map_err(|_|"首次同步事务失败")?;
            for(k,v)in [(&backup_key,serde_json::to_value(&local).unwrap()),(&"server-transfer".to_string(),transfer.clone())]{tx.execute("INSERT INTO kv VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",params![k,v.to_string()]).map_err(|_|"首次同步未能落盘，已停止上传")?;}
            tx.commit().map_err(|_|"首次同步记录提交失败")?;
        }
        self.resume_server_locked(cfg).await
    }
    pub async fn resume_server(&self,cfg:ConnectionConfig)->Result<Value>{let _serial=self.network.lock().await;self.resume_server_locked(cfg).await}
    async fn resume_server_locked(&self,cfg:ConnectionConfig)->Result<Value>{
        self.check_server_origin(&cfg)?;
        let mut v=self.get_value("server-transfer")?.ok_or("没有可恢复的首次同步任务")?;
        if v["baseUrl"]!=cfg.base_url{return Err("任务服务器与凭据不匹配，未发送".into());}
        if v["status"]=="complete" {return self.server_transfer_status();}
        if !pending(&v){return Err(v["error"].as_str().unwrap_or("该任务已停止，请重新预览").into());}
        let expected:Expected=serde_json::from_value(v["expected"].clone()).map_err(|_|"首次同步版本损坏")?;
        let fp=fingerprint(&expected,&v["command"]);let id=v["id"].as_str().ok_or("首次同步标识损坏")?.to_string();
        if v["status"]=="unknown" {
            let route=format!("/api/sync/receipt?id={id}&fingerprint={fp}");
            let (code,r)=self.http_at(&cfg,reqwest::Method::GET,&route,None).await?;
            if code==200&&r["status"]=="committed"{let snap=self.candidate_snapshot(&cfg).await?;self.finish_server(&cfg,&snap,Some(&mut v),None)?;return self.server_transfer_status();}
            if code!=404{return Err("首次同步回执尚未确认，继续保留本机资料".into());}
        }
        v["status"]=json!("unknown");self.set_value("server-transfer",&v)?;
        let body=json!({"requestId":id,"fingerprint":fp,"expected":expected,"command":v["command"]});
        let response=self.http_at(&cfg,reqwest::Method::POST,"/api/sync/command",Some(&body)).await;
        let (code,r)=match response{Ok(r)=>r,Err(e)=>{v["error"]=json!(e);self.set_value("server-transfer",&v)?;return Err("首次同步结果待核对，原文和任务已保存；请恢复连接核对回执".into());}};
        if code==200 {let snap=validate_snapshot(r["snapshot"].clone())?;self.finish_server(&cfg,&snap,Some(&mut v),None)?;return self.server_transfer_status();}
        if code==409 { // A rejection or a lost-response duplicate; query before classifying.
            let (rc,receipt)=self.http_at(&cfg,reqwest::Method::GET,&format!("/api/sync/receipt?id={id}&fingerprint={fp}"),None).await?;
            if rc==200&&receipt["status"]=="committed"{let snap=self.candidate_snapshot(&cfg).await?;self.finish_server(&cfg,&snap,Some(&mut v),None)?;return self.server_transfer_status();}
            if rc!=404{return Err("首次同步结果尚未确认，未重复导入".into());}
        }
        if matches!(code,400|409|413|422){v["status"]=json!("rejected");v["error"]=json!(format!("服务器未接受合并（HTTP {code}），本机未切换；请重新预览"));self.set_value("server-transfer",&v)?;return Err(v["error"].as_str().unwrap().into());}
        Err(format!("服务器暂未确认首次同步（HTTP {code}），等待核对回执"))
    }
    fn finish_server(&self,cfg:&ConnectionConfig,snap:&Snapshot,transfer:Option<&mut Value>,credential_id:Option<&str>)->Result<()> {
        let mut values=vec![("snapshot",serde_json::to_value(snap).unwrap()),("workspace-origin",json!(cfg.base_url)),("connection-public",json!({"baseUrl":cfg.base_url})),("sync-last-success",json!(chrono::Utc::now().to_rfc3339()))];
        if let Some(v)=transfer{if snap.expected().revision<=v["expected"]["revision"].as_u64().ok_or("首次同步版本无效")?{return Err("服务器快照落后于已确认的提交，保留原资料并等待核对".into());}v["status"]=json!("complete");v["error"]=Value::Null;values.push(("server-connection-credential",v["credentialId"].clone()));values.push(("server-transfer",v.clone()));}
        if let Some(id)=credential_id{values.push(("server-connection-credential",json!(id)));}
        let mut db=self.db.lock().unwrap();let tx=db.transaction().map_err(|_|"连接保存失败")?;
        for(k,v)in values {tx.execute("INSERT INTO kv VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",params![k,v.to_string()]).map_err(|_|"连接状态保存失败")?;}tx.commit().map_err(|_|"连接状态提交失败")?;drop(db);
        *self.config.write().unwrap()=Some(cfg.clone());let mut state=self.connectivity.lock().unwrap();state.online=true;state.error.clear();Ok(())
    }
}
