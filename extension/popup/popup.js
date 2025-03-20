const userInput = document.querySelector("#userInput");
const passwordsDropdownDiv = document.querySelector("#passwordsDropdown");
const connectedDiv = document.querySelector("#connectedDiv");
const disconnectedDiv = document.querySelector("#disconnectedDiv");

userInput.addEventListener("keyup", filterFunction);

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

function emptyPasswords() {
    console.debug("Emptying passwords");
    passwordsDropdownDiv.replaceChildren();
}

async function fillPasswords(connected) {
    emptyPasswords();
    if (connected) {
        connectedDiv.style.display = "";
        disconnectedDiv.style.display = "none";
        console.debug("Filling passwords with connected " + connected);
        const sending = browser.runtime.sendMessage({
            command: "getAll",
        });
        sending.then(showPasswords)
            .catch((err) => {
                onError(err);
                connectedDiv.style.display = "none";
                disconnectedDiv.style.display = "";
            });
    } else {
        connectedDiv.style.display = "none";
        disconnectedDiv.style.display = "";
    }
}

async function showPasswords(message) {
    var json = message.response;
    let table = document.createElement("table");
    table.className = "centered";
    passwordsDropdownDiv.appendChild(table);
    let tbody = document.createElement("tbody");
    table.appendChild(tbody);
    const entries = JSON.parse(json);

    // await browser.storage.local.clear();
    let stored = await browser.storage.local.get("entries");
    let storedEntries = stored.entries;
    if (storedEntries == undefined) {
        console.debug(`storedSettings entries do not exist yet. Creating...`);
        await browser.storage.local.set({
            entries: []
        });
        let stored = await browser.storage.local.get("entries");
        storedEntries = stored.entries;
    } else {
        let stored = await browser.storage.local.get("entries");
        storedEntries = stored.entries;
        console.debug(`Retrieved storedSettings ${storedEntries}`);
    }

    entries.forEach(async (entry) => {
        let htmlElement = await createHtmlElement(entry, storedEntries);
        tbody.appendChild(htmlElement);
        return true;
    });
    passwordsDropdownDiv.classList.toggle("show");
}

async function createHtmlElement(entry, storedEntries) {
    let tr = document.createElement("tr");
    let tdEntry = document.createElement("td");
    tdEntry.className = "leftColumn";
    let tdTick = document.createElement("td");
    tdTick.className = "rightColumn";
    tr.appendChild(tdEntry);
    tr.appendChild(tdTick);

    let a = document.createElement("a");
    var content = `${entry.name} (username: ${entry.user})`
    console.debug(`Adding to dropdown ${content}`);
    a.textContent = content;
    a.value = content;
    a.innerText = content;
    tdEntry.appendChild(a);

    let checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", async () => await handleDbEntry(entry, checkbox.checked));
    checkbox.checked = storedEntries.find(storedEntry => storedEntry.name == entry.name);
    tdTick.appendChild(checkbox);

    return tr;
}

async function handleDbEntry(entry, checked) {
    console.debug(`Handling DB for ${entry.name}: ${checked}`);
    let stored = await browser.storage.local.get("entries");
    let storedEntries = Array.from(stored.entries);

    if (checked) {
        storedEntries.push({ name: entry.name, user: entry.user });
    } else {
        storedEntries = storedEntries.filter(savedEntry => savedEntry.name != entry.name);
    }

    await browser.storage.local.set({
        entries: storedEntries
    });
}

function filterFunction() {
    const filter = userInput.value.toUpperCase();
    const a = passwordsDropdownDiv.getElementsByTagName("tr");

    for (let i = 0; i < a.length; i++) {
        txtValue = a[i].textContent || a[i].innerText;
        if (txtValue.toUpperCase().indexOf(filter) > -1) {
            a[i].style.display = "";
        } else {
            a[i].style.display = "none";
        }
    }
}

function onError(error) {
    console.error(`Error: ${error}`);
}

connectedDiv.style.display = "none";
disconnectedDiv.style.display = "";
sendConnectMessage().then(fillPasswords);
