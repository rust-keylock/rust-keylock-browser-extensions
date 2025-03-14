use std::{str::from_utf8, sync::Mutex};

use lazy_static::lazy_static;
use spake2::{Ed25519Group, Identity, Password, Spake2};
use wasm_bindgen::prelude::*;

const RKL_GET_ALL: &str = "http://127.0.0.1:9876/entries";
const RKL_GET_DECRYPTED: &str = "http://127.0.0.1:9876/decrypted";
const RKL_PAKE: &str = "http://127.0.0.1:9876/pake";

lazy_static! {
    static ref SESSION_KEY: Mutex<Option<Vec<u8>>> = Mutex::new(None);
}

fn get_session_key() -> Result<Vec<u8>, String> {
    let session_key_opt = SESSION_KEY.lock().map_err(|e| format!("{e}"))?.clone();
    if let Some(session_key) = session_key_opt {
        Ok(session_key)
    } else {
        Err("Session key is not established yet".to_string())
    }
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Called when the Wasm module is instantiated
#[wasm_bindgen(start)]
fn main() -> Result<(), JsValue> {
    // Use `web_sys`'s global `window` function to get a handle on the global window object.
    let window = web_sys::window().expect("no global `window` exists");
    let document = window.document().expect("should have a document on window");
    let _body = document.body().expect("document should have a body");

    // // Manufacture the element we're gonna append
    // let val = document.create_element("p")?;
    // val.set_inner_html("Hello from Rust!");

    // body.append_child(&val)?;

    Ok(())
}

#[wasm_bindgen]
pub async fn connect_to_rkl() -> Result<String, String> {
    let key = execute_pake("password").await?;
    let mut session_key_opt = SESSION_KEY.lock().map_err(|e| format!("{e}"))?;
    *session_key_opt = Some(key);
    Ok("OK".to_string())
}

#[wasm_bindgen]
pub async fn get_all() -> Result<String, String> {
    log("Getting all entries");

    let client = reqwest::Client::new();

    let bytes = client
        .get(RKL_GET_ALL)
        .send()
        .await
        .map_err(|e| format!("{e}"))?
        .bytes()
        .await
        .map_err(|e| format!("{e}"))?;

    log("Retrieved entries");

    Ok(from_utf8(&bytes).map_err(|e| format!("{e}"))?.to_string())
}

#[wasm_bindgen]
pub async fn get_filtered(filter: String) -> Result<String, String> {
    log(&format!("Getting entries using filter: {filter}"));

    let client = reqwest::Client::new();
    let target = format!("{RKL_GET_ALL}?filter={filter}");

    let bytes = client
        .get(target)
        .send()
        .await
        .map_err(|e| format!("{e}"))?
        .bytes()
        .await
        .map_err(|e| format!("{e}"))?;

    log("Retrieved entries");

    Ok(from_utf8(&bytes).map_err(|e| format!("{e}"))?.to_string())
}

#[wasm_bindgen]
pub async fn get_decrypted(name: String) -> Result<String, String> {
    log(&format!("Getting decrypted with name: {name}"));

    let client = reqwest::Client::new();
    let target = format!("{RKL_GET_DECRYPTED}/{name}");

    let bytes = client
        .get(target)
        .send()
        .await
        .map_err(|e| format!("{e}"))?
        .bytes()
        .await
        .map_err(|e| format!("{e}"))?;

    log("Retrieved entries");

    Ok(from_utf8(&bytes).map_err(|e| format!("{e}"))?.to_string())
}

async fn execute_pake(password: &str) -> Result<Vec<u8>, String> {
    log("Executing PAKE");
    let (s1, outbound_msg) = Spake2::<Ed25519Group>::start_a(
        &Password::new(password.as_bytes()),
        &Identity::new(b"rust-keylock-browser-extension"),
        &Identity::new(b"rust-keylock-lib"),
    );
    log("Generated outbound bytestring");

    let client = reqwest::Client::new();

    let inbound_bytes = client
        .post(RKL_PAKE)
        .body(outbound_msg)
        .send()
        .await
        .map_err(|e| format!("{e}"))?
        .bytes()
        .await
        .map_err(|e| format!("{e}"))?;

    log("Retrieved inbound bytestring");

    let key = s1.finish(&inbound_bytes).unwrap();
    log("Key generated");
    log(&format!("key: {:x?}", key));
    Ok(key)
}

#[wasm_bindgen]
pub fn add(a: u32, b: u32) -> u32 {
    a + b
}

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet() {
    alert("Hello, rust-wasm!");
}
