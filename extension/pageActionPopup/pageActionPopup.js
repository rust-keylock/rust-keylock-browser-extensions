async function pageActionTriggered() {
    const tab = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    browser.runtime.sendMessage({
        command: "getEntriesForCurrentTab",
    }).catch(() => { /* Ignore conduit destruction errors */ });
    window.close();
}

pageActionTriggered();