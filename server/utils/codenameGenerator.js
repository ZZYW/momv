export function generateCodename() {
    const length = 3;
    const characterSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let codename = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characterSet.length);
        codename += characterSet.charAt(randomIndex);
    }
    return codename;
}