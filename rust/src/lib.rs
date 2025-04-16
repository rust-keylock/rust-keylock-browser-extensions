use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose, Engine};
use std::{str::from_utf8, sync::Mutex};

use lazy_static::lazy_static;
use spake2::{Ed25519Group, Identity, Password, Spake2};
use wasm_bindgen::prelude::*;

const RKL_GET_ALL: &str = "http://127.0.0.1:9876/entries";
const RKL_GET_DECRYPTED: &str = "http://127.0.0.1:9876/decrypted";
const RKL_PAKE: &str = "http://127.0.0.1:9876/pake";
const TICKET_HEADER: &str = "ticket";

lazy_static! {
    static ref SESSION_KEY: Mutex<Option<Vec<u8>>> = Mutex::new(None);
    static ref TICKET: Mutex<usize> = Mutex::new(0);
}

fn get_session_key() -> Result<Vec<u8>, String> {
    let session_key_opt = SESSION_KEY.lock().map_err(|e| format!("{e}"))?.clone();
    if let Some(session_key) = session_key_opt {
        Ok(session_key)
    } else {
        Err("Session key is not established yet".to_string())
    }
}

fn get_ticket() -> Result<String, String> {
    let mut ticket = TICKET.lock().map_err(|e| format!("{e}"))?;
    *ticket += 1;
    let ticket_string = ticket.to_string();
    let ticket_str_bytes = ticket_string.as_bytes();
    let base64_encrypted = encrypt_to_base_64(&get_session_key()?, &ticket_str_bytes)?;
    return Ok(base64_encrypted);
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
pub async fn connect_to_rkl(token: String) -> Result<String, String> {
    if let Err(_) = get_session_key() {
        let (key, ticket) = execute_pake(&token).await?;
        let mut session_key_opt = SESSION_KEY.lock().map_err(|e| format!("{e}"))?;
        *session_key_opt = Some(key);
        let mut tkt = TICKET.lock().map_err(|e| format!("{e}"))?;
        *tkt = ticket;
    } else {
        log("PAKE is already executed");
    }
    Ok("OK".to_string())
}

#[wasm_bindgen]
pub async fn reset_pake() -> Result<String, String> {
    let mut session_key_opt = SESSION_KEY.lock().map_err(|e| format!("{e}"))?;
    *session_key_opt = None;
    let mut tkt = TICKET.lock().map_err(|e| format!("{e}"))?;
    *tkt = 0;

    Ok("OK".to_string())
}

#[wasm_bindgen]
pub async fn get_all() -> Result<String, String> {
    log("Getting all entries");

    let client = reqwest::Client::new();

    let bytes = client
        .get(RKL_GET_ALL)
        .header(TICKET_HEADER, get_ticket()?)
        .send()
        .await
        .map_err(|e| format!("{e}"))?
        .bytes()
        .await
        .map_err(|e| format!("{e}"))?;

    log("Retrieved bytes");

    let entries_res = get_session_key()
        .and_then(|session_key| {
            log("Retrieved session key");
            decrypt(&session_key, &bytes)
        })
        .and_then(|decrypted_bytes| {
            log("Decrypted bytes");
            match from_utf8(&decrypted_bytes) {
                Ok(utf8_str) => {
                    log("Transformed to UTF-8");
                    Ok(utf8_str.to_string())
                }
                Err(error) => Err(error.to_string()),
            }
        });

    if let Err(ref error) = entries_res {
        log(&format!("Error in getall: {error}"));
    }

    entries_res
}

#[wasm_bindgen]
pub async fn get_filtered(filter: String) -> Result<String, String> {
    log(&format!("Getting entries using filter: {filter}"));

    let client = reqwest::Client::new();
    let target = format!("{RKL_GET_ALL}?filter={filter}");

    let bytes = client
        .get(target)
        .header(TICKET_HEADER, get_ticket()?)
        .send()
        .await
        .map_err(|e| format!("{e}"))?
        .bytes()
        .await
        .map_err(|e| format!("{e}"))?;

    let decrypted_bytes = decrypt(&get_session_key()?, &bytes)?;
    log("Retrieved entries");

    Ok(from_utf8(&decrypted_bytes)
        .map_err(|e| format!("{e}"))?
        .to_string())
}

#[wasm_bindgen]
pub async fn get_decrypted(name: String) -> Result<String, String> {
    log(&format!("Getting decrypted with name: {name}"));

    let client = reqwest::Client::new();
    let target = format!("{RKL_GET_DECRYPTED}/{name}");

    let bytes = client
        .get(target)
        .header(TICKET_HEADER, get_ticket()?)
        .send()
        .await
        .map_err(|e| format!("{e}"))?
        .bytes()
        .await
        .map_err(|e| format!("{e}"))?;

    let decrypted_bytes = decrypt(&get_session_key()?, &bytes)?;
    log("Retrieved entries...d");

    Ok(from_utf8(&decrypted_bytes)
        .map_err(|e| format!("{e}"))?
        .to_string())
}

async fn execute_pake(password: &str) -> Result<(Vec<u8>, usize), String> {
    log("Executing PAKE");
    let (s1, outbound_msg) = Spake2::<Ed25519Group>::start_a(
        &Password::new(password.as_bytes()),
        &Identity::new(b"rust-keylock-browser-extension"),
        &Identity::new(b"rust-keylock-lib"),
    );
    log("Generated outbound bytestring");

    let client = reqwest::Client::new();

    let response = client
        .post(RKL_PAKE)
        .body(outbound_msg)
        .send()
        .await
        .map_err(|e| format!("{e}"))?;

    log("Got PAKE response");

    let encrypted_ticket_opt = response
        .headers()
        .get(TICKET_HEADER)
        .map(|header_value| header_value.to_str())
        .map(|to_str_result| to_str_result.unwrap_or("0").to_string());

    log("Got ticket");

    let inbound_bytes = response.bytes().await.map_err(|e| format!("{e}"))?;

    log("Got inbound bytestring");

    let key = s1.finish(&inbound_bytes).unwrap();
    let ticket = encrypted_ticket_opt
        .map(|encrypted_ticket| decrypt_base_64(&key, &encrypted_ticket))
        .map(|res| String::from_utf8(res.unwrap_or_default()))
        .map(|received_ticket| {
            received_ticket
                .unwrap_or_default()
                .parse::<usize>()
                .unwrap_or(0)
        })
        .unwrap_or(0);

    log("Key generated and received ticket");
    Ok((key, ticket))
}

fn encrypt_to_base_64(key: &[u8], data: &[u8]) -> Result<String, String> {
    let key: &Key<Aes256Gcm> = key.into();
    let cipher = Aes256Gcm::new(&key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher.encrypt(&nonce, data).map_err(|e| format!("{e}"))?;
    let to_ret = [nonce.to_vec(), ciphertext].concat();
    Ok(general_purpose::STANDARD.encode(&to_ret))
}

fn decrypt(key: &[u8], product: &[u8]) -> Result<Vec<u8>, String> {
    let key: &Key<Aes256Gcm> = key.into();
    let cipher = Aes256Gcm::new(&key);
    if product.len() > 12 {
        let (nonce, data) = product.split_at(12);
        let plain = cipher
            .decrypt(Nonce::from_slice(nonce), data)
            .map_err(|e| format!("{e}"))?;
        Ok(plain)
    } else {
        Err(format!("Unexpected bytes to decrypt."))
    }
}

fn decrypt_base_64(key: &[u8], base64_string: &str) -> Result<Vec<u8>, String> {
    let encrypted_bytes = general_purpose::STANDARD
        .decode(&base64_string)
        .map_err(|error| error.to_string())?;
    decrypt(key, &encrypted_bytes)
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
