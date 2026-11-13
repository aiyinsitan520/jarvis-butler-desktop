//! JSON-lines integration driver. Test credentials are accepted on stdin and never echoed.
use jarvis_workspace::{WorkspaceStore,ConnectionConfig,Expected,ai::ModelConfig};
use serde_json::{Value,json};
use std::{io::{BufRead,Write},path::PathBuf};
#[tokio::main]async fn main(){
    let path=std::env::args().nth(1).map(PathBuf::from).expect("isolated SQLite path required");
    let s=WorkspaceStore::open(&path).expect("open isolated store");
    for line in std::io::stdin().lock().lines(){
        let Ok(line)=line else{break;};let input:Value=match serde_json::from_str(&line){Ok(v)=>v,Err(_)=>{println!("{{\"error\":\"invalid input\"}}");continue;}};
        let result:Result<Value,String>=async{Ok(match input["action"].as_str().unwrap_or(""){
            "configure"=>{s.configure(Some(ConnectionConfig::checked(input["baseUrl"].as_str().unwrap_or(""),input["token"].as_str().unwrap_or(""))?))?;json!({"ok":true})},
            "previewServer"=>s.preview_server(&ConnectionConfig::checked(input["baseUrl"].as_str().unwrap_or(""),input["token"].as_str().unwrap_or(""))?).await?,
            "connectServer"=>s.connect_server(ConnectionConfig::checked(input["baseUrl"].as_str().unwrap_or(""),input["token"].as_str().unwrap_or(""))?,input["previewId"].as_str().unwrap_or(""),input["resolution"].as_str().unwrap_or("keep"),input["credentialId"].as_str().unwrap_or(&uuid::Uuid::new_v4().simple().to_string())).await?,
            "resumeServer"=>s.resume_server(ConnectionConfig::checked(input["baseUrl"].as_str().unwrap_or(""),input["token"].as_str().unwrap_or(""))?).await?,
            "serverStatus"=>s.server_transfer_status()?,
            "refresh"=>serde_json::to_value(s.refresh().await?).unwrap(),
            "view"=>serde_json::to_value(s.view()?).unwrap(),
            "flush"=>{s.flush().await?;json!({"ok":true})},
            "submit"=>{let expected:Option<Expected>=serde_json::from_value(input["expected"].clone()).map_err(|_|"expected invalid")?;serde_json::to_value(s.submit(input["command"].clone(),expected).await?).unwrap()},
            "retry"=>serde_json::to_value(s.retry(input["id"].as_str().unwrap_or("")).await?).unwrap(),
            "operations"=>serde_json::to_value(s.operations()?).unwrap(),
            "capture"=>serde_json::to_value(s.capture(input["key"].as_str(),input["raw"].as_str().unwrap_or(""),"integration",vec![])?).unwrap(),
            "process"=>{let model:Option<ModelConfig>=serde_json::from_value(input["model"].clone()).map_err(|_|"model invalid")?;serde_json::to_value(s.process_capture(input["id"].as_str().unwrap_or(""),model.as_ref(),input["retry"].as_bool().unwrap_or(false)).await?).unwrap()},
            "setValue"=>{s.set_value(input["key"].as_str().ok_or("key required")?,&input["value"])?;json!(true)},
            "vaultScan"=>s.vault_scan(&path.parent().unwrap().join("library")).await?,
            "getValue"=>s.get_value(input["key"].as_str().ok_or("key required")?)?.unwrap_or(Value::Null),
            "compareValue"=>{s.compare_set_value(input["key"].as_str().ok_or("key required")?,&input["value"],input["revision"].as_u64().unwrap_or(0))?;json!(true)},
            "captures"=>json!(s.captures()?),_=>return Err("unsupported action".into())})}.await;
        println!("{}",match result{Ok(value)=>json!({"value":value}),Err(error)=>json!({"error":error})});let _=std::io::stdout().flush();
    }
}
