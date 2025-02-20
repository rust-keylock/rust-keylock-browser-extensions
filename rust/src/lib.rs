use spake2::{Ed25519Group, Identity, Password, Spake2};
use wasm_bindgen::prelude::*;

const RKL_LIB_BASE: &str = "http://127.0.0.1:9876/";
const RKL_PAKE: &str = "http://127.0.0.1:9876/pake";

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
    // let body = reqwest::get()
    //     .await
    //     .map_err(|e| format!("{e}"))?
    //     .text()
    //     .await
    //     .map_err(|e| format!("{e}"))?;
    let key = execute_pake("password").await?;
    Ok("".to_string())
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
