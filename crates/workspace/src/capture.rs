use crate::{ai::{self,ModelConfig},WorkspaceStore,Result};
use serde::{Deserialize,Serialize};
use serde_json::{json,Value};
use sha2::{Sha256,Digest};

#[derive(Clone,Serialize,Deserialize,Debug)]
#[serde(rename_all="camelCase")]
pub struct Capture {pub id:String,pub raw:String,pub origin:String,pub created_at:i64,pub status:String,pub error:Option<String>,pub source_id:Option<String>,pub note_id:Option<String>,pub organized:Option<ai::Organized>,pub ai_started:bool,#[serde(default)]pub attachments:Vec<String>}
fn step_key(id:&str,step:&str)->String{format!("c{:x}",Sha256::digest(format!("{id}:{step}").as_bytes()))}
impl WorkspaceStore {
    pub fn capture(&self,key:Option<&str>,raw:&str,origin:&str,attachments:Vec<String>)->Result<Capture>{
        if raw.trim().is_empty()&&attachments.is_empty(){return Err("请先写下内容".into());}
        if raw.len()>512*1024||attachments.len()>5{return Err("原消息过大".into());}
        let id=key.map(str::to_owned).unwrap_or_else(||uuid::Uuid::new_v4().simple().to_string());
        if let Some(old)=self.captures()?.into_iter().find(|v|v["id"]==id){return serde_json::from_value(old).map_err(|_|"原消息状态损坏".into());}
        let c=Capture{id,raw:raw.into(),origin:origin.into(),created_at:chrono::Utc::now().timestamp_millis(),status:"saved_local".into(),error:None,source_id:None,note_id:None,organized:None,ai_started:false,attachments};
        self.save_capture(&c.id,&serde_json::to_value(&c).unwrap())?;Ok(c)
    }
    async fn capture_step(&self,id:&str,step:&str,command:Value)->Result<String>{
        let key=step_key(id,step);
        // Once queued, use the original payload even if notebook catalogue has since changed.
        let command=self.operations()?.into_iter().find(|o|o.id==key).map(|o|o.command).unwrap_or(command);
        let op=self.submit_once(&key,command,None).await?;
        if op.status=="committed"{op.result.ok_or("保存回执缺少记录标识".into())}else{Err(op.error.unwrap_or_else(||"原文已在本机保存，等待资料服务同步".into()))}
    }
    pub async fn ensure_inbox(&self)->Result<String>{
        if let Some(s)=self.cached()?{if let Some(n)=s.data["notebooks"].as_array().into_iter().flatten().find(|n|n["name"]=="收件箱"){return n["id"].as_str().map(str::to_owned).ok_or("收件箱标识无效".into());}}
        let local=self.get_value("desktop-instance")?.and_then(|v|v.as_str().map(str::to_owned)).unwrap_or_else(||uuid::Uuid::new_v4().simple().to_string());self.set_value("desktop-instance",&json!(local))?;
        self.capture_step(&local,"inbox",json!({"type":"createNotebook","data":{"name":"收件箱","desc":"快捷记录和微信原消息","tone":"amber"}})).await
    }
    pub async fn process_capture(&self,id:&str,model:Option<&ModelConfig>,explicit_retry:bool)->Result<Capture>{
        let mut c:Capture=serde_json::from_value(self.captures()?.into_iter().find(|v|v["id"]==id).ok_or("原消息不存在")?).map_err(|_|"原消息状态损坏")?;
        if c.status=="complete"{return Ok(c);}
        let result:Result<()>=async {
            self.refresh().await?;
            let inbox=self.ensure_inbox().await?;
            if c.source_id.is_none(){
                let title:String=c.raw.lines().next().unwrap_or("附件记录").chars().take(60).collect();
                let body=if c.attachments.is_empty(){c.raw.clone()}else{format!("{}\n\n{}",c.raw,c.attachments.iter().map(|f|format!("[附件仅桌面可用：{f}]")).collect::<Vec<_>>().join("\n"))};
                c.source_id=Some(self.capture_step(id,"source",json!({"type":"createSource","data":{"notebookId":inbox,"title":if title.is_empty(){"附件记录"}else{&title},"type":"file","content":body}})).await?);
                c.status="source_saved".into();self.save_capture(id,&serde_json::to_value(&c).unwrap())?;
            }
            let Some(model)=model.filter(|m|m.auto_organize||explicit_retry)else{c.status="waiting_ai".into();return Ok(());};
            if c.organized.is_none(){
                if c.ai_started&&!explicit_retry{return Err("上次 AI 请求已开始但结果未落盘，请核对后手动重试整理".into());}
                c.ai_started=true;c.status="organizing".into();self.save_capture(id,&serde_json::to_value(&c).unwrap())?;
                let snapshot=self.cached()?.ok_or("没有资料目录")?;
                c.organized=Some(ai::organize(model,&c.raw,&snapshot.data["notebooks"]).await?);
                c.ai_started=false;c.status="organized".into();self.save_capture(id,&serde_json::to_value(&c).unwrap())?;
            }
            let o=c.organized.as_ref().unwrap();
            let notebook=if o.notebook_id.is_empty(){&inbox}else{&o.notebook_id};
            if c.note_id.is_none(){
                c.note_id=Some(self.capture_step(id,"note",json!({"type":"createNote","data":{"notebookId":notebook,"title":o.title,"content":format!("{}\n\n---\n摘要：{}",o.body,o.summary)}})).await?);
                self.save_capture(id,&serde_json::to_value(&c).unwrap())?;
            }
            self.capture_step(id,"tags",json!({"type":"update","table":"notes","id":c.note_id,"data":{"tags":o.tags}})).await?;
            self.capture_step(id,"relation",json!({"type":"createRelation","data":{"fromType":"note","fromId":c.note_id,"toType":"source","toId":c.source_id,"relationType":"derived_from"}})).await?;
            c.status="complete".into();Ok(())
        }.await;
        c.error=result.err();if c.error.is_some(){c.status="needs_attention".into();}
        self.save_capture(id,&serde_json::to_value(&c).unwrap())?;Ok(c)
    }
}
#[cfg(test)]mod tests{use super::*;#[test]fn capture_is_durable_and_deduplicated(){let d=tempfile::tempdir().unwrap();let file=d.path().join("s.db");let s=WorkspaceStore::open(&file).unwrap();let a=s.capture(Some("incoming-1"),"原文","wechat",vec![]).unwrap();let b=s.capture(Some("incoming-1"),"原文","wechat",vec![]).unwrap();assert_eq!(a.id,b.id);drop(s);let s=WorkspaceStore::open(&file).unwrap();assert_eq!(s.captures().unwrap().len(),1);assert_eq!(s.captures().unwrap()[0]["raw"],"原文");}}
