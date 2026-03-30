import init, { connect_to_rkl, get_all, get_decrypted, get_filtered, is_pake_executed, is_pake_valid, reset_pake } from './pkg/rust_keylock_browser_extension.js';

browser.runtime.onMessage.addListener(handleMessage);

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

async function getSavedPassphrase() {
  try {
    let creds = await browser.storage.local.get();
    let passphrase = creds.authCredentials.passphrase;
    return passphrase;
  } catch (err) {
    onError(err);
    return "Error while retrieving saved passphrase";
  }
}

async function getStatus() {
  let resp = {
    passphraseOk: false,
    pakeExecuted: false,
    pakeSessionValid: false,
    communicationErrorWithRkl: false,
  };

  try {
    let passphrase = await getSavedPassphrase();
    if (passphrase != null) {
      resp.passphraseOk = true;
    } else {
      console.debug(`Passphrase is not configured`);
    }
    let pakeExecuted = await is_pake_executed();
    if (pakeExecuted == true) {
      resp.pakeExecuted = true;
    } else {
      console.debug(`PAKE not executed`);
    }

    let pakeSessionValid = await is_pake_valid();
    if (pakeSessionValid == true) {
      resp.pakeSessionValid = true;
    } else {
      console.debug(`PAKE session is not valid`);
    }

    return resp;
  } catch (err) {
    onError(err);
    resp.communicationErrorWithRkl = true;
    return resp;
  }
}

async function do_connect_to_rkl() {
  try {
    let passphrase = await getSavedPassphrase();
    let resp = await connect_to_rkl(passphrase);
    console.debug(`Connected to rust-keylock: ${resp}`);
    // Keep connection alive every 3 minutes
    browser.alarms.clearAll();
    browser.alarms.create("rkl", {periodInMinutes: 3});
    return resp;
  } catch (err) {
    onError(err);
    return "Error while connecting to RKL";
  }
}

async function do_get_all() {
  return await get_all();
}

async function handleGetEntriesForCurrentTabCommand() {
  try {
    let ok = await do_connect_to_rkl();
    const tabQueryOptions = { active: true, currentWindow: true };
    const [tab] = await browser.tabs.query(tabQueryOptions);
    let url = (new URL(tab.url));
    console.debug(`Retrieving entries for: ${url.hostname}`);
    let entriesJson = await get_filtered(url.hostname);
    const entries = JSON.parse(entriesJson);
    if (entries.length > 1) {
      console.warn(`"More than one entries found for ${url}. TODO: Handle it"`);
    } else if (entries.length == 1) {
      let decryptedEntriesJson = await get_decrypted(entries[0].name);
      const [decryptedEntry] = JSON.parse(decryptedEntriesJson);
      fillFieldsOfTab(tab, decryptedEntry.user, decryptedEntry.pass);
    } else {
      console.info(`"No entries found for ${url}"`);
    }
  } catch (err) {
    onError(err);
  }
}

function fillFieldsOfTab(tab, user, pass) {
  browser.tabs.sendMessage(
    tab.id,
    {
      user: user,
      pass: pass,
      function_type: "auto"
    });
}

function handleMessage(request, sender, sendResponse) {
  const command = request.command;
  console.log(`Received command: ${command}`);
  if (command == "getAll") {
    do_get_all()
      .then((resp) => {
        sendResponse({ response: resp });
      })
      .catch((err) => {
        onError(err);
        sendResponse({ response: `"${err}"` });
      });
  } else if (command == "getEntriesForCurrentTab") {
    // Need to send the response immediately before the conduit gets invalidated
    // The message comes from the pageAction and this has a temporary/fast lifecycle
    sendResponse({ status: "started" });
    // Then, we can continue retrieving the entries and later send message to the contentscript.
    handleGetEntriesForCurrentTabCommand()
      .catch((err) => {
        onError(err);
      });
  } else if (command == "connectToRkl") {
    do_connect_to_rkl()
      .then((resp) => {
        sendResponse({ response: resp });
      })
      .catch((err) => {
        onError(err);
        sendResponse({ response: `"${err}"` });
      });
  } else if (command == "resetPake") {
    reset_pake()
      .then((resp) => {
        console.debug(`Reset PAKE: ${resp}`);
        sendResponse({ response: resp });
      })
      .catch((err) => {
        onError(err);
        sendResponse({ response: `"${err}"` });
      });
  } else if (command == "status") {
    getStatus()
      .then((resp) => {
        sendResponse({ response: resp });
      })
      .catch((err) => {
        onError(err);
        sendResponse({ response: `"${err}"` });
      });
  }
  // Need to return true for async handling
  // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage#sending_an_asynchronous_response_using_sendresponse
  return true;
}

browser.alarms.onAlarm.addListener((_) => {
  keepConnectinonAlive();
});

function keepConnectinonAlive() {
  console.debug("Keeping alive the connection to rkl");
  get_filtered("_thisentryprobablydoesnotexist_")
    .catch((err) => {
      onError(err);
    });
}

function onError(error) {
  console.error(`Error: ${error}`);
}

initializeRustKeylockWasm();