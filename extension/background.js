import init, { add, connect_to_rkl } from './pkg/rust_keylock_browser_extension.js';

async function initializeRustKeylockWasm() {
  // First up we need to actually load the Wasm file, so we use the
  // default export to inform it where the Wasm file is located on the
  // server, and then we wait on the returned promise to wait for the
  // Wasm to be loaded.
  //
  // It may look like this: `await init('./pkg/without_a_bundler_bg.wasm');`,
  // but there is also a handy default inside `init` function, which uses
  // `import.meta` to locate the Wasm file relatively to js file.
  //
  // Note that instead of a string you can also pass in any of the
  // following things:
  //
  // * `WebAssembly.Module`
  //
  // * `ArrayBuffer`
  //
  // * `Response`
  //
  // * `Promise` which returns any of the above, e.g. `fetch("./path/to/wasm")`
  //
  // This gives you complete control over how the module is loaded
  // and compiled.
  //
  // Also note that the promise, when resolved, yields the Wasm module's
  // exports which is the same as importing the `*_bg` module in other
  // modes
  await init();

  // And afterwards we can use all the functionality defined in wasm.
}

async function do_connect_to_rkl() {
  const result = await connect_to_rkl();
  console.log("-------" + result);
}

initializeRustKeylockWasm();

// Callback reads runtime.lastError to prevent an unchecked error from being 
// logged when the extension attempt to register the already-registered menu 
// again. Menu registrations in event pages persist across extension restarts.
browser.contextMenus.create({
  id: "rust-keylock",
  title: "rust-keylock",
  contexts: ["editable", "password"],
},
  // See https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/#event-pages-and-backward-compatibility
  // for information on the purpose of this error capture.
  () => void browser.runtime.lastError,
);

browser.contextMenus.onClicked.addListener((info, tab) => handleOnClick(info, tab));

async function handleOnClick(info, tab) {
  if (info.menuItemId === "rust-keylock") {
    sendMessageToTab(tab);
  }
}


async function sendMessageToTab(tab) {
  await do_connect_to_rkl()
    .then((resp) => {
      console.debug(resp);
    })
    .catch(onError);

  const result = add(1, 2);
  console.log(`YO! 1 + 2 = ${result}`);
  browser.tabs
    .sendMessage(tab.id, "Yo " + result)
    .then((response) => {
      console.log("Message from the content script:");
      console.log(response.response);
    })
    .catch(onError);
}

function onError(error) {
  console.error(`Error: ${error}`);
}
