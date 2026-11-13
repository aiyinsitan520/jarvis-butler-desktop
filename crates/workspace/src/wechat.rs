//! iLink protocol client based on Tencent's published backend protocol (3.x).
//! All endpoint errors omit response bodies, URLs and authentication values.
use crate::Result;
use aes::{Aes128,cipher::{BlockDecrypt,KeyInit,generic_array::GenericArray}};
use base64::{Engine,engine::general_purpose::STANDARD};
use serde::{Deserialize,Serialize};
use serde_json::{json,Value};
use std::{time::Duration,path::Path};
pub const API:&str="https://ilinkai.weixin.qq.com";
const VERSION:&str="3.0.0/jarvis-desktop-0.3.0";
#[derive(Clone,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Account{pub account_id:String,pub bot_token:String,pub base_url:String,pub owner_id:String}
#[derive(Clone)]
pub struct Login{pub qrcode:String,pub display:String,pub base_url:String,pub started:i64,pub verify_code:Option<String>}
#[derive(Clone)]
pub struct Client{http:reqwest::Client}
pub fn trusted_api(raw:&str)->Result<String>{
    let u=reqwest::Url::parse(raw).map_err(|_|"微信网关地址无效")?;let h=u.host_str().unwrap_or("");
    if u.scheme()!="https"||!(h=="ilinkai.weixin.qq.com"||h.ends_with(".ilinkai.weixin.qq.com"))||!u.username().is_empty()||u.password().is_some()||u.port().is_some()||u.query().is_some()||u.fragment().is_some()||u.path()!="/"{return Err("微信网关不在允许范围".into());}Ok(raw.trim_end_matches('/').into())
}
fn api_ok(v:&Value)->Result<()>{
    for field in ["ret","errcode"]{if !v[field].is_null(){let n=v[field].as_i64().ok_or("微信状态格式无效")?;if n==-14{return Err("微信认证失效，请暂停通道并重新扫码".into());}if n!=0{return Err(format!("微信接口拒绝请求（代码 {n}）"));}}}Ok(())
}
impl Client{
    pub fn new()->Result<Self>{Ok(Self{http:reqwest::Client::builder().timeout(Duration::from_secs(40)).redirect(reqwest::redirect::Policy::none()).build().map_err(|_|"微信网络初始化失败")?})}
    async fn request(&self,base:&str,endpoint:&str,body:Option<Value>,token:Option<&str>)->Result<Value>{
        let base=trusted_api(base)?;let url=format!("{base}/ilink/bot/{endpoint}");
        let mut r=if let Some(b)=body{self.http.post(url).header("AuthorizationType","ilink_bot_token").header("X-WECHAT-UIN",STANDARD.encode(u32::from_le_bytes(uuid::Uuid::new_v4().as_bytes()[..4].try_into().unwrap()).to_string())).json(&b)}else{self.http.get(url)};
        r=r.header("iLink-App-Id","bot").header("iLink-App-ClientVersion","196608");if let Some(t)=token{r=r.bearer_auth(t);}
        let mut response=r.send().await.map_err(|_|"微信请求超时或连接中断")?;
        if response.status().as_u16()==401{return Err("微信认证失效，请重新扫码".into());}
        if !response.status().is_success(){return Err(format!("微信服务错误（HTTP {}）",response.status().as_u16()));}
        let mut b=Vec::new();while let Some(c)=response.chunk().await.map_err(|_|"微信响应中断")?{if b.len()+c.len()>2*1024*1024{return Err("微信响应超过限制".into());}b.extend(c);}
        let v:Value=serde_json::from_slice(&b).map_err(|_|"微信响应格式无效")?;if !v.is_object(){return Err("微信响应格式无效".into());}api_ok(&v)?;Ok(v)
    }
    pub async fn start_login(&self)->Result<Login>{
        let v=self.request(API,"get_bot_qrcode?bot_type=3",Some(json!({"local_token_list":[]})),None).await?;
        Ok(Login{qrcode:v["qrcode"].as_str().filter(|s|!s.is_empty()).ok_or("未收到绑定二维码")?.into(),display:v["qrcode_img_content"].as_str().filter(|s|!s.is_empty()).ok_or("未收到二维码内容")?.into(),base_url:API.into(),started:chrono::Utc::now().timestamp(),verify_code:None})
    }
    pub async fn poll_login(&self,login:&mut Login)->Result<(String,Option<Account>)>{
        if chrono::Utc::now().timestamp()-login.started>300{return Ok(("expired".into(),None));}
        let mut qs=reqwest::Url::parse("https://example.invalid/").unwrap();{let mut q=qs.query_pairs_mut();q.append_pair("qrcode",&login.qrcode);if let Some(pin)=&login.verify_code{q.append_pair("verify_code",pin);}}
        let v=self.request(&login.base_url,&format!("get_qrcode_status?{}",qs.query().unwrap()),None,None).await?;
        let status=v["status"].as_str().ok_or("微信登录状态无效")?;
        if status=="scaned"{login.verify_code=None;}
        if status=="scaned_but_redirect"{let h=v["redirect_host"].as_str().ok_or("微信网关重定向无效")?;login.base_url=trusted_api(&format!("https://{h}"))?;}
        if status=="confirmed"{
            let account=Account{account_id:v["ilink_bot_id"].as_str().filter(|s|!s.is_empty()).ok_or("微信绑定缺少账号")?.into(),bot_token:v["bot_token"].as_str().filter(|s|!s.is_empty()).ok_or("微信绑定缺少凭据")?.into(),base_url:trusted_api(v["baseurl"].as_str().unwrap_or(&login.base_url))?,owner_id:v["ilink_user_id"].as_str().filter(|s|!s.is_empty()).ok_or("微信未返回本人标识，无法安全配对，请重新扫码")?.into()};
            return Ok((status.into(),Some(account)));
        }Ok((status.into(),None))
    }
    pub async fn updates(&self,a:&Account,cursor:&str)->Result<Value>{
        let v=self.request(&a.base_url,"getupdates",Some(json!({"get_updates_buf":cursor,"base_info":{"channel_version":VERSION,"bot_agent":"JarvisDesktop/0.3.0"}})),Some(&a.bot_token)).await?;
        if v.get("msgs").is_some_and(|v|!v.is_array())||v.get("get_updates_buf").is_some_and(|v|!v.is_string()){return Err("微信消息或游标无效".into());}Ok(v)
    }
    pub async fn send(&self,a:&Account,to:&str,context:&str,text:&str,client_id:&str)->Result<()>{
        if context.is_empty(){return Err("缺少对应来信上下文，未发送微信消息".into());}
        self.request(&a.base_url,"sendmessage",Some(json!({"msg":{"from_user_id":"","to_user_id":to,"client_id":client_id,"message_type":2,"message_state":2,"context_token":context,"item_list":[{"type":1,"text_item":{"text":text.chars().take(1600).collect::<String>()}}]},"base_info":{"channel_version":VERSION,"bot_agent":"JarvisDesktop/0.3.0"}})),Some(&a.bot_token)).await?;Ok(())
    }
    pub async fn download(&self,item:&Value,directory:&Path,key:&str,index:usize)->Result<String>{
        let ty=item["type"].as_u64().ok_or("附件类型无效")?;
        let part=match ty{2=>&item["image_item"],4=>&item["file_item"],_=>return Err("首版仅保存图片和文件，其他媒体暂不支持".into())};
        let media=&part["media"];
        let url=if let Some(s)=media["full_url"].as_str(){reqwest::Url::parse(s).map_err(|_|"附件地址无效")?}else{let mut u=reqwest::Url::parse("https://novac2c.cdn.weixin.qq.com/c2c/download").unwrap();u.query_pairs_mut().append_pair("encrypted_query_param",media["encrypt_query_param"].as_str().ok_or("附件缺少下载参数")?);u};
        let h=url.host_str().unwrap_or("");if url.scheme()!="https"||!(h=="novac2c.cdn.weixin.qq.com"||h.ends_with(".cdn.weixin.qq.com"))||url.port().is_some()||!url.username().is_empty()||url.password().is_some(){return Err("附件 CDN 地址不在允许范围".into());}
        let limit=if ty==2{10*1024*1024}else{30*1024*1024};
        let mut r=self.http.get(url).send().await.map_err(|_|"附件下载失败")?;if !r.status().is_success(){return Err("附件下载未成功，未自动推进游标".into());}
        let mut bytes=Vec::new();while let Some(chunk)=r.chunk().await.map_err(|_|"附件下载中断")?{if bytes.len()+chunk.len()>limit+16{return Err("附件超过大小限制".into());}bytes.extend(chunk);}
        let key_bytes=if let Some(hex)=part["aeskey"].as_str(){Some(decode_hex(hex)?)}else if let Some(b64)=media["aes_key"].as_str(){let b=STANDARD.decode(b64).map_err(|_|"附件密钥编码无效")?;Some(if b.len()==32{decode_hex(std::str::from_utf8(&b).map_err(|_|"附件密钥无效")?)?}else{b})}else{None};
        if let Some(k)=key_bytes{bytes=decrypt(&bytes,&k)?;}else if ty!=2{return Err("文件附件缺少解密密钥".into());}
        if bytes.len()>limit{return Err("附件超过大小限制".into());}
        std::fs::create_dir_all(directory).map_err(|_|"无法创建附件目录")?;
        let ext=if ty==2{if bytes.starts_with(b"\x89PNG\r\n\x1a\n"){"png"}else if bytes.starts_with(b"\xff\xd8\xff"){"jpg"}else if bytes.starts_with(b"GIF8"){"gif"}else if bytes.starts_with(b"RIFF")&&bytes.get(8..12)==Some(b"WEBP"){"webp"}else{"bin"}}else{
            let original=part["file_name"].as_str().unwrap_or("");let ext=original.rsplit('.').next().unwrap_or("");
            if ["pdf","txt","md","docx","xlsx","pptx","zip","csv","json","png","jpg","jpeg","gif","webp"].contains(&ext){ext}else{"file"}
        };let name=format!("{}-{index}.{ext}",key.chars().filter(|c|c.is_ascii_alphanumeric()).take(64).collect::<String>());
        let dest=directory.join(&name);
        if let Ok(existing)=std::fs::symlink_metadata(&dest){if !existing.is_file()||existing.file_type().is_symlink(){return Err("附件路径类型异常".into());}if std::fs::read(&dest).map_err(|_|"附件读取失败")?!=bytes{return Err("同一消息附件内容改变".into());}return Ok(name);}
        use std::io::Write;let mut file=std::fs::OpenOptions::new().write(true).create_new(true).open(&dest).map_err(|_|"附件保存失败")?;file.write_all(&bytes).and_then(|_|file.sync_all()).map_err(|_|"附件落盘失败")?;Ok(name)
    }
}
fn decode_hex(s:&str)->Result<Vec<u8>>{if s.len()!=32||!s.bytes().all(|b|b.is_ascii_hexdigit()){return Err("附件密钥长度无效".into());}(0..16).map(|i|u8::from_str_radix(&s[i*2..i*2+2],16).map_err(|_|"附件密钥无效".into())).collect()}
fn decrypt(bytes:&[u8],key:&[u8])->Result<Vec<u8>>{
    if bytes.is_empty()||bytes.len()%16!=0||key.len()!=16{return Err("附件密文长度无效".into());}let cipher=Aes128::new_from_slice(key).map_err(|_|"附件密钥无效")?;let mut out=bytes.to_vec();for b in out.chunks_exact_mut(16){cipher.decrypt_block(GenericArray::from_mut_slice(b));}let pad=*out.last().unwrap()as usize;if pad==0||pad>16||!out[out.len()-pad..].iter().all(|n|*n as usize==pad){return Err("附件解密校验失败".into());}out.truncate(out.len()-pad);Ok(out)
}
pub fn incoming_key(account:&str,message:&Value)->String{
    use sha2::{Sha256,Digest};let id=message.get("message_id").or_else(||message.get("client_id")).cloned().unwrap_or_else(||json!(uuid::Uuid::new_v4().to_string()));format!("w{:x}",Sha256::digest(format!("{account}:{}:{id}",message["from_user_id"].as_str().unwrap_or("")).as_bytes()))
}
pub fn text(message:&Value)->String{message["item_list"].as_array().into_iter().flatten().filter(|i|i["type"]==1).filter_map(|i|i["text_item"]["text"].as_str()).collect::<Vec<_>>().join("\n")}
#[cfg(test)]mod tests{use super::*;#[test]fn reject_redirect_and_media_key_abuse(){assert!(trusted_api("https://ilinkai.weixin.qq.com").is_ok());for u in ["https://ilinkai.weixin.qq.com.evil.test","http://ilinkai.weixin.qq.com","https://user@ilinkai.weixin.qq.com","https://ilinkai.weixin.qq.com:444"]{assert!(trusted_api(u).is_err());}assert!(decode_hex("bad").is_err());assert!(decrypt(&[0;16],&[0;16]).is_err());}#[test]fn authentication_code_is_not_network_failure(){assert!(api_ok(&json!({"errcode":-14})).unwrap_err().contains("认证失效"));assert!(api_ok(&json!({"ret":[]})).is_err());}#[test]fn message_identity_is_scoped(){let m=json!({"message_id":4,"from_user_id":"user"});assert_eq!(incoming_key("a",&m),incoming_key("a",&m));assert_ne!(incoming_key("a",&m),incoming_key("b",&m));}}
