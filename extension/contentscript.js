browser.runtime.onMessage.addListener(setActiveElementValue);

function setActiveElementValue(message) {
    let activeElement = document.activeElement;
    let v;
    if (activeElement.type == 'text' || activeElement.type == 'email' || activeElement.type == 'tel') {
        v = message.user;
    } else if (activeElement.type == 'password') {
        v = message.pass;
    }
    activeElement.setAttribute("value", v);
    activeElement.value = v;
    return true;
}