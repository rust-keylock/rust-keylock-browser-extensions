browser.runtime.onMessage.addListener(setActiveElementValue);

function setActiveElementValue(message) {
    const activeElement = document.activeElement;
    activeElement.setAttribute("value", message);
    return true;
}