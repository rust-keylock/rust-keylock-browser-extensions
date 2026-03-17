browser.runtime.onMessage.addListener(setActiveElementValue);

function setActiveElementValue(message) {
    if (message.function_type == "manual") {
        console.debug(`Content script manual handling`);
        let activeElement = document.activeElement;
        let v;
        if (activeElement.type == 'text' || activeElement.type == 'email' || activeElement.type == 'tel') {
            v = message.user;
        } else if (activeElement.type == 'password') {
            v = message.pass;
        }
        activeElement.setAttribute("value", v);
        activeElement.value = v;
    } else if (message.function_type == "auto") {
        console.debug(`Content script auto handling`);
        const usernameField = document.querySelector(
            `input[autocomplete="username"], 
             input[autocomplete="email"], 
             input[autocomplete="current-password"],
             input[type="email"],
             input[type="tel"],
             input[type="text"]`
        );
        if (usernameField != null) {
            console.debug(`Found username field`);
            usernameField.setAttribute("value", message.user);
            usernameField.value = message.user;
        }
        const passwordField = document.querySelector('input[type="password"]');
        if (passwordField != null) {
            console.debug(`Found password field`);
            passwordField.setAttribute("value", message.pass);
            passwordField.value = message.pass;
        }
    } else {
        console.error(`The content script cannot handle message: ${message.function_type}`);
    }

    return true;
}