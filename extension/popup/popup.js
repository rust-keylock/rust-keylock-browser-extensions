const connectLink = document.querySelector("#connectLink");
const passphraseConfiguredTick = document.querySelector("#passphraseConfiguredTick");
const pakeExecutedTick = document.querySelector("#pakeExecutedTick");
const pakeSessionValidTick = document.querySelector("#pakeSessionValidTick");
const communicationOkTick = document.querySelector("#communicationOkTick");

connectLink.addEventListener("click", async () => {
    await sendResetPakeMessage();
    await sendConnectMessage();
    window.close();
});

async function sendResetPakeMessage() {
    console.debug("Resetting PAKE");
    try {
        let responseObject = await browser.runtime.sendMessage({
            command: "resetPake",
        })
        let response = responseObject.response;
        console.debug("Received response resetting PAKE: " + response);
    } catch (err) {
        onError(err);
    }
}

async function sendConnectMessage() {
    console.debug("Sending message to connect to RKL");
    try {
        let responseObject = await browser.runtime.sendMessage({
            command: "connectToRkl",
        })
        let response = responseObject.response;
        console.debug("Received response for connection to RKL: " + response);
        if (response != "OK") {
            onError(response);
            return false;
        } else {
            return true;
        }
    } catch (err) {
        onError(err);
        return false;
    }
}

async function updateStatus() {
    console.debug("Updating status");
    try {
        let responseObject = await browser.runtime.sendMessage({
            command: "status",
        })
        let response = responseObject.response;
        console.debug("Received status response: " + JSON.stringify(response));
        if (response.passphraseOk) {
            passphraseConfiguredTick.className = "success";
        } else {
            passphraseConfiguredTick.className = "failure";
        }
        if (response.pakeExecuted) {
            pakeExecutedTick.className = "success";
        } else {
            pakeExecutedTick.className = "failure";
        }
        if (response.pakeSessionValid) {
            pakeSessionValidTick.className = "success";
        } else {
            pakeSessionValidTick.className = "failure";
        }
        if (response.communicationErrorWithRkl) {
            communicationOkTick.className = "failure";
        } else {
            communicationOkTick.className = "success";
        }
    } catch (err) {
        onError(err);
        return false;
    }
}

function onError(error) {
    console.error(`Error: ${error}`);
}

updateStatus();